import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueJob, fetchJobs } from '@/lib/queue/queue'

const SCHEDULER_CONFIG_KEY = 'ceo_scheduler_config'

export interface CeoSchedulerConfig {
  enabled: boolean
  intervalMinutes: number
}

const DEFAULT_CONFIG: CeoSchedulerConfig = {
  enabled: false,
  intervalMinutes: 30,
}

export async function getCeoSchedulerConfig(supabase: SupabaseClient, userId: string): Promise<CeoSchedulerConfig> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('user_id', userId)
    .eq('key', SCHEDULER_CONFIG_KEY)
    .single()

  if (data?.value) {
    return { ...DEFAULT_CONFIG, ...data.value as any }
  }
  return DEFAULT_CONFIG
}

export async function updateCeoSchedulerConfig(
  supabase: SupabaseClient,
  userId: string,
  config: Partial<CeoSchedulerConfig>
): Promise<CeoSchedulerConfig> {
  const current = await getCeoSchedulerConfig(supabase, userId)
  const updated = { ...current, ...config }

  await supabase.from('settings').upsert([{
    user_id: userId,
    key: SCHEDULER_CONFIG_KEY,
    value: updated,
    updated_at: new Date().toISOString(),
  }], { onConflict: 'user_id,key' })

  return updated
}

export async function enqueueCeoAssessmentIfNeeded(
  supabase: SupabaseClient,
  userId: string
): Promise<{ enqueued: boolean; reason: string; jobId?: string }> {
  const config = await getCeoSchedulerConfig(supabase, userId)
  if (!config.enabled) {
    return { enqueued: false, reason: 'Scheduler is disabled' }
  }

  // Check for existing pending/running CEO assessment jobs
  const existingJobs = await fetchJobs(supabase, userId, undefined, 'ceo_assessment', 50)
  const active = existingJobs.filter(
    (j) => j.status === 'pending' || j.status === 'running'
  )

  if (active.length > 0) {
    return { enqueued: false, reason: `CEO assessment already ${active[0].status} (${active[0].id})` }
  }

  // Check last completed run time
  const completed = existingJobs.filter((j) => j.status === 'completed')
  if (completed.length > 0) {
    const lastRun = new Date(completed[0].completed_at || completed[0].created_at).getTime()
    const elapsed = Date.now() - lastRun
    const intervalMs = config.intervalMinutes * 60 * 1000
    if (elapsed < intervalMs) {
      const remaining = Math.round((intervalMs - elapsed) / 1000 / 60)
      return { enqueued: false, reason: `Next run in ~${remaining} minutes (interval: ${config.intervalMinutes}m)` }
    }
  }

  const jobId = await enqueueJob(supabase, userId, 'ceo_assessment', {
    scheduled: true,
  }, {
    priority: 10,
  })

  return { enqueued: true, reason: 'CEO assessment enqueued', jobId }
}
