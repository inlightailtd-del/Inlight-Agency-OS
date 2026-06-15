'use server'

import { createClient } from '@/lib/supabase/server'
import { runWorkflow, listWorkflows } from '@/lib/ai/workflow'
import { AgentRuntime } from '@/lib/agents/runtime'
import { runProjectMonitor } from '@/lib/agents/project-monitor'
import { resolveApproval } from '@/lib/agents/approval'
import { revalidatePath } from 'next/cache'

export async function runWorkflowAction(workflowId: string, userInput: string): Promise<{
  taskId: string
  workflowName: string
  steps: { step: string; agentType: string; output: string; duration_ms: number; tokens_used: number; status: string }[]
  finalOutput: string
  totalDurationMs: number
  totalTokens: number
  status: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  const result = await runWorkflow(supabase, user.id, workflowId, userInput)

  const { data: task } = await supabase.from('orchestrator_tasks').insert([{
    user_id: user.id,
    title: `${result.workflowName}: ${userInput.slice(0, 60)}`,
    description: userInput,
    status: result.status === 'completed' ? 'completed' : 'failed',
    priority: 'medium',
    result: `${result.workflowName} completed in ${(result.totalDurationMs / 1000).toFixed(1)}s (${result.totalTokens} tokens)\n\n${result.finalOutput}`,
    completed_at: new Date().toISOString(),
  }]).select().single()

  revalidatePath('/dashboard/orchestrator')

  return { taskId: task?.id || '', ...result }
}

export async function getWorkflowsAction() {
  return listWorkflows().map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    steps: w.steps.map((s) => s.label),
  }))
}

/**
 * Scheduled tick — drain the orchestrator queue.
 */
export async function tickRuntimeAction(): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { ok: false, error: 'Not authenticated' }

    const runtime = new AgentRuntime(supabase, user.id)
    const result = await runtime.tick()
    revalidatePath('/dashboard/orchestrator')
    return { ok: true, result }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Manual execution — run one agent with a prompt.
 */
export async function manualRunAction(
  agentId: string, prompt: string, priority?: string
): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { ok: false, error: 'Not authenticated' }

    const runtime = new AgentRuntime(supabase, user.id)
    const result = await runtime.exec(agentId, prompt, {
      priority: (priority ?? 'medium') as any,
    })
    revalidatePath('/dashboard/orchestrator')
    return { ok: true, result }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Multi-agent delegation — run a plan with sequential steps.
 */
export async function delegateAction(plan: {
  id: string; description: string; steps: { label: string; agentType: string; instruction: string }[]
}): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { ok: false, error: 'Not authenticated' }

    const runtime = new AgentRuntime(supabase, user.id)
    const result = await runtime.delegate(plan)
    revalidatePath('/dashboard/orchestrator')
    return { ok: true, result }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Run the Project Monitor Agent — scans all active projects for issues.
 * Uses runtime.exec() under the hood.
 */
export async function runMonitorAction(): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { ok: false, error: 'Not authenticated' }

    let { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'automation')
      .eq('status', 'idle')
      .order('performance_score', { ascending: false })
      .limit(1)
      .single()
    if (!agent) {
      const { data: fallback } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'idle')
        .order('performance_score', { ascending: false })
        .limit(1)
        .single()
      agent = fallback
    }
    if (!agent) return { ok: false, error: 'No idle agent available. Create one in /dashboard/agents.' }

    const result = await runProjectMonitor(supabase, user.id, agent as any)
    revalidatePath('/dashboard/orchestrator')
    return { ok: true, result: { ...result, agentName: agent.name } }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Approve or reject a pending approval request.
 */
export async function resolveApprovalAction(
  approvalId: string,
  decision: 'approved' | 'rejected',
  reasoning?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { ok: false, error: 'Not authenticated' }

    await resolveApproval(supabase, approvalId, user.id, decision, reasoning)
    revalidatePath('/dashboard/orchestrator')
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
