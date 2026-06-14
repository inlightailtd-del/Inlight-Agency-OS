import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { enqueueJob, fetchJobs } from '@/lib/queue/queue'

export interface CeoAssessment {
  summary: string
  insights: string[]
  decisions: CeoDecision[]
  metrics: CeoMetrics
  generatedAt: string
}

export interface CeoDecision {
  type: 'create_task' | 'launch_workflow' | 'create_content' | 'create_lead_task' | 'enqueue_job'
  description: string
  priority: string
  executed: boolean
  result?: string
  jobId?: string
}

export interface CeoMetrics {
  totalFailedJobs: number
  pendingWorkflows: number
  draftContent: number
  unconvertedLeads: number
  completedTasks: number
  totalRetries: number
}

async function logCeoAction(supabase: SupabaseClient, userId: string, action: string, detail: string) {
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[CEO] ${action}`,
    module: 'agents', status: 'success',
    message: detail, entity_type: 'ceo_agent',
  }])
}

async function gatherSystemState(supabase: SupabaseClient, userId: string): Promise<{ text: string; metrics: CeoMetrics }> {
  const [
    jobs,
    { data: orchTasks },
    { data: contentReqs },
    { data: leads },
    { data: memories },
  ] = await Promise.all([
    fetchJobs(supabase, userId),
    supabase.from('orchestrator_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('content_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('leads').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('agent_memory').select('*').eq('user_id', userId).eq('category', 'workflow_output').order('created_at', { ascending: false }).limit(5),
  ])

  const tasks = (orchTasks ?? []) as any[]
  const contents = (contentReqs ?? []) as any[]
  const allLeads = (leads ?? []) as any[]
  const allMemories = (memories ?? []) as any[]

  const metrics: CeoMetrics = {
    totalFailedJobs: jobs.filter((j) => j.status === 'failed').length,
    pendingWorkflows: jobs.filter((j) => j.job_type === 'workflow_execution' && j.status === 'pending').length,
    draftContent: contents.filter((c: any) => c.status === 'draft').length,
    unconvertedLeads: allLeads.filter((l: any) => l.status === 'new' || l.status === 'contacted').length,
    completedTasks: tasks.filter((t: any) => t.status === 'completed').length,
    totalRetries: jobs.reduce((s, j) => s + (j.retry_count || 0), 0),
  }

  const text = [
    `=== AGENCY SYSTEM STATUS ===`,
    `\n--- QUEUE (${jobs.length} total) ---`,
    ...jobs.filter((j) => j.status !== 'completed').slice(0, 10).map((j) =>
      `[${j.status}] ${j.job_type}: ${JSON.stringify(j.payload).slice(0, 80)}${j.error_msg ? ` ERROR: ${j.error_msg}` : ''}`
    ),
    `\n--- RECENT TASKS (${tasks.length}) ---`,
    ...tasks.slice(0, 8).map((t: any) =>
      `[${t.status}] ${t.title}${t.result ? ` — ${JSON.stringify(t.result).slice(0, 60)}` : ''}`
    ),
    `\n--- CONTENT REQUESTS (${contents.length}) ---`,
    ...contents.filter((c: any) => c.status === 'draft').slice(0, 5).map((c: any) =>
      `[${c.status}] ${c.title} (${c.content_type})`
    ),
    `\n--- LEADS (${allLeads.length}) ---`,
    ...allLeads.filter((l: any) => l.status !== 'converted' && l.status !== 'lost').slice(0, 5).map((l: any) =>
      `[${l.status}] ${l.name}${l.company ? ` at ${l.company}` : ''} Score: ${l.score}`
    ),
    `\n--- COMPANY BRAIN (last ${allMemories.length} memories) ---`,
    ...allMemories.slice(0, 3).map((m: any) =>
      `[${m.content.stepLabel}] ${(m.content.output || '').slice(0, 100)}`
    ),
  ].join('\n')

  return { text, metrics }
}

export async function runCeoAssessment(
  supabase: SupabaseClient,
  userId: string
): Promise<CeoAssessment> {
  const { text: systemState, metrics } = await gatherSystemState(supabase, userId)

  const systemPrompt = `You are the CEO agent of an AI-powered digital agency. 
Review the system status below and provide:
1. A brief executive assessment (2-3 sentences)
2. 2-4 specific insights about what needs attention
3. 1-3 concrete decisions/actions to take

Format your response as JSON only:
{
  "summary": "executive assessment",
  "insights": ["insight1", "insight2"],
  "decisions": [
    {
      "type": "create_task|launch_workflow|create_content|create_lead_task|enqueue_job",
      "description": "what to do",
      "priority": "high|medium|low"
    }
  ]
}`

  const result = await executeAgentTask(supabase, userId, null, systemState, { systemPrompt })

  let parsed: any = { summary: '', insights: [], decisions: [] }
  try {
    parsed = JSON.parse(result.response || '{}')
  } catch {
    parsed.summary = result.response || 'Assessment completed'
  }

  const decisions: CeoDecision[] = []

  for (const d of (parsed.decisions || [])) {
    try {
      let decisionResult: string | undefined
      let jobId: string | undefined

      switch (d.type) {
        case 'create_task': {
          const { data: task } = await supabase.from('orchestrator_tasks').insert([{
            user_id: userId, title: d.description.slice(0, 120),
            description: d.description, status: 'pending', priority: d.priority || 'medium',
          }]).select('id').single()
          decisionResult = `Task created: ${task?.id}`
          break
        }
        case 'launch_workflow': {
          jobId = await enqueueJob(supabase, userId, 'workflow_execution', {
            input: d.description, workflow_id: 'agency-growth',
          })
          decisionResult = `Workflow enqueued: ${jobId}`
          break
        }
        case 'create_content': {
          const { data: content } = await supabase.from('content_requests').insert([{
            user_id: userId, title: d.description.slice(0, 120),
            description: d.description, content_type: 'blog', status: 'draft',
          }]).select('id').single()
          decisionResult = `Content request created: ${content?.id}`
          break
        }
        case 'create_lead_task': {
          const { data: task } = await supabase.from('orchestrator_tasks').insert([{
            user_id: userId, title: `Lead: ${d.description.slice(0, 100)}`,
            description: d.description, status: 'pending', priority: d.priority || 'medium',
          }]).select('id').single()
          decisionResult = `Lead task created: ${task?.id}`
          break
        }
        case 'enqueue_job': {
          jobId = await enqueueJob(supabase, userId, 'agent_execution', {
            prompt: d.description, systemPrompt: 'Execute this task as an AI agency assistant.',
          })
          decisionResult = `Job enqueued: ${jobId}`
          break
        }
      }

      decisions.push({
        type: d.type,
        description: d.description,
        priority: d.priority || 'medium',
        executed: true,
        result: decisionResult,
        jobId,
      })

      await logCeoAction(supabase, userId, `Decision: ${d.type}`, `${d.description} → ${decisionResult || 'done'}`)
    } catch (err: any) {
      decisions.push({
        type: d.type,
        description: d.description,
        priority: d.priority || 'medium',
        executed: false,
        result: `Error: ${err.message}`,
      })
    }
  }

  // Store assessment in agent_memory
  await storeMemory(supabase, userId, {
    category: 'ceo_assessment',
    content: {
      summary: parsed.summary,
      insights: parsed.insights,
      decisions: decisions.map((d) => ({ type: d.type, description: d.description, result: d.result })),
      metrics,
    },
    tags: ['ceo', 'assessment'],
  })

  await logCeoAction(supabase, userId, 'Assessment completed', `${parsed.insights?.length || 0} insights, ${decisions.length} decisions`)

  return {
    summary: parsed.summary || 'No assessment generated',
    insights: parsed.insights || [],
    decisions,
    metrics,
    generatedAt: new Date().toISOString(),
  }
}

export async function getLastCeoAssessment(supabase: SupabaseClient, userId: string): Promise<CeoAssessment | null> {
  const memories = await supabase
    .from('agent_memory')
    .select('content')
    .eq('user_id', userId)
    .eq('category', 'ceo_assessment')
    .order('created_at', { ascending: false })
    .limit(1)

  const rows = memories.data as any[]
  if (!rows || rows.length === 0) return null

  const m = rows[0].content
  return {
    summary: m.summary || '',
    insights: m.insights || [],
    decisions: (m.decisions || []).map((d: any) => ({
      type: d.type,
      description: d.description,
      priority: d.priority || 'medium',
      executed: true,
      result: d.result,
    })),
    metrics: m.metrics || {},
    generatedAt: rows[0].created_at || '',
  }
}

export async function getCeoRunStats(supabase: SupabaseClient, userId: string): Promise<{ totalRuns: number; lastRun: string | null; totalDecisions: number }> {
  const { count: totalRuns } = await supabase
    .from('agent_memory')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', 'ceo_assessment')

  const { data: last } = await supabase
    .from('agent_memory')
    .select('created_at')
    .eq('user_id', userId)
    .eq('category', 'ceo_assessment')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: decisions } = await supabase
    .from('execution_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .ilike('action', '[CEO] Decision:%')

  return {
    totalRuns: totalRuns || 0,
    lastRun: (last as any)?.[0]?.created_at || null,
    totalDecisions: decisions?.length || 0,
  }
}
