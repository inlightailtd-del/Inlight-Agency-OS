'use server'

import { createClient } from '@/lib/supabase/server'
import { executeCommand } from '@/lib/ai/execution'
import { runWorkflow, matchWorkflow } from '@/lib/ai/workflow'
import { enqueueJob } from '@/lib/queue/queue'
import { revalidatePath } from 'next/cache'

export async function submitCommandAction(commandText: string, category: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  // Check if command matches a workflow
  const workflowId = matchWorkflow(commandText)
  if (workflowId) {
    const result = await runWorkflow(supabase, user.id, workflowId, commandText)
    return {
      id: '', command: commandText, response: result.finalOutput,
      status: result.status, category: 'workflow', duration_ms: result.totalDurationMs,
      tokens_used: result.totalTokens,
    }
  }

  const { data: cmd, error } = await supabase.from('commands').insert([{
    command: commandText, category, status: 'pending', user_id: user.id,
  }]).select().single()
  if (error) throw error
  if (!cmd) throw new Error('Failed to create command')

  const executionResult = await executeCommand(supabase, user.id, cmd.id, commandText, null, category)

  const moduleMap: Record<string, string> = {
    content: 'brain', research: 'brain', seo: 'brain',
    sales: 'clients', analysis: 'finance',
    operations: 'automations', general: 'automations',
  }

  await supabase.from('execution_logs').insert([{
    command_id: cmd.id,
    action: `Command executed: ${category}`,
    module: moduleMap[category] || 'automations',
    status: executionResult.status === 'completed' ? 'success' : 'failed',
    message: executionResult.status === 'completed' ? 'AI response generated' : 'AI execution failed',
    user_id: user.id,
    duration_ms: executionResult.duration_ms,
  }])

  revalidatePath('/dashboard/command-center')

  return {
    id: cmd.id, command: commandText, response: executionResult.response,
    status: executionResult.status, category, duration_ms: executionResult.duration_ms,
    tokens_used: executionResult.tokens_used,
  }
}

export async function submitCommandBackgroundAction(commandText: string, category: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  const workflowId = matchWorkflow(commandText)

  const { data: cmd } = await supabase.from('commands').insert([{
    command: commandText, category: workflowId ? 'workflow' : category, status: 'pending', user_id: user.id,
  }]).select().single()

  if (workflowId) {
    const jobId = await enqueueJob(supabase, user.id, 'workflow_execution', {
      workflow_id: workflowId, input: commandText, command_id: cmd?.id,
    })
    await supabase.from('execution_logs').insert([{
      command_id: cmd?.id || null, action: 'Workflow enqueued for background processing',
      module: 'automations', status: 'success', message: `Job ${jobId}: ${workflowId}`,
      user_id: user.id, entity_type: 'job_queue', entity_id: jobId,
    }])
    revalidatePath('/dashboard/command-center')
    return { jobId, message: 'Workflow enqueued for background processing. Monitor progress in the Queue dashboard.' }
  }

  const jobId = await enqueueJob(supabase, user.id, 'agent_execution', {
    prompt: commandText, category, command_id: cmd?.id,
  })
  await supabase.from('execution_logs').insert([{
    command_id: cmd?.id || null, action: 'Command enqueued for background processing',
    module: moduleFromCategory(category), status: 'success', message: `Job ${jobId}: ${commandText.slice(0, 80)}`,
    user_id: user.id, entity_type: 'job_queue', entity_id: jobId,
  }])
  revalidatePath('/dashboard/command-center')
  return { jobId, message: 'Command enqueued for background processing. Monitor progress in the Queue dashboard.' }
}

function moduleFromCategory(category: string): string {
  const map: Record<string, string> = { content: 'brain', research: 'brain', seo: 'brain', sales: 'clients', analysis: 'finance', operations: 'automations', general: 'automations' }
  return map[category] || 'automations'
}
