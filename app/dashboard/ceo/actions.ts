'use server'

import { createClient } from '@/lib/supabase/server'
import { runCeoAssessment, getLastCeoAssessment, getCeoRunStats } from '@/lib/ceo/ceo'
import { getCeoSchedulerConfig, updateCeoSchedulerConfig, enqueueCeoAssessmentIfNeeded } from '@/lib/ceo/scheduler'
import { fetchJobs } from '@/lib/queue/queue'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function runCeoCycleAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  const result = await runCeoAssessment(supabase, user.id)

  revalidatePath('/dashboard/ceo')
  return result
}

export async function toggleCeoSchedulerAction(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  await updateCeoSchedulerConfig(supabase, user.id, { enabled })
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo')
}

export async function setCeoIntervalAction(minutes: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  await updateCeoSchedulerConfig(supabase, user.id, { intervalMinutes: minutes })
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo')
}

export async function triggerSchedulerCheckAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  const result = await enqueueCeoAssessmentIfNeeded(supabase, user.id)
  revalidatePath('/dashboard/ceo')
  return result
}

export async function loadCeoDashboardAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  const [assessment, stats, schedulerConfig, recentJobs] = await Promise.all([
    getLastCeoAssessment(supabase, user.id),
    getCeoRunStats(supabase, user.id),
    getCeoSchedulerConfig(supabase, user.id),
    supabase
      .from('job_queue')
      .select('*')
      .eq('user_id', user.id)
      .eq('job_type', 'ceo_assessment')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const { data: ceoLogs } = await supabase
    .from('execution_logs')
    .select('*')
    .eq('user_id', user.id)
    .ilike('action', '[CEO]%')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: decisions } = await supabase
    .from('execution_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .ilike('action', '[CEO] Decision:%')

  // Aggregate decision stats from assessments
  const allAssessments = await supabase
    .from('agent_memory')
    .select('content')
    .eq('user_id', user.id)
    .eq('category', 'ceo_assessment')
    .order('created_at', { ascending: false })

  let totalTasks = 0, totalWorkflows = 0
  for (const row of (allAssessments.data || []) as any[]) {
    const decisions = row.content?.decisions || []
    totalTasks += decisions.filter((d: any) => d.type === 'create_task').length
    totalWorkflows += decisions.filter((d: any) => d.type === 'launch_workflow').length
  }

  return {
    assessment,
    stats: { ...stats, totalTasks, totalWorkflows, totalDecisions: decisions?.length || 0 },
    schedulerConfig,
    timelineJobs: (recentJobs.data || []) as any[],
    timelineLogs: (ceoLogs || []) as any[],
  }
}
