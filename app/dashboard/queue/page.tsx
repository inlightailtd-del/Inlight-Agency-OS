import { createClient } from '@/lib/supabase/server'
import { fetchJobs, getQueueStats } from '@/lib/queue/queue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function processAction() {
  'use server'
  const supabase = await createClient()
  const { processNextJob } = await import('@/lib/queue/worker')
  await processNextJob(supabase)
  revalidatePath('/dashboard/queue')
  redirect('/dashboard/queue')
}

async function cancelJobAction(jobId: string) {
  'use server'
  const supabase = await createClient()
  const { cancelJob } = await import('@/lib/queue/queue')
  await cancelJob(supabase, jobId)
  revalidatePath('/dashboard/queue')
  redirect('/dashboard/queue')
}

async function retryJobAction(jobId: string) {
  'use server'
  const supabase = await createClient()
  const { retryJob } = await import('@/lib/queue/queue')
  await retryJob(supabase, jobId)
  revalidatePath('/dashboard/queue')
  redirect('/dashboard/queue')
}

const JOB_TYPES = ['all', 'agent_execution', 'workflow_execution', 'content_generation', 'lead_processing', 'automation_execution', 'autonomous_agent'] as const

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

export default async function QueuePage({ searchParams }: { searchParams?: { status?: string | string[]; type?: string | string[] } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const statusFilter = G(searchParams?.status) || undefined
  const typeFilterRaw = G(searchParams?.type)
  const typeFilter = typeFilterRaw && typeFilterRaw !== 'all' ? typeFilterRaw : undefined

  const [jobs, stats] = await Promise.all([
    fetchJobs(supabase, user.id, statusFilter as any, typeFilter),
    getQueueStats(supabase, user.id),
  ])

  const getStatusVariant = (s: string): 'default' | 'success' | 'warning' | 'destructive' | 'info' => {
    const map: Record<string, any> = { pending: 'info', running: 'warning', completed: 'success', failed: 'destructive', cancelled: 'default' }
    return map[s] ?? 'default'
  }

  const getTypeLabel = (t: string): string => {
    const map: Record<string, string> = {
      agent_execution: 'Agent Execution', workflow_execution: 'Workflow',
      content_generation: 'Content Gen', lead_processing: 'Lead Analysis',
      automation_execution: 'Automation', autonomous_agent: 'Auto Agent',
    }
    return map[t] ?? t
  }

  const getProgressColor = (p: number): string => {
    if (p >= 100) return 'bg-emerald-500'
    if (p >= 50) return 'bg-amber-500'
    return 'bg-sky-500'
  }

  const filterUrl = (p: Record<string, string>) => {
    const sp = new URLSearchParams()
    Object.entries({ status: statusFilter || '', type: typeFilterRaw || '', ...p }).forEach(([k, v]) => { if (v) sp.set(k, v) })
    return `/dashboard/queue?${sp.toString()}`
  }

  const statusFilters = ['all', 'pending', 'running', 'completed', 'failed', 'cancelled']

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Job Queue</h1>
          <p className="text-sm text-slate-500 mt-1">Background job processing with automatic retry and progress tracking.</p>
        </div>
        <div className="flex gap-3">
          <form action={processAction}>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Process Next Job</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard title="Pending" value={stats.pending} color="text-sky-600" />
        <StatCard title="Running" value={stats.running} color="text-amber-600" />
        <StatCard title="Completed" value={stats.completed} color="text-emerald-600" />
        <StatCard title="Failed" value={stats.failed} color="text-red-600" />
        <StatCard title="Cancelled" value={stats.cancelled} color="text-slate-500" />
        <StatCard title="Total Retries" value={stats.totalRetries} color="text-purple-600" />
      </div>

      <div className="grid gap-4 mb-6 md:grid-cols-2">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((key) => {
            const active = (statusFilter || 'all') === key
            return (
              <Link key={key} href={filterUrl({ status: key === 'all' ? '' : key })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Link>
            )
          })}
        </div>
        <div className="flex justify-end">
          <Link href={filterUrl({ type: typeFilterRaw === 'agent_execution' ? '' : 'agent_execution' })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${typeFilterRaw === 'agent_execution' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            Agent
          </Link>
          <Link href={filterUrl({ type: typeFilterRaw === 'workflow_execution' ? '' : 'workflow_execution' })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ml-2 ${typeFilterRaw === 'workflow_execution' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            Workflow
          </Link>
          <Link href={filterUrl({ type: typeFilterRaw === 'content_generation' ? '' : 'content_generation' })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ml-2 ${typeFilterRaw === 'content_generation' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            Content
          </Link>
          <Link href={filterUrl({ type: typeFilterRaw === 'lead_processing' ? '' : 'lead_processing' })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ml-2 ${typeFilterRaw === 'lead_processing' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            Lead
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Job History</h2>
        </div>
        {jobs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No jobs found.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {jobs.map((job) => (
              <div key={job.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm">{getTypeLabel(job.job_type)}</span>
                      <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                      {job.retry_count > 0 && (
                        <span className="text-xs text-amber-600">Retry {job.retry_count}/{job.max_retries}</span>
                      )}
                      {job.execution_time_ms != null && (
                        <span className="text-xs text-slate-400">{(job.execution_time_ms / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                    {job.progress_percentage > 0 && job.progress_percentage < 100 && job.status === 'running' && (
                      <div className="mt-2 h-2 w-full max-w-xs rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${getProgressColor(job.progress_percentage)} transition-all duration-500`} style={{ width: `${job.progress_percentage}%` }} />
                      </div>
                    )}
                    <div className="mt-1 text-xs text-slate-500 truncate">
                      {JSON.stringify(job.payload).slice(0, 140)}
                    </div>
                    {job.result && (
                      <div className="mt-1 text-xs text-slate-600 truncate">
                        Result: {JSON.stringify(job.result).slice(0, 140)}
                      </div>
                    )}
                    {job.error_msg && (
                      <div className="mt-1 text-xs text-red-600 truncate">{job.error_msg}</div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      <span>Created: {formatDateTime(job.created_at)}</span>
                      {job.started_at && <span>Started: {formatDateTime(job.started_at)}</span>}
                      {job.completed_at && <span>Completed: {formatDateTime(job.completed_at)}</span>}
                      {job.scheduled_at && job.status === 'pending' && <span>Scheduled: {formatDateTime(job.scheduled_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.status === 'failed' && (
                      <form action={retryJobAction.bind(null, job.id)}>
                        <Button type="submit" variant="outline" size="sm">Retry</Button>
                      </form>
                    )}
                    {(job.status === 'pending' || job.status === 'running') && (
                      <form action={cancelJobAction.bind(null, job.id)}>
                        <Button type="submit" variant="destructive" size="sm">Cancel</Button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
