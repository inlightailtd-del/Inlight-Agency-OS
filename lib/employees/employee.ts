import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'

export interface Employee {
  id: string
  name: string
  role: string | null
  type: string
  department: string | null
  status: string
  performance_score: number
  success_rate: number
  tasks_completed: number
  total_executions: number
  level: number
  promoted_at: string | null
  last_active_at: string | null
  created_at: string
}

export const PROMOTION_THRESHOLDS = [
  { level: 1, minScore: 0, minSuccessRate: 0, title: 'Junior' },
  { level: 2, minScore: 30, minSuccessRate: 60, title: 'Mid' },
  { level: 3, minScore: 55, minSuccessRate: 75, title: 'Senior' },
  { level: 4, minScore: 75, minSuccessRate: 85, title: 'Lead' },
  { level: 5, minScore: 90, minSuccessRate: 92, title: 'Principal' },
]

export function getEmployeeLevel(score: number, successRate: number): { level: number; title: string } {
  let level = 1
  for (const t of PROMOTION_THRESHOLDS) {
    if (score >= t.minScore && successRate >= t.minSuccessRate) level = t.level
  }
  return { level, title: PROMOTION_THRESHOLDS[level - 1]?.title || 'Junior' }
}

export async function fetchEmployees(
  supabase: SupabaseClient,
  userId: string,
  department?: string
): Promise<Employee[]> {
  let q = supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('performance_score', { ascending: false })

  if (department) q = q.eq('department', department)

  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as any[]).map((a: any) => ({
    ...a,
    tasks_completed: a.tasks_completed || a.total_executions || 0,
    level: a.level || 1,
  })) as Employee[]
}

export async function getEmployeeStats(supabase: SupabaseClient, userId: string): Promise<{
  total: number; active: number; avgPerformance: number; avgSuccessRate: number; totalTasks: number
}> {
  const { data } = await supabase
    .from('agents')
    .select('status, performance_score, success_rate, tasks_completed, total_executions')
    .eq('user_id', userId)

  const rows = (data ?? []) as any[]
  return {
    total: rows.length,
    active: rows.filter((r: any) => r.status === 'active').length,
    avgPerformance: rows.length ? Math.round(rows.reduce((s: number, r: any) => s + (r.performance_score || 0), 0) / rows.length) : 0,
    avgSuccessRate: rows.length ? Math.round(rows.reduce((s: number, r: any) => s + (r.success_rate || 0), 0) / rows.length) : 0,
    totalTasks: rows.reduce((s: number, r: any) => s + (r.tasks_completed || r.total_executions || 0), 0),
  }
}

export async function assignTaskToEmployee(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  title: string,
  description: string
): Promise<string> {
  const { data: task, error } = await supabase.from('orchestrator_tasks').insert([{
    user_id: userId, agent_id: employeeId, title, description,
    status: 'pending', priority: 'medium',
  }]).select('id').single()
  if (error) throw error

  await supabase.from('agents').update({
    assigned_tasks: (await supabase.from('agents').select('assigned_tasks').eq('id', employeeId).single()).data?.assigned_tasks + 1 || 1,
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId)

  return task.id
}

export async function completeEmployeeTask(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  taskId: string,
  success: boolean
): Promise<void> {
  const { data: agent } = await supabase.from('agents').select('*').eq('id', employeeId).single()
  if (!agent) return

  const totalExec = (agent.total_executions || 0) + 1
  const tasksDone = (agent.tasks_completed || 0) + (success ? 1 : 0)
  const successRate = Math.round((tasksDone / totalExec) * 100)
  const performanceScore = Math.min(100, Math.round((successRate * 0.6) + (tasksDone * 0.4 / Math.max(1, totalExec))))

  const { level } = getEmployeeLevel(performanceScore, successRate)
  const wasPromoted = level > (agent.level || 1)

  await supabase.from('agents').update({
    total_executions: totalExec,
    tasks_completed: tasksDone,
    success_rate: successRate,
    performance_score: performanceScore,
    level,
    promoted_at: wasPromoted ? new Date().toISOString() : (agent.promoted_at || null),
    status: 'active',
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId)

  await supabase.from('orchestrator_tasks').update({
    status: success ? 'completed' : 'failed',
    completed_at: new Date().toISOString(),
    result: success ? 'Completed successfully' : 'Failed',
  }).eq('id', taskId)

  // Store learning in Company Brain
  await storeMemory(supabase, userId, {
    agent_id: employeeId,
    category: 'employee_learning',
    content: {
      employeeName: agent.name,
      taskCompleted: taskId,
      success,
      performanceScore,
      successRate,
      level,
      wasPromoted,
    },
    tags: [agent.type || 'general', 'employee'],
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: wasPromoted ? `[Employee] ${agent.name} promoted to ${PROMOTION_THRESHOLDS[level - 1]?.title || 'Level ' + level}` : `[Employee] Task completed by ${agent.name}`,
    module: agent.department || 'general', status: success ? 'success' : 'failed',
    message: `Score: ${performanceScore}, Rate: ${successRate}%, Level: ${level}`,
    entity_type: 'employee', entity_id: employeeId,
  }])
}

export async function evaluateAllEmployees(supabase: SupabaseClient, userId: string): Promise<{ evaluated: number; promoted: number }> {
  const { data: agents } = await supabase.from('agents').select('*').eq('user_id', userId)
  const allAgents = (agents ?? []) as any[]
  let promoted = 0

  for (const agent of allAgents) {
    const score = agent.performance_score || 50
    const successRate = agent.success_rate || 50
    const { level } = getEmployeeLevel(score, successRate)
    const wasPromoted = level > (agent.level || 1)

    if (level !== (agent.level || 1)) {
      await supabase.from('agents').update({
        level, promoted_at: wasPromoted ? new Date().toISOString() : (agent.promoted_at || null),
        updated_at: new Date().toISOString(),
      }).eq('id', agent.id)
      if (wasPromoted) promoted++
    }
  }

  return { evaluated: allAgents.length, promoted }
}
