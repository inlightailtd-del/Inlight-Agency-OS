import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { fetchJobs } from '@/lib/queue/queue'

export interface PerfReport {
  summary: string
  bottlenecks: string[]
  recommendations: PerfRecommendation[]
  metrics: PerfMetrics
  generatedAt: string
}

export interface PerfRecommendation {
  area: string
  issue: string
  suggestion: string
  impact: 'high' | 'medium' | 'low'
}

export interface PerfMetrics {
  totalExecutions: number
  totalTokens: number
  avgDurationMs: number
  successRate: number
  totalRetries: number
  failedJobs: number
  agentTypeBreakdown: Record<string, { count: number; avgMs: number; successRate: number }>
  workflowTypeBreakdown: Record<string, { count: number; totalMs: number; successRate: number }>
}

export async function generatePerfReport(
  supabase: SupabaseClient,
  userId: string
): Promise<PerfReport> {
  // Gather agent_executions
  const { data: agentExecs } = await supabase
    .from('agent_executions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)

  const executions = (agentExecs ?? []) as any[]
  const totalExecs = executions.length
  const completedExecs = executions.filter((e: any) => e.status === 'completed')
  const failedExecs = executions.filter((e: any) => e.status === 'failed')
  const totalTokens = executions.reduce((s: number, e: any) => s + (e.tokens_used || 0), 0)
  const avgDurationMs = completedExecs.length > 0
    ? Math.round(completedExecs.reduce((s: number, e: any) => s + (e.duration_ms || 0), 0) / completedExecs.length)
    : 0
  const successRate = totalExecs > 0 ? Math.round((completedExecs.length / totalExecs) * 100) : 0

  // Agent type breakdown from models
  const agentBreakdown: Record<string, any> = {}
  for (const e of executions) {
    const model = e.model || 'unknown'
    if (!agentBreakdown[model]) agentBreakdown[model] = { count: 0, avgMs: 0, successRate: 0 }
    agentBreakdown[model].count++
  }
  for (const [model, data] of Object.entries(agentBreakdown)) {
    const modelExecs = executions.filter((e: any) => e.model === model)
    const modelCompleted = modelExecs.filter((e: any) => e.status === 'completed')
    data.avgMs = modelCompleted.length > 0
      ? Math.round(modelCompleted.reduce((s: number, e: any) => s + (e.duration_ms || 0), 0) / modelCompleted.length)
      : 0
    data.successRate = modelExecs.length > 0
      ? Math.round((modelCompleted.length / modelExecs.length) * 100)
      : 0
  }

  // Queue performance
  const jobs = await fetchJobs(supabase, userId)
  const failedJobs = jobs.filter((j) => j.status === 'failed').length
  const totalRetries = jobs.reduce((s, j) => s + (j.retry_count || 0), 0)

  // Workflow breakdown
  const workflows = jobs.filter((j) => j.job_type === 'workflow_execution')
  const workflowBreakdown: Record<string, any> = {}
  for (const w of workflows) {
    const wid = w.payload?.workflow_id || 'unknown'
    if (!workflowBreakdown[wid]) workflowBreakdown[wid] = { count: 0, totalMs: 0, successRate: 0 }
    workflowBreakdown[wid].count++
    workflowBreakdown[wid].totalMs += w.execution_time_ms || 0
  }
  for (const [wid, data] of Object.entries(workflowBreakdown)) {
    const wfCompleted = workflows.filter((w) => w.payload?.workflow_id === wid && w.status === 'completed').length
    const wfTotal = workflows.filter((w) => w.payload?.workflow_id === wid).length
    data.successRate = wfTotal > 0 ? Math.round((wfCompleted / wfTotal) * 100) : 0
  }

  const metrics: PerfMetrics = {
    totalExecutions: totalExecs,
    totalTokens,
    avgDurationMs,
    successRate,
    totalRetries,
    failedJobs,
    agentTypeBreakdown: agentBreakdown,
    workflowTypeBreakdown: workflowBreakdown,
  }

  // Build state text for AI
  const stateText = `=== PERFORMANCE ANALYSIS ===

Total Executions: ${totalExecs}
Completed: ${completedExecs.length}
Failed: ${failedExecs.length}
Success Rate: ${successRate}%
Avg Duration: ${avgDurationMs}ms
Total Tokens: ${totalTokens}
Total Retries: ${totalRetries}
Failed Queue Jobs: ${failedJobs}

Top Models:
${Object.entries(agentBreakdown).slice(0, 5).map(([m, d]: any) => `  ${m}: ${d.count} runs, ${d.avgMs}ms avg, ${d.successRate}% success`).join('\n')}

Workflows:
${Object.entries(workflowBreakdown).slice(0, 5).map(([w, d]: any) => `  ${w}: ${d.count} runs, ${(d.totalMs / 1000).toFixed(1)}s total, ${d.successRate}% success`).join('\n')}`

  const systemPrompt = `You are a Performance Optimization AI for an AI-powered agency.
Analyze the performance data below and provide optimization recommendations.

Format your response as JSON only:
{
  "summary": "2-3 sentence performance assessment",
  "bottlenecks": ["bottleneck1", "bottleneck2"],
  "recommendations": [
    {"area": "agents|workflows|queue|memory|costs", "issue": "specific issue found", "suggestion": "actionable improvement", "impact": "high|medium|low"}
  ]
}`

  const result = await executeAgentTask(supabase, userId, null, stateText, { systemPrompt })

  let parsed: any = { summary: '', bottlenecks: [], recommendations: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response || 'Analysis completed' }

  const recommendations: PerfRecommendation[] = (parsed.recommendations || []).map((r: any) => ({
    area: r.area || 'general',
    issue: r.issue || '',
    suggestion: r.suggestion || '',
    impact: r.impact || 'medium',
  }))

  // Store in Company Brain
  await storeMemory(supabase, userId, {
    category: 'performance_optimization',
    content: { summary: parsed.summary, bottlenecks: parsed.bottlenecks || [], recommendations, metrics },
    tags: ['performance', 'optimization'],
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[Perf] Performance analysis completed',
    module: 'agents', status: 'success',
    message: `${(parsed.bottlenecks || []).length} bottlenecks, ${recommendations.length} recommendations`,
    entity_type: 'performance',
  }])

  return {
    summary: parsed.summary || 'No analysis generated',
    bottlenecks: parsed.bottlenecks || [],
    recommendations,
    metrics,
    generatedAt: new Date().toISOString(),
  }
}

export async function getLatestPerfReport(supabase: SupabaseClient, userId: string): Promise<PerfReport | null> {
  const { data } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'performance_optimization')
    .order('created_at', { ascending: false })
    .limit(1)

  const rows = (data ?? []) as any[]
  if (!rows.length) return null
  const m = rows[0].content
  return {
    summary: m.summary || '',
    bottlenecks: m.bottlenecks || [],
    recommendations: m.recommendations || [],
    metrics: m.metrics || {},
    generatedAt: rows[0].created_at,
  }
}

export async function getPerfStats(supabase: SupabaseClient, userId: string): Promise<{ totalRuns: number; lastRun: string | null }> {
  const { count } = await supabase
    .from('agent_memory')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', 'performance_optimization')

  const { data: last } = await supabase
    .from('agent_memory')
    .select('created_at')
    .eq('user_id', userId)
    .eq('category', 'performance_optimization')
    .order('created_at', { ascending: false })
    .limit(1)

  return { totalRuns: count || 0, lastRun: (last as any)?.[0]?.created_at || null }
}
