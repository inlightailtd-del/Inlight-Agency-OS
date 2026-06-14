'use server'

import { createClient } from '@/lib/supabase/server'
import { enqueueJob, retryJob, fetchJobs, getQueueStats } from '@/lib/queue/queue'
import { processNextJob } from '@/lib/queue/worker'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function enqueueAgentExecutionAction(prompt: string, systemPrompt?: string, agentId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await enqueueJob(supabase, user.id, 'agent_execution', { prompt, systemPrompt, agent_id: agentId })
  revalidatePath('/dashboard/queue')
  redirect('/dashboard/queue')
}

export async function enqueueWorkflowAction(workflowId: string, input: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await enqueueJob(supabase, user.id, 'workflow', { workflow_id: workflowId, input })
  revalidatePath('/dashboard/queue')
  redirect('/dashboard/queue')
}

export async function processQueueAction() {
  const supabase = await createClient()
  const result = await processNextJob(supabase)
  revalidatePath('/dashboard/queue')
  return result
}

export async function retryJobAction(jobId: string) {
  const supabase = await createClient()
  await retryJob(supabase, jobId)
  revalidatePath('/dashboard/queue')
  redirect('/dashboard/queue')
}

export async function loadQueueDataAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  const [jobs, stats] = await Promise.all([
    fetchJobs(supabase, user.id),
    getQueueStats(supabase, user.id),
  ])
  return { jobs, stats }
}
