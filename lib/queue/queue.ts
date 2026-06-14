import type { SupabaseClient } from '@supabase/supabase-js'

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type JobType =
  | 'agent_execution'
  | 'workflow_execution'
  | 'content_generation'
  | 'lead_processing'
  | 'automation_execution'
  | 'autonomous_agent'
  | 'ceo_assessment'
  | 'manager_assessment'
  | 'performance_optimization'
  | 'revenue_operation'
  | 'factory_operation'
  | 'sales_operation'
  | 'content_operation'
  | 'video_operation'
  | 'website_operation'
  | 'software_operation'
  | 'automation_operation'
  | 'outreach_operation'
  | 'voice_operation'
  | 'integration_operation'
  | 'growth_operation'
  | 'growth_execution'
  | 'production_execution'
  | 'reels_trend_scan'
  | 'reels_competitor_scan'
  | 'reels_generation'
  | 'reels_video_render'
  | 'reels_publish'
  | 'reels_analytics_sync'
  | 'reels_strategy_update'
  | 'reels_full_cycle'
  | 'development_cycle'
  | 'development_architect'
  | 'development_planner'
  | 'development_build'
  | 'development_validate'
  | 'development_refactor'
  | 'development_learn'
  | 'business_cycle'

export type JobRow = {
  id: string
  user_id: string
  job_type: string
  payload: Record<string, any>
  status: JobStatus
  priority: number
  max_retries: number
  retry_count: number
  progress_percentage: number
  execution_time_ms: number | null
  result: Record<string, any> | null
  error_msg: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string | null
}

export type EnqueueOpts = {
  priority?: number
  maxRetries?: number
  scheduledAt?: string
}

function exponentialBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 30000)
}

export async function enqueueJob(
  supabase: SupabaseClient,
  userId: string,
  jobType: string,
  payload: Record<string, any>,
  opts: EnqueueOpts = {}
): Promise<string> {
  const { data, error } = await supabase.from('job_queue').insert([{
    user_id: userId,
    job_type: jobType,
    payload,
    status: 'pending',
    priority: opts.priority ?? 0,
    max_retries: opts.maxRetries ?? 3,
    retry_count: 0,
    progress_percentage: 0,
    execution_time_ms: null,
    scheduled_at: opts.scheduledAt ?? null,
  }]).select('id').single()
  if (error) throw error
  return data.id
}

export async function cancelJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { error } = await supabase
    .from('job_queue')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['pending', 'running'])
  if (error) throw error
}

export async function dequeueNextJob(supabase: SupabaseClient): Promise<JobRow | null> {
  const { data: pending } = await supabase
    .from('job_queue')
    .select('*')
    .eq('status', 'pending')
    .or('scheduled_at.is.null,scheduled_at.lte.' + new Date().toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)

  if (!pending || pending.length === 0) return null

  const firstJob = pending[0] as JobRow
  const { data: updated } = await supabase
    .from('job_queue')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      progress_percentage: 10,
    })
    .eq('id', firstJob.id)
    .eq('status', 'pending')
    .select()
    .single()

  return (updated ?? null) as JobRow | null
}

export async function updateJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  percentage: number
): Promise<void> {
  await supabase
    .from('job_queue')
    .update({ progress_percentage: percentage, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

export async function completeJob(
  supabase: SupabaseClient,
  jobId: string,
  result: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from('job_queue')
    .update({
      status: 'completed',
      result,
      progress_percentage: 100,
      execution_time_ms: Math.round(Date.now() - new Date(result._started_at || Date.now()).getTime()),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
  if (error) throw error
}

export async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  errorMsg: string,
  retry: boolean = true
): Promise<void> {
  const { data: job } = await supabase
    .from('job_queue')
    .select('retry_count, max_retries, started_at')
    .eq('id', jobId)
    .single()

  if (!job) return

  const retryCount = (job.retry_count || 0) + 1
  const shouldRetry = retry && retryCount <= (job.max_retries || 3)

  const executionTime = job.started_at
    ? Date.now() - new Date(job.started_at).getTime()
    : 0

  const patch: Record<string, any> = {
    error_msg: errorMsg,
    retry_count: retryCount,
    execution_time_ms: executionTime,
    updated_at: new Date().toISOString(),
  }

  if (shouldRetry) {
    const backoffMs = exponentialBackoff(retryCount)
    patch.status = 'pending'
    patch.started_at = null
    patch.scheduled_at = new Date(Date.now() + backoffMs).toISOString()
    patch.progress_percentage = 0
  } else {
    patch.status = 'failed'
    patch.completed_at = new Date().toISOString()
    patch.progress_percentage = 100
  }

  const { error } = await supabase.from('job_queue').update(patch).eq('id', jobId)
  if (error) throw error
}

export async function fetchJobs(
  supabase: SupabaseClient,
  userId: string,
  status?: JobStatus,
  jobType?: string,
  limit = 50
): Promise<JobRow[]> {
  let q = supabase
    .from('job_queue')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) q = q.eq('status', status)
  if (jobType) q = q.eq('job_type', jobType)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as JobRow[]
}

export async function retryJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { error } = await supabase
    .from('job_queue')
    .update({
      status: 'pending',
      error_msg: null,
      retry_count: 0,
      progress_percentage: 0,
      execution_time_ms: null,
      started_at: null,
      completed_at: null,
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
  if (error) throw error
}

export async function getQueueStats(
  supabase: SupabaseClient,
  userId: string
): Promise<{ pending: number; running: number; completed: number; failed: number; cancelled: number; totalRetries: number }> {
  const { data } = await supabase
    .from('job_queue')
    .select('status, retry_count')
    .eq('user_id', userId)

  const rows = (data ?? []) as { status: string; retry_count: number }[]
  return {
    pending: rows.filter((r) => r.status === 'pending').length,
    running: rows.filter((r) => r.status === 'running').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    totalRetries: rows.reduce((sum, r) => sum + (r.retry_count || 0), 0),
  }
}
