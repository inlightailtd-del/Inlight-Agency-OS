import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'
import { type OffboardingPlan } from './types'

export interface SuccessionCandidate {
  employeeId: string
  employeeName: string
  department: string
  score: number
  skillMatch: number
  readiness: 'ready' | 'developing' | 'potential'
}

export async function initiateOffboarding(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  reason: string
): Promise<OffboardingPlan> {
  const { data: agent } = await supabase.from('agents').select('*').eq('id', employeeId).single()
  if (!agent) throw new Error('Employee not found')

  const a = agent as any
  const skillItems = (a.skills || []).map((skill: string) => ({
    asset: `Skill: ${skill}`, transferredTo: '',
    completed: false,
  }))
  const knowledgeItems = [
    { asset: 'Current tasks and responsibilities', transferredTo: '', completed: false },
    { asset: 'Project documentation and context', transferredTo: '', completed: false },
    { asset: 'Tool access and configurations', transferredTo: '', completed: false },
    ...skillItems,
  ]

  await supabase.from('agents').update({
    status: 'offline',
    retired_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId)

  const plan: OffboardingPlan = {
    employeeId, reason,
    knowledgeTransferItems: knowledgeItems,
    status: 'planned',
    plannedAt: new Date().toISOString(),
    completedAt: null,
  }

  await supabase.from('employee_offboarding').insert([{
    user_id: userId, agent_id: employeeId, reason,
    knowledge_items: knowledgeItems, status: 'planned',
  }])

  await storeMemory(supabase, userId, {
    category: 'employee_learning', tags: ['offboarding', employeeId, a.department || ''],
    content: { type: 'offboarding_initiated', employeeName: a.name, employeeId, department: a.department, reason, skills: a.skills, plannedAt: plan.plannedAt },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Offboarding] ${a.name} offboarding initiated`,
    module: a.department || 'general', status: 'info',
    message: `Reason: ${reason}. Knowledge transfer items: ${knowledgeItems.length}`,
    entity_type: 'agent', entity_id: employeeId,
  }])

  return plan
}

export async function findSuccessors(
  supabase: SupabaseClient,
  userId: string,
  departingEmployeeId: string
): Promise<SuccessionCandidate[]> {
  const { data: departing } = await supabase.from('agents').select('*').eq('id', departingEmployeeId).single()
  if (!departing) return []

  const d = departing as any
  const dept = d.department
  const departingSkills = new Set(d.skills || [])

  const { data: candidates } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .eq('department', dept)
    .neq('id', departingEmployeeId)
    .not('status', 'eq', 'offline')
    .order('performance_score', { ascending: false })
    .limit(5)

  return ((candidates ?? []) as any[]).map(c => {
    const candidateSkills = new Set(c.skills || [])
    const matchingSkills = [...departingSkills].filter(s => candidateSkills.has(s)).length
    const skillMatch = departingSkills.size > 0 ? Math.round((matchingSkills / departingSkills.size) * 100) : 0
    const readiness = c.performance_score >= 80 ? 'ready' : c.performance_score >= 60 ? 'developing' : 'potential'

    return {
      employeeId: c.id, employeeName: c.name || 'Unknown',
      department: c.department, score: c.performance_score || 0,
      skillMatch, readiness,
    }
  })
}

export async function assignKnowledgeTransfer(
  supabase: SupabaseClient,
  userId: string,
  offboardingId: string,
  assetIndex: number,
  assigneeId: string
): Promise<void> {
  const { data: offboarding } = await supabase.from('employee_offboarding').select('*').eq('id', offboardingId).single()
  if (!offboarding) throw new Error('Offboarding plan not found')

  const items = [...((offboarding as any).knowledge_items || [])]
  if (items[assetIndex]) {
    const { data: assignee } = await supabase.from('agents').select('name').eq('id', assigneeId).single()
    items[assetIndex].transferredTo = (assignee as any)?.name || assigneeId
    items[assetIndex].completed = true
  }

  await supabase.from('employee_offboarding').update({
    knowledge_items: items,
    status: items.every((i: any) => i.completed) ? 'completed' : 'in_progress',
    completed_at: items.every((i: any) => i.completed) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', offboardingId)
}

export async function completeOffboarding(
  supabase: SupabaseClient,
  userId: string,
  offboardingId: string
): Promise<void> {
  await supabase.from('employee_offboarding').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', offboardingId)
}

export async function getPendingOffboardings(
  supabase: SupabaseClient,
  userId: string
): Promise<OffboardingPlan[]> {
  const { data } = await supabase
    .from('employee_offboarding')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['planned', 'in_progress'])
    .order('created_at', { ascending: false })

  return ((data ?? []) as any[]).map(r => ({
    employeeId: r.agent_id, reason: r.reason,
    knowledgeTransferItems: r.knowledge_items || [],
    status: r.status, plannedAt: r.created_at, completedAt: r.completed_at,
  }))
}
