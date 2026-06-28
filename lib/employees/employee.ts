import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'
import { PROMOTION_THRESHOLDS, type Employee } from './types'

export type { Employee }
export { PROMOTION_THRESHOLDS }
export { getEmployeeLevel } from './types'

export * from './hiring'
export * from './compensation'
export * from './kpi'
export * from './training'
export * from './reviews'
export * from './promotions'
export * from './retirement'

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
    id: a.id, name: a.name, role: a.role, type: a.type,
    department: a.department, status: a.status,
    performance_score: a.performance_score || 0,
    success_rate: a.success_rate || 0,
    tasks_completed: a.tasks_completed || a.total_executions || 0,
    total_executions: a.total_executions || 0,
    level: a.level || 1,
    skills: a.skills || [],
    specialization: a.specialization || null,
    training_count: a.training_count || 0,
    last_trained_at: a.last_trained_at || null,
    hired_at: a.hired_at || null,
    promoted_at: a.promoted_at || null,
    retired_at: a.retired_at || null,
    last_active_at: a.last_active_at || null,
    created_at: a.created_at,
    config: a.config || null,
  }))
}

export async function getEmployeeStats(supabase: SupabaseClient, userId: string): Promise<{
  total: number; active: number; avgPerformance: number; avgSuccessRate: number; totalTasks: number
  avgLevel: number; totalTraining: number; totalPromoted: number; totalRetired: number
}> {
  const { data } = await supabase
    .from('agents')
    .select('status, performance_score, success_rate, tasks_completed, total_executions, level, training_count, promoted_at, retired_at')
    .eq('user_id', userId)

  const rows = (data ?? []) as any[]
  return {
    total: rows.length,
    active: rows.filter((r: any) => r.status === 'active' || r.status === 'idle').length,
    avgPerformance: rows.length ? Math.round(rows.reduce((s: number, r: any) => s + (r.performance_score || 0), 0) / rows.length) : 0,
    avgSuccessRate: rows.length ? Math.round(rows.reduce((s: number, r: any) => s + (r.success_rate || 0), 0) / rows.length) : 0,
    totalTasks: rows.reduce((s: number, r: any) => s + (r.tasks_completed || r.total_executions || 0), 0),
    avgLevel: rows.length ? Math.round(rows.reduce((s: number, r: any) => s + (r.level || 1), 0) / rows.length) : 0,
    totalTraining: rows.reduce((s: number, r: any) => s + (r.training_count || 0), 0),
    totalPromoted: rows.filter((r: any) => r.promoted_at).length,
    totalRetired: rows.filter((r: any) => r.retired_at).length,
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
    assigned_tasks: supabase.rpc('increment', { x: 1 }),
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

  const a = agent as any
  const totalExec = (a.total_executions || 0) + 1
  const tasksDone = (a.tasks_completed || 0) + (success ? 1 : 0)
  const successRate = Math.round((tasksDone / totalExec) * 100)
  const performanceScore = Math.min(100, Math.round((successRate * 0.6) + (tasksDone * 0.4 / Math.max(1, totalExec))))

  const { level } = await (await import('./types')).getEmployeeLevel(performanceScore, successRate)
  const wasPromoted = level > (a.level || 1)

  await supabase.from('agents').update({
    total_executions: totalExec,
    tasks_completed: tasksDone,
    success_rate: successRate,
    performance_score: performanceScore,
    level,
    promoted_at: wasPromoted ? new Date().toISOString() : (a.promoted_at || null),
    status: 'active',
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId)

  await supabase.from('orchestrator_tasks').update({
    status: success ? 'completed' : 'failed',
    completed_at: new Date().toISOString(),
    result: success ? 'Completed successfully' : 'Failed',
  }).eq('id', taskId)

  await storeMemory(supabase, userId, {
    agent_id: employeeId, category: 'employee_learning',
    content: { employeeName: a.name, taskCompleted: taskId, success, performanceScore, successRate, level, wasPromoted },
    tags: [a.type || 'general', 'employee'],
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: wasPromoted ? `[Employee] ${a.name} promoted to ${PROMOTION_THRESHOLDS[level - 1]?.title || 'Level ' + level}` : `[Employee] Task completed by ${a.name}`,
    module: a.department || 'general', status: success ? 'success' : 'failed',
    message: `Score: ${performanceScore}, Rate: ${successRate}%, Level: ${level}`,
    entity_type: 'employee', entity_id: employeeId,
  }])
}

export async function evaluateAllEmployees(supabase: SupabaseClient, userId: string): Promise<{ evaluated: number; promoted: number }> {
  const { getEmployeeLevel } = await import('./types')
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
