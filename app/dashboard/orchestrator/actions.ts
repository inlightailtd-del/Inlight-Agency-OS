'use server'

import { createClient } from '@/lib/supabase/server'
import { runWorkflow, listWorkflows } from '@/lib/ai/workflow'
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

  // Create a task record to persist the workflow result
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
