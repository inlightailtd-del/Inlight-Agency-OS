import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory, getMemoryContext } from '@/lib/ai/memory'
import { executeAgentTask } from '@/lib/ai/execution'

export type PatternCategory = 'success_pattern' | 'failure_pattern' | 'revenue_pattern' | 'growth_pattern' | 'employee_learning'

export interface Pattern {
  id?: string
  category: PatternCategory
  title: string
  description: string
  tags: string[]
  impactScore: number
  usageCount: number
  successRate: number
  lastUsed: string | null
  metadata: Record<string, any>
}

export interface LearningSummary {
  totalPatterns: number
  successPatterns: number
  failurePatterns: number
  revenuePatterns: number
  growthPatterns: number
  employeeLearnings: number
  topPatterns: Pattern[]
}

export async function extractWorkflowLessons(
  supabase: SupabaseClient,
  userId: string,
  workflowId: string,
  workflowName: string,
  steps: any[],
  status: string
): Promise<void> {
  const isSuccess = status === 'completed'
  const category: PatternCategory = isSuccess ? 'success_pattern' : 'failure_pattern'
  const stepSummary = steps.map((s: any) => `${s.step} (${s.agentType}): ${(s.output || '').slice(0, 100)}`).join('\n')

  const systemPrompt = `Analyze this workflow execution and extract key lessons.
Return JSON: {"lessons": [{"title": "short title", "description": "key lesson"}, ...], "tags": ["tag1", "tag2"], "impact": 1-10}`

  const result = await executeAgentTask(supabase, userId, null,
    `Workflow: ${workflowName}\nStatus: ${status}\n\nSteps:\n${stepSummary}`,
    { systemPrompt }
  )

  let parsed: any = { lessons: [], tags: [], impact: 5 }
  try { parsed = JSON.parse(result.response || '{}') } catch { return }

  for (const lesson of (parsed.lessons || [])) {
    await storePattern(supabase, userId, {
      category,
      title: lesson.title || `${workflowName} lesson`,
      description: lesson.description || '',
      tags: [...(parsed.tags || []), workflowId, isSuccess ? 'success' : 'failure'],
      impactScore: parsed.impact || 5,
      usageCount: 0,
      successRate: isSuccess ? 100 : 0,
      lastUsed: new Date().toISOString(),
      metadata: { workflowId, workflowName, isSuccess },
    })
  }
}

export async function extractRevenueLessons(
  supabase: SupabaseClient,
  userId: string,
  metrics: { scored: number; outreach: number; proposals: number; meetings: number }
): Promise<void> {
  const total = metrics.scored + metrics.outreach + metrics.proposals + metrics.meetings
  if (total === 0) return

  const systemPrompt = `Analyze this revenue cycle data and identify revenue patterns.
Return JSON: {"patterns": [{"title": "pattern title", "description": "pattern description"}], "tags": ["tag1"], "impact": 1-10}`

  const result = await executeAgentTask(supabase, userId, null,
    `Revenue cycle results:\nLeads scored: ${metrics.scored}\nOutreach sent: ${metrics.outreach}\nProposals: ${metrics.proposals}\nMeetings: ${metrics.meetings}`,
    { systemPrompt }
  )

  let parsed: any = { patterns: [], tags: [], impact: 5 }
  try { parsed = JSON.parse(result.response || '{}') } catch { return }

  for (const p of (parsed.patterns || [])) {
    await storePattern(supabase, userId, {
      category: 'revenue_pattern',
      title: p.title || 'Revenue insight',
      description: p.description || '',
      tags: [...(parsed.tags || []), 'revenue'],
      impactScore: parsed.impact || 5,
      usageCount: 0,
      successRate: 50,
      lastUsed: new Date().toISOString(),
      metadata: metrics,
    })
  }
}

export async function extractEmployeeLessons(
  supabase: SupabaseClient,
  userId: string,
  employeeName: string,
  employeeType: string,
  taskResult: { success: boolean; performanceScore: number; successRate: number; level: number }
): Promise<void> {
  const category: PatternCategory = taskResult.success ? 'employee_learning' : 'failure_pattern'

  await storePattern(supabase, userId, {
    category,
    title: `${employeeName} — ${taskResult.success ? 'Completed' : 'Failed'} task`,
    description: `Score: ${taskResult.performanceScore}%, Rate: ${taskResult.successRate}%, Level: ${taskResult.level}`,
    tags: [employeeType, 'employee', taskResult.success ? 'success' : 'failure'],
    impactScore: taskResult.success ? 7 : 3,
    usageCount: 0,
    successRate: taskResult.successRate,
    lastUsed: new Date().toISOString(),
    metadata: { employeeName, employeeType, ...taskResult },
  })
}

export async function storePattern(
  supabase: SupabaseClient,
  userId: string,
  pattern: Pattern
): Promise<void> {
  const { data: existing } = await supabase
    .from('agent_memory')
    .select('content, tags')
    .eq('user_id', userId)
    .eq('category', pattern.category)
    .contains('tags', [pattern.title.slice(0, 40)])
    .limit(1)

  const rows = (existing ?? []) as any[]
  if (rows.length > 0) {
    const existingPattern = rows[0]
    const newCount = (existingPattern.content?.usageCount || 0) + 1
    const newSuccessRate = Math.round(
      ((existingPattern.content?.successRate || 0) * (existingPattern.content?.usageCount || 0) + pattern.successRate) / newCount
    )
    await supabase
      .from('agent_memory')
      .update({
        content: {
          ...existingPattern.content,
          usageCount: newCount,
          successRate: newSuccessRate,
          lastUsed: new Date().toISOString(),
          impactScore: Math.min(10, (existingPattern.content?.impactScore || 0) + 1),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', rows[0].id)
    return
  }

  await storeMemory(supabase, userId, {
    category: pattern.category,
    content: {
      title: pattern.title,
      description: pattern.description,
      impactScore: pattern.impactScore,
      usageCount: 1,
      successRate: pattern.successRate,
      lastUsed: pattern.lastUsed || new Date().toISOString(),
      metadata: pattern.metadata,
    },
    tags: pattern.tags,
  })
}

export async function getLearningSummary(supabase: SupabaseClient, userId: string): Promise<LearningSummary> {
  const { data } = await supabase
    .from('agent_memory')
    .select('category, content, tags')
    .eq('user_id', userId)
    .in('category', ['success_pattern', 'failure_pattern', 'revenue_pattern', 'growth_pattern', 'employee_learning'])
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as any[]
  const allPatterns = rows.map((r: any) => ({
    category: r.category as PatternCategory,
    title: r.content?.title || 'Untitled',
    description: r.content?.description || '',
    tags: r.tags || [],
    impactScore: r.content?.impactScore || 0,
    usageCount: r.content?.usageCount || 0,
    successRate: r.content?.successRate || 0,
    lastUsed: r.content?.lastUsed || null,
    metadata: r.content?.metadata || {},
  }))

  const topPatterns = [...allPatterns]
    .sort((a, b) => (b.impactScore * b.usageCount) - (a.impactScore * a.usageCount))
    .slice(0, 10)

  return {
    totalPatterns: allPatterns.length,
    successPatterns: allPatterns.filter((p) => p.category === 'success_pattern').length,
    failurePatterns: allPatterns.filter((p) => p.category === 'failure_pattern').length,
    revenuePatterns: allPatterns.filter((p) => p.category === 'revenue_pattern').length,
    growthPatterns: allPatterns.filter((p) => p.category === 'growth_pattern').length,
    employeeLearnings: allPatterns.filter((p) => p.category === 'employee_learning').length,
    topPatterns,
  }
}

export async function getPatternsByCategory(
  supabase: SupabaseClient,
  userId: string,
  category: PatternCategory
): Promise<Pattern[]> {
  const { data } = await supabase
    .from('agent_memory')
    .select('content, tags, created_at')
    .eq('user_id', userId)
    .eq('category', category)
    .order('created_at', { ascending: false })

  return ((data ?? []) as any[]).map((r: any) => ({
    category,
    title: r.content?.title || '',
    description: r.content?.description || '',
    tags: r.tags || [],
    impactScore: r.content?.impactScore || 0,
    usageCount: r.content?.usageCount || 0,
    successRate: r.content?.successRate || 0,
    lastUsed: r.content?.lastUsed || null,
    metadata: r.content?.metadata || {},
  }))
}

export async function injectLearningsForAgent(
  supabase: SupabaseClient,
  userId: string,
  agentType: string
): Promise<string> {
  const { data } = await supabase
    .from('agent_memory')
    .select('content, tags, category')
    .eq('user_id', userId)
    .in('category', ['success_pattern', 'failure_pattern', 'employee_learning'])
    .contains('tags', [agentType])
    .order('created_at', { ascending: false })
    .limit(5)

  const rows = (data ?? []) as any[]
  if (!rows.length) return ''

  return '\n\n[Company Brain — Learned Patterns]\n' +
    rows.map((r: any) =>
      `[${r.category === 'success_pattern' ? '✅' : r.category === 'failure_pattern' ? '❌' : '📚'} ${r.content?.title}]: ${(r.content?.description || '').slice(0, 200)}`
    ).join('\n')
}
