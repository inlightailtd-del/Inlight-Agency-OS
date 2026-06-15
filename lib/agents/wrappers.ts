/**
 * Agent Wrappers — Connect existing lib/ systems into the AgentRuntime.
 *
 * Every "agent" here is a thin wrapper that:
 * 1. Takes (supabase, userId, params)
 * 2. Calls an existing lib/ function
 * 3. Logs execution to execution_logs + agent_memory
 * 4. Returns structured results
 *
 * These are designed to be called via runtime.exec() from the orchestrator.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'
import { runCeoAssessment } from '@/lib/ceo/ceo'
import { runManagerAssessment } from '@/lib/ceo/manager'
import type { DepartmentType } from '@/lib/ceo/manager'
import { generateContent } from '@/lib/ai/content-engine'
import { analyzeLead, scoreLeadsBatch } from '@/lib/ai/lead-analyzer'
import { generatePerfReport } from '@/lib/perf/analyzer'
import { runProjectMonitor } from '@/lib/agents/project-monitor'
import type { AgentRow } from '@/lib/supabase/agents'

// ════════════════════════════════════════════════════════════
// CEO AGENT
// ════════════════════════════════════════════════════════════

export const CEO_SYSTEM_PROMPT = `You are the CEO Agent of an AI-powered digital agency.
You have access to the Company Brain for context, the assessment system for KPIs, and department managers for oversight.
Your job is to monitor company health, identify issues, and generate strategic tasks.`

export async function ceoFullAssessment(supabase: SupabaseClient, userId: string) {
  const start = Date.now()
  const result = await runCeoAssessment(supabase, userId)
  await log(supabase, userId, 'ceo_assessment_complete',
    `CEO assessment: ${result.insights.length} insights, ${result.decisions.length} decisions`,
    { durationMs: Date.now() - start, summary: result.summary })
  return result
}

export async function ceoDepartmentOversight(supabase: SupabaseClient, userId: string, department: DepartmentType) {
  const start = Date.now()
  const result = await runManagerAssessment(supabase, userId, department)
  await log(supabase, userId, `dept_oversight_${department}`,
    `${department} oversight: ${result.decisions.length} decisions`,
    { durationMs: Date.now() - start })
  return result
}

export const CEO_WORKFLOW_STEPS = [
  { label: 'Company Assessment', agentType: 'ceo', instruction: 'Run full company assessment across all departments. Gather KPIs, identify bottlenecks, and generate strategic tasks.' },
  { label: 'Department Oversight', agentType: 'ceo', instruction: 'Review each department status. Generate specific improvement tasks for each area.' },
  { label: 'Task Generation', agentType: 'automation', instruction: 'Convert all identified issues and insights into concrete orchestrator tasks with priorities.' },
]

// ════════════════════════════════════════════════════════════
// CONTENT AGENT
// ════════════════════════════════════════════════════════════

export const CONTENT_SYSTEM_PROMPT = `You are the Content Agent of an AI-powered digital agency.
You generate blog posts, social media content, ad copy, emails, and landing pages.
You can research topics via the Company Brain and plan a content calendar.`

export async function contentGenerate(
  supabase: SupabaseClient, userId: string,
  contentRequestId: string,
  params: { title: string; description: string; content_type: string; platform?: string; tone?: string; word_count?: number }
) {
  const start = Date.now()
  const output = await generateContent(supabase, userId, contentRequestId, params)
  await log(supabase, userId, 'content_generated',
    `Generated ${params.content_type}: ${params.title.slice(0, 60)} (${output.split(/\s+/).length} words)`,
    { durationMs: Date.now() - start, contentType: params.content_type })
  return output
}

export async function contentBatch(
  supabase: SupabaseClient, userId: string,
  requests: { id: string; title: string; description: string; content_type: string; platform?: string; tone?: string; word_count?: number }[]
) {
  const results = []
  for (const r of requests) {
    try {
      const output = await contentGenerate(supabase, userId, r.id, r)
      results.push({ id: r.id, title: r.title, status: 'completed', output })
    } catch (err: any) {
      results.push({ id: r.id, title: r.title, status: 'failed', error: err.message })
    }
  }
  return results
}

export const CONTENT_WORKFLOW_STEPS = [
  { label: 'Content Research', agentType: 'research', instruction: 'Research trending topics and content gaps. Use Company Brain to find high-impact subjects.' },
  { label: 'Content Planning', agentType: 'content', instruction: 'Create a content plan with 5-10 pieces. Include title, format, platform, and target audience for each.' },
  { label: 'Content Generation', agentType: 'content', instruction: 'Generate the planned content pieces using the content factory. Ensure quality and consistency.' },
]

// ════════════════════════════════════════════════════════════
// LEAD ANALYZER AGENT
// ════════════════════════════════════════════════════════════

export const LEAD_ANALYZER_SYSTEM_PROMPT = `You are the Lead Analyzer Agent.
You score leads, detect opportunities, and recommend sales actions.
Use the Company Brain to research companies and industries before scoring.`

export async function leadAnalyze(supabase: SupabaseClient, userId: string, leadId: string) {
  const start = Date.now()
  const { score, analysis } = await analyzeLead(supabase, userId, leadId)
  await log(supabase, userId, 'lead_analyzed',
    `Lead ${leadId}: score ${score} — ${analysis.slice(0, 100)}`,
    { durationMs: Date.now() - start, leadId, score })
  return { leadId, score, analysis }
}

export async function leadBatchAnalyze(supabase: SupabaseClient, userId: string, leadIds: string[]) {
  const start = Date.now()
  const results = await scoreLeadsBatch(supabase, userId, leadIds)
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length
  await log(supabase, userId, 'lead_batch_analyzed',
    `Scored ${leadIds.length} leads. Avg score: ${Math.round(avgScore)}`,
    { durationMs: Date.now() - start, count: leadIds.length, avgScore })
  return results
}

export async function leadDetectOpportunities(supabase: SupabaseClient, userId: string) {
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, company, score, industry')
    .eq('user_id', userId)
    .gte('score', 70)
    .not('status', 'eq', 'converted')
    .order('score', { ascending: false })
    .limit(10)

  const highValue = (leads ?? []) as any[]
  if (highValue.length === 0) return { opportunities: [], message: 'No high-value leads found' }

  for (const lead of highValue) {
    await supabase.from('orchestrator_tasks').insert([{
      user_id: userId,
      title: `[Lead Opportunity] ${lead.name}${lead.company ? ` at ${lead.company}` : ''} (score: ${lead.score})`,
      description: `High-value lead with score ${lead.score}. Industry: ${lead.industry || 'N/A'}. Recommended: immediate outreach.`,
      status: 'pending',
      priority: 'high',
    }])
  }

  await log(supabase, userId, 'lead_opportunities_detected',
    `Found ${highValue.length} high-value leads needing outreach`,
    { count: highValue.length })
  return { opportunities: highValue.map((l: any) => ({ id: l.id, name: l.name, company: l.company, score: l.score })) }
}

export const LEAD_ANALYZER_WORKFLOW_STEPS = [
  { label: 'Lead Scoring', agentType: 'sales', instruction: 'Score all unprocessed leads using the lead analyzer. Prioritize by score.' },
  { label: 'Opportunity Detection', agentType: 'sales', instruction: 'Identify high-value leads (score 70+) that haven\'t been contacted. Create outreach tasks.' },
  { label: 'Recommendations', agentType: 'automation', instruction: 'Generate automation recommendations for lead follow-up sequences and CRM updates.' },
]

// ════════════════════════════════════════════════════════════
// PERFORMANCE & LEARNING AGENT
// ════════════════════════════════════════════════════════════

export const PERFORMANCE_SYSTEM_PROMPT = `You are the Performance & Learning Agent.
You monitor agent health, analyze execution patterns, and recommend optimizations.
Use the Company Brain to find past patterns and performance trends.`

export async function performanceAnalyze(supabase: SupabaseClient, userId: string) {
  const start = Date.now()
  const report = await generatePerfReport(supabase, userId)
  await log(supabase, userId, 'performance_analysis_complete',
    `Performance report: ${report.bottlenecks.length} bottlenecks, ${report.recommendations.length} recommendations`,
    { durationMs: Date.now() - start })
  return report
}

export async function performanceAgentHealth(supabase: SupabaseClient, userId: string) {
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, type, status, performance_score, success_rate, total_executions, level')
    .eq('user_id', userId)
    .order('performance_score', { ascending: true })
    .limit(5)

  const lowPerformers = ((agents ?? []) as any[]).filter((a) => a.performance_score < 40)

  if (lowPerformers.length > 0) {
    for (const agent of lowPerformers) {
      await supabase.from('orchestrator_tasks').insert([{
        user_id: userId,
        title: `[Agent Health] ${agent.name} — low performance (${agent.performance_score}%)`,
        description: `${agent.name} (${agent.type}) has a performance score of ${agent.performance_score}% with ${agent.total_executions} executions. Review and retrain.`,
        status: 'pending',
        priority: 'medium',
      }])
    }
  }

  return { total: (agents ?? []).length, lowPerformers: lowPerformers.length, details: agents }
}

export const PERFORMANCE_WORKFLOW_STEPS = [
  { label: 'Performance Analysis', agentType: 'automation', instruction: 'Run full performance analysis. Identify bottlenecks, low-performing agents, and optimization opportunities.' },
  { label: 'Health Check', agentType: 'automation', instruction: 'Check every agent\'s health status. Flag agents with performance below 40% or success rate below 60%.' },
  { label: 'Optimization Plan', agentType: 'ceo', instruction: 'Generate an optimization plan with concrete steps to improve agent performance and system throughput.' },
]

// ════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════

async function log(supabase: SupabaseClient, userId: string, action: string, message: string, metadata?: any) {
  try {
    await supabase.from('execution_logs').insert([{
      user_id: userId, command_id: null, action, module: 'agents',
      entity_type: 'agent_wrapper', status: 'success', message, result: metadata || {},
    }])
  } catch { /* non-blocking */ }
}
