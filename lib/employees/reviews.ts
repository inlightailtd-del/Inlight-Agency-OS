import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { type PerformanceReview } from './types'
import { getEmployeeKPIReport } from './kpi'

export const REVIEW_CYCLES = ['weekly', 'monthly', 'quarterly', 'annual'] as const

export const REVIEW_TEMPLATES: Record<string, { category: string; maxScore: number; questions: string[] }[]> = {
  sales: [
    { category: 'Deal Closure', maxScore: 100, questions: ['How many deals were closed?', 'Was revenue target met?', 'How efficient was the sales cycle?'] },
    { category: 'Lead Management', maxScore: 100, questions: ['Were leads properly qualified?', 'Was follow-up timely?', 'How many leads converted?'] },
    { category: 'Communication', maxScore: 100, questions: ['Was outreach effective?', 'Were proposals clear and compelling?', 'How was client feedback?'] },
    { category: 'Initiative', maxScore: 100, questions: ['Did they identify new opportunities?', 'Were processes improved?', 'Did they go beyond expectations?'] },
  ],
  marketing: [
    { category: 'Content Quality', maxScore: 100, questions: ['Was content on-brand?', 'Did it drive engagement?', 'Was it published on schedule?'] },
    { category: 'Campaign Performance', maxScore: 100, questions: ['Were campaign goals met?', 'Was ROI tracked?', 'Were campaigns optimized?'] },
    { category: 'Creativity', maxScore: 100, questions: ['Were ideas innovative?', 'Was content strategy effective?', 'How was audience growth?'] },
    { category: 'Collaboration', maxScore: 100, questions: ['Did they coordinate with other teams?', 'Were reviews addressed?', 'Was feedback incorporated?'] },
  ],
  operations: [
    { category: 'Efficiency', maxScore: 100, questions: ['Were tasks completed on time?', 'Were automations effective?', 'Was queue managed well?'] },
    { category: 'Reliability', maxScore: 100, questions: ['Was uptime maintained?', 'Were errors handled quickly?', 'Was documentation updated?'] },
    { category: 'Process Improvement', maxScore: 100, questions: ['Were bottlenecks identified?', 'Were workflows optimized?', 'Was quality improved?'] },
    { category: 'Communication', maxScore: 100, questions: ['Were statuses clear?', 'Were handoffs smooth?', 'Was reporting consistent?'] },
  ],
  development: [
    { category: 'Code Quality', maxScore: 100, questions: ['Was code well-structured?', 'Were tests written?', 'Were bugs minimized?'] },
    { category: 'Delivery', maxScore: 100, questions: ['Were features shipped on time?', 'Was scope managed?', 'Were deployments clean?'] },
    { category: 'Technical Growth', maxScore: 100, questions: ['Were new technologies adopted?', 'Was architecture improved?', 'Was documentation thorough?'] },
    { category: 'Collaboration', maxScore: 100, questions: ['Were code reviews thorough?', 'Did they help teammates?', 'Was communication clear?'] },
  ],
  content: [
    { category: 'Writing Quality', maxScore: 100, questions: ['Was content engaging?', 'Was it well-researched?', 'Was tone consistent?'] },
    { category: 'Productivity', maxScore: 100, questions: ['Was output consistent?', 'Were deadlines met?', 'Was volume sufficient?'] },
    { category: 'Versatility', maxScore: 100, questions: ['Were multiple formats handled?', 'Were different topics covered?', 'Was feedback incorporated?'] },
    { category: 'Impact', maxScore: 100, questions: ['Did content perform well?', 'Was SEO optimized?', 'Did it drive results?'] },
  ],
  general: [
    { category: 'Task Completion', maxScore: 100, questions: ['Were tasks completed?', 'Was quality acceptable?', 'Were deadlines met?'] },
    { category: 'Reliability', maxScore: 100, questions: ['Was performance consistent?', 'Were errors few?', 'Was response time good?'] },
    { category: 'Growth', maxScore: 100, questions: ['Was improvement shown?', 'Were new skills learned?', 'Was feedback acted on?'] },
    { category: 'Teamwork', maxScore: 100, questions: ['Was collaboration good?', 'Was communication clear?', 'Were others supported?'] },
  ],
}

export async function initiateReview(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  cycle: 'weekly' | 'monthly' | 'quarterly' | 'annual' = 'monthly'
): Promise<PerformanceReview> {
  const { data: agent } = await supabase.from('agents').select('department, performance_score, config').eq('id', employeeId).single()
  if (!agent) throw new Error('Employee not found')

  const dept = (agent as any).department || 'general'
  const template = REVIEW_TEMPLATES[dept] || REVIEW_TEMPLATES.general
  const kpiReport = await getEmployeeKPIReport(supabase, userId, employeeId)

  const scores: Record<string, number> = {}
  for (const cat of template) {
    scores[cat.category] = Math.round((agent as any).performance_score || 70)
  }

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const review: PerformanceReview = {
    id: `rev_${Date.now()}`, employeeId,
    cycle, period: `${periodStart} to ${periodEnd}`,
    overallScore: Math.round((kpiReport.overallScore + (agent as any).performance_score) / 2),
    scores, strengths: [], improvements: [], goals: [],
    status: 'draft', submittedAt: null, completedAt: null,
  }

  const { data: saved } = await supabase.from('employee_reviews').insert([{
    user_id: userId, agent_id: employeeId, cycle,
    period_start: periodStart, period_end: periodEnd,
    overall_score: review.overallScore, scores,
    status: 'draft',
  }]).select().single()

  if (saved) review.id = (saved as any).id
  return review
}

export async function completeReview(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
  employeeId: string,
  reviewerNotes?: string
): Promise<PerformanceReview> {
  const { data: review } = await supabase.from('employee_reviews').select('*').eq('id', reviewId).single()
  if (!review) throw new Error('Review not found')

  const r = review as any
  const dept = r.agent?.department || 'general'
  const scores = r.scores as Record<string, number> || {}
  const scoreList = Object.values(scores) as number[]
  const overallScore = scoreList.length > 0 ? Math.round(scoreList.reduce((a: number, b: number) => a + b, 0) / scoreList.length) : 70

  const systemPrompt = `You are a performance review AI. Generate review content based on scores. Return JSON: {"strengths": ["2-3 specific strengths"], "improvements": ["2-3 areas for improvement"], "goals": ["3 goals for next period"], "summary": "brief performance summary"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Generate review for employee. Overall score: ${overallScore}. Scores by category: ${JSON.stringify(scores)}. Department: ${dept}. ${reviewerNotes ? `Reviewer notes: ${reviewerNotes}` : ''}`, { systemPrompt }
  )

  let aiContent: any = {}
  try { aiContent = JSON.parse(result.response || '{}') } catch {}

  await supabase.from('employee_reviews').update({
    overall_score: overallScore, strengths: aiContent.strengths || [],
    improvements: aiContent.improvements || [],
    goals: aiContent.goals || [], status: 'completed',
    submitted_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }).eq('id', reviewId)

  const completed: PerformanceReview = {
    id: reviewId, employeeId, cycle: r.cycle, period: `${r.period_start} to ${r.period_end}`,
    overallScore, scores,
    strengths: aiContent.strengths || [],
    improvements: aiContent.improvements || [],
    goals: aiContent.goals || [],
    status: 'completed',
    submittedAt: r.submitted_at, completedAt: new Date().toISOString(),
  }

  await supabase.from('agents').update({
    performance_score: Math.round((overallScore + ((r.agent as any)?.performance_score || 50)) / 2),
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId)

  const employeeName = (r.agent as any)?.name || 'Unknown'
  await storeMemory(supabase, userId, {
    category: 'employee_learning', tags: ['review', employeeId, r.cycle],
    content: { type: 'performance_review', employeeName, employeeId, cycle: r.cycle, scores, overallScore, strengths: aiContent.strengths, improvements: aiContent.improvements, goals: aiContent.goals, completedAt: new Date().toISOString() },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Review] ${employeeName} ${r.cycle} review completed (Score: ${overallScore})`,
    module: dept, status: 'success',
    message: `Strengths: ${(aiContent.strengths || []).join(', ')}`,
    entity_type: 'agent', entity_id: employeeId,
  }])

  return completed
}

export async function getReviews(
  supabase: SupabaseClient,
  userId: string,
  employeeId?: string
): Promise<PerformanceReview[]> {
  let q = supabase.from('employee_reviews').select('*, agents!inner(name, department)').eq('user_id', userId)
  if (employeeId) q = q.eq('agent_id', employeeId)
  q = q.order('created_at', { ascending: false }).limit(20)

  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    id: r.id, employeeId: r.agent_id, reviewerId: r.reviewer_id,
    cycle: r.cycle, period: `${r.period_start || ''} to ${r.period_end || ''}`,
    overallScore: r.overall_score, scores: r.scores || {},
    strengths: r.strengths || [], improvements: r.improvements || [],
    goals: r.goals || [], status: r.status,
    submittedAt: r.submitted_at, completedAt: r.completed_at,
  }))
}

export async function getReviewTemplate(dept: string): Promise<{ category: string; maxScore: number; questions: string[] }[]> {
  return REVIEW_TEMPLATES[dept] || REVIEW_TEMPLATES.general
}
