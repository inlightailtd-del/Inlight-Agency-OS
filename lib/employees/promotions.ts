import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { adjustSalary, setCompensation } from './compensation'
import { COMPENSATION_BANDS, PROMOTION_THRESHOLDS, type Promotion } from './types'

export async function checkPromotionEligibility(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<{ eligible: boolean; reason: string; currentLevel: number; nextLevel: number | null; nextTitle: string | null }> {
  const { data: agent } = await supabase.from('agents').select('*').eq('id', employeeId).single()
  if (!agent) throw new Error('Employee not found')

  const a = agent as any
  const currentLevel = a.level || 1
  const score = a.performance_score || 0
  const rate = a.success_rate || 0

  if (currentLevel >= 5) {
    return { eligible: false, reason: 'Already at maximum level (Principal)', currentLevel, nextLevel: null, nextTitle: null }
  }

  const nextThreshold = PROMOTION_THRESHOLDS.find(t => t.level === currentLevel + 1)
  if (!nextThreshold) {
    return { eligible: false, reason: 'No promotion path defined', currentLevel, nextLevel: null, nextTitle: null }
  }

  const meetsScore = score >= nextThreshold.minScore
  const meetsRate = rate >= nextThreshold.minSuccessRate

  if (meetsScore && meetsRate) {
    return {
      eligible: true,
      reason: `Meets all criteria: Score ${score} >= ${nextThreshold.minScore}, Rate ${rate}% >= ${nextThreshold.minSuccessRate}%`,
      currentLevel, nextLevel: currentLevel + 1, nextTitle: nextThreshold.title,
    }
  }

  const missing: string[] = []
  if (!meetsScore) missing.push(`Score ${score}/${nextThreshold.minScore}`)
  if (!meetsRate) missing.push(`Rate ${rate}%/${nextThreshold.minSuccessRate}%`)

  return {
    eligible: false,
    reason: `Missing criteria: ${missing.join(', ')}`,
    currentLevel, nextLevel: currentLevel + 1, nextTitle: nextThreshold.title,
  }
}

export async function proposePromotion(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<Promotion> {
  const { data: agent } = await supabase.from('agents').select('*').eq('id', employeeId).single()
  if (!agent) throw new Error('Employee not found')

  const a = agent as any
  const eligibility = await checkPromotionEligibility(supabase, userId, employeeId)
  if (!eligibility.eligible) throw new Error(`Not eligible: ${eligibility.reason}`)

  const currentTitle = PROMOTION_THRESHOLDS.find(t => t.level === (a.level || 1))?.title || 'Junior'
  const newTitle = eligibility.nextTitle || 'Senior'
  const oldLevel = a.level || 1
  const newLevel = eligibility.nextLevel || oldLevel + 1

  const band = COMPENSATION_BANDS.find(b => b.department === (a.department || 'general') && b.level === newLevel)
  const newBaseSalary = band ? Math.round((band.minSalary + band.maxSalary) / 2) : null

  const systemPrompt = `You are a promotion review AI. Generate a promotion justification. Return JSON: {"reason": "compelling reason for promotion", "contributions": ["specific contributions"], "expectedImpact": "expected impact at new level"}`
  const result = await executeAgentTask(supabase, userId, null,
    `${a.name} is being promoted from ${currentTitle} (Level ${oldLevel}) to ${newTitle} (Level ${newLevel}) in ${a.department}. Performance score: ${a.performance_score}, Success rate: ${a.success_rate}%. Skills: ${(a.skills || []).join(', ')}.`, { systemPrompt }
  )

  let aiContent: any = {}
  try { aiContent = JSON.parse(result.response || '{}') } catch {}

  const promotion: Promotion = {
    id: `prom_${Date.now()}`, employeeId,
    fromLevel: oldLevel, toLevel: newLevel,
    fromTitle: currentTitle, toTitle: newTitle,
    salaryAdjustment: newBaseSalary || 0,
    reason: aiContent.reason || 'Performance-based promotion',
    status: 'proposed', proposedAt: new Date().toISOString(),
    completedAt: null,
  }

  await supabase.from('employee_promotions').insert([{
    user_id: userId, agent_id: employeeId,
    from_level: oldLevel, to_level: newLevel,
    from_title: currentTitle, to_title: newTitle,
    salary_adjustment: promotion.salaryAdjustment,
    reason: promotion.reason, status: 'proposed',
  }])

  await storeMemory(supabase, userId, {
    category: 'employee_learning', tags: ['promotion', employeeId, 'proposed'],
    content: { type: 'promotion_proposed', employeeName: a.name, employeeId, fromLevel: oldLevel, toLevel: newLevel, fromTitle: currentTitle, toTitle: newTitle, reason: promotion.reason, proposedAt: promotion.proposedAt },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Promotion] ${a.name} proposed for ${currentTitle} → ${newTitle}`,
    module: a.department || 'general', status: 'info',
    message: aiContent.reason || 'Performance-based promotion',
    entity_type: 'agent', entity_id: employeeId,
  }])

  return promotion
}

export async function approvePromotion(
  supabase: SupabaseClient,
  userId: string,
  promotionId: string,
  approvedBy?: string
): Promise<Promotion> {
  const { data: prom } = await supabase.from('employee_promotions').select('*, agents!inner(name, department, salary)').eq('id', promotionId).single()
  if (!prom) throw new Error('Promotion not found')

  const p = prom as any
  const newLevel = p.to_level
  const currentSalary = p.agents?.salary || 0
  const salaryAdjustment = p.salary_adjustment > currentSalary ? p.salary_adjustment - currentSalary : 5000

  await supabase.from('agents').update({
    level: newLevel,
    performance_score: Math.min(100, (p.agents?.performance_score || 50) + 5),
    promoted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', p.agent_id)

  await supabase.from('employee_promotions').update({
    status: 'completed', approved_by: approvedBy || 'system',
    completed_at: new Date().toISOString(),
  }).eq('id', promotionId)

  // Adjust compensation
  try {
    await setCompensation(supabase, userId, p.agent_id, p.agents?.department || 'general', newLevel)
  } catch { /* non-blocking */ }

  const employeeName = p.agents?.name || 'Unknown'
  await storeMemory(supabase, userId, {
    category: 'employee_learning', tags: ['promotion', p.agent_id, 'completed'],
    content: { type: 'promotion_completed', employeeName, employeeId: p.agent_id, fromLevel: p.from_level, toLevel: newLevel, fromTitle: p.from_title, toTitle: p.to_title, completedAt: new Date().toISOString() },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Promotion] ${employeeName} promoted to ${p.to_title} (Level ${newLevel})`,
    module: p.agents?.department || 'general', status: 'success',
    message: `${p.from_title} → ${p.to_title}, Salary adjusted`,
    entity_type: 'agent', entity_id: p.agent_id,
  }])

  return {
    id: promotionId, employeeId: p.agent_id,
    fromLevel: p.from_level, toLevel: newLevel,
    fromTitle: p.from_title, toTitle: p.to_title,
    salaryAdjustment, reason: p.reason,
    approvedBy: approvedBy || 'system',
    status: 'completed', proposedAt: p.created_at,
    completedAt: new Date().toISOString(),
  }
}

export async function getPromotionHistory(
  supabase: SupabaseClient,
  userId: string,
  employeeId?: string
): Promise<Promotion[]> {
  let q = supabase.from('employee_promotions').select('*').eq('user_id', userId)
  if (employeeId) q = q.eq('agent_id', employeeId)
  q = q.order('created_at', { ascending: false }).limit(20)

  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    id: r.id, employeeId: r.agent_id,
    fromLevel: r.from_level, toLevel: r.to_level,
    fromTitle: r.from_title, toTitle: r.to_title,
    salaryAdjustment: r.salary_adjustment, reason: r.reason,
    approvedBy: r.approved_by, status: r.status,
    proposedAt: r.created_at, completedAt: r.completed_at,
  }))
}
