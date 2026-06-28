import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'
import { COMPENSATION_BANDS, type EmployeeCompensation } from './types'

export async function setCompensation(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  department: string,
  level: number,
  salaryOverride?: number
): Promise<EmployeeCompensation> {
  const band = COMPENSATION_BANDS.find(b => b.department === department && b.level === level)
  const baseSalary = salaryOverride || (band ? Math.round((band.minSalary + band.maxSalary) / 2) : 50000)

  const comp: EmployeeCompensation = {
    employeeId, salary: baseSalary, currency: band?.currency || 'USD',
    bonusTarget: band ? Math.round(baseSalary * ((band.bonusTargetPercent || 0) / 100)) : 0,
    bonusEarned: 0, commissionRate: band?.commissionRate || 0,
    commissionEarned: 0, equityPercent: band?.equityPercent || 0,
    totalCompYTD: baseSalary, lastReviewRaise: 0,
    lastReviewRaiseAt: null, effectiveAt: new Date().toISOString(),
  }

  await supabase.from('agents').update({
    config: { compensation: comp },
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId).eq('user_id', userId)

  return comp
}

export async function getCompensation(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<EmployeeCompensation | null> {
  const { data: agent } = await supabase.from('agents').select('config, department, level').eq('id', employeeId).single()
  if (!agent) return null

  const existing = (agent as any).config?.compensation as EmployeeCompensation | undefined
  if (existing) return existing

  const dept = (agent as any).department || 'general'
  const level = (agent as any).level || 1
  await setCompensation(supabase, userId, employeeId, dept, level)
  return getCompensation(supabase, userId, employeeId)
}

export async function adjustSalary(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  newSalary: number,
  reason: string
): Promise<EmployeeCompensation> {
  const comp = await getCompensation(supabase, userId, employeeId)
  if (!comp) throw new Error('Compensation not found')

  const raise = newSalary - comp.salary
  comp.salary = newSalary
  comp.lastReviewRaise = raise
  comp.lastReviewRaiseAt = new Date().toISOString()
  comp.totalCompYTD += raise

  await supabase.from('agents').update({
    config: { compensation: comp },
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId).eq('user_id', userId)

  const { data: agent } = await supabase.from('agents').select('name').eq('id', employeeId).single()

  await storeMemory(supabase, userId, {
    category: 'employee_learning', tags: ['compensation', 'salary_adjustment'],
    content: { type: 'salary_adjustment', employeeName: (agent as any)?.name, employeeId, previousSalary: comp.salary - raise, newSalary, raise, reason, adjustedAt: new Date().toISOString() },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Compensation] Salary adjusted for ${(agent as any)?.name || employeeId}`,
    module: 'hr', status: 'success',
    message: `Raise: $${raise} (${reason})`,
    entity_type: 'agent', entity_id: employeeId,
  }])

  return comp
}

export async function calculateCommission(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  dealValue: number
): Promise<number> {
  const comp = await getCompensation(supabase, userId, employeeId)
  if (!comp || comp.commissionRate <= 0) return 0

  const commission = Math.round(dealValue * comp.commissionRate)
  comp.commissionEarned += commission
  comp.totalCompYTD += commission

  await supabase.from('agents').update({
    config: { compensation: comp },
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId).eq('user_id', userId)

  return commission
}

export async function calculateBonus(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  performanceScore: number
): Promise<number> {
  const comp = await getCompensation(supabase, userId, employeeId)
  if (!comp || comp.bonusTarget <= 0) return 0

  const multiplier = performanceScore / 100
  const bonus = Math.round(comp.bonusTarget * multiplier)
  comp.bonusEarned += bonus
  comp.totalCompYTD += bonus

  await supabase.from('agents').update({
    config: { compensation: comp },
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId).eq('user_id', userId)

  return bonus
}

export async function getDepartmentCompensationReport(
  supabase: SupabaseClient,
  userId: string,
  department: string
): Promise<{ totalSalary: number; avgSalary: number; totalBonus: number; totalCommission: number; headcount: number }> {
  const { data: agents } = await supabase
    .from('agents')
    .select('config')
    .eq('user_id', userId)
    .eq('department', department)

  const members = (agents ?? []) as any[]
  let totalSalary = 0; let totalBonus = 0; let totalCommission = 0; let count = 0

  for (const agent of members) {
    const comp = agent.config?.compensation as EmployeeCompensation | undefined
    if (comp) {
      totalSalary += comp.salary
      totalBonus += comp.bonusEarned
      totalCommission += comp.commissionEarned
      count++
    }
  }

  return {
    totalSalary, avgSalary: count > 0 ? Math.round(totalSalary / count) : 0,
    totalBonus, totalCommission, headcount: count,
  }
}
