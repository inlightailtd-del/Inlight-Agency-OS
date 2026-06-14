import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { formatDateTime } from '@/lib/utils'
import { getLastCeoAssessment, getCeoRunStats } from '@/lib/ceo/ceo'
import { getCeoSchedulerConfig } from '@/lib/ceo/scheduler'
import { fetchJobs } from '@/lib/queue/queue'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function runCeoAction() {
  'use server'
  const supabase = await createClient()
  const { runCeoAssessment } = await import('@/lib/ceo/ceo')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runCeoAssessment(supabase, user.id)
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo')
}

async function toggleSchedulerAction(enabled: boolean) {
  'use server'
  const supabase = await createClient()
  const { updateCeoSchedulerConfig } = await import('@/lib/ceo/scheduler')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await updateCeoSchedulerConfig(supabase, user.id, { enabled })
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo')
}

async function setIntervalAction(fd: FormData) {
  'use server'
  const minutes = parseInt(String(fd.get('interval') || '30'), 10)
  const supabase = await createClient()
  const { updateCeoSchedulerConfig } = await import('@/lib/ceo/scheduler')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await updateCeoSchedulerConfig(supabase, user.id, { intervalMinutes: minutes })
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo')
}

export default async function CeoDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [assessment, stats, schedulerConfig, ceoJobs] = await Promise.all([
    getLastCeoAssessment(supabase, user.id),
    getCeoRunStats(supabase, user.id),
    getCeoSchedulerConfig(supabase, user.id),
    fetchJobs(supabase, user.id, undefined, 'ceo_assessment', 50),
  ])

  const { data: ceoLogs } = await supabase
    .from('execution_logs')
    .select('created_at, action, message')
    .eq('user_id', user.id)
    .ilike('action', '[CEO]%')
    .order('created_at', { ascending: false })
    .limit(30)

  const successfulDecisions = assessment?.decisions?.filter((d: any) => d.executed).length || 0
  const failedDecisions = assessment?.decisions?.filter((d: any) => !d.executed).length || 0
  const activeCeoJob = ceoJobs.find((j) => j.status === 'pending' || j.status === 'running')

  const getDecisionVariant = (type: string): 'default' | 'success' | 'warning' | 'destructive' | 'info' => {
    const map: Record<string, any> = {
      create_task: 'info', launch_workflow: 'success',
      create_content: 'default', create_lead_task: 'warning', enqueue_job: 'info',
    }
    return map[type] ?? 'default'
  }

  const getJobStatusVariant = (s: string): 'default' | 'success' | 'warning' | 'destructive' | 'info' => {
    const map: Record<string, any> = { pending: 'info', running: 'warning', completed: 'success', failed: 'destructive', cancelled: 'default' }
    return map[s] ?? 'default'
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Autonomous CEO Agent</h1>
          <p className="text-sm text-slate-500 mt-1">AI-driven executive management. Reviews system state, generates assessments, and takes autonomous actions.</p>
        </div>
        <div className="flex gap-3">
          <form action={toggleSchedulerAction.bind(null, !schedulerConfig.enabled)}>
            <Button type="submit" variant="outline" className={schedulerConfig.enabled ? 'text-emerald-600 border-emerald-300' : ''}>
              {schedulerConfig.enabled ? 'Autonomous: ON' : 'Autonomous: OFF'}
            </Button>
          </form>
          {activeCeoJob && (
            <Badge variant="warning" className="self-center">CEO Running</Badge>
          )}
          <form action={runCeoAction}>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!!activeCeoJob}>
              Run CEO Cycle
            </Button>
          </form>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="CEO Runs" value={stats.totalRuns} color="text-slate-900" />
        <StatCard title="Decisions Made" value={stats.totalDecisions} color="text-emerald-600" />
        <StatCard title="Successful" value={successfulDecisions} color="text-sky-600" />
        <StatCard title="Failed Decisions" value={failedDecisions} color="text-red-600" />
      </div>

      {/* Scheduler Controls */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Autonomous Scheduling</h2>
            <p className="text-sm text-slate-500 mt-1">
              {schedulerConfig.enabled
                ? `Running every ${schedulerConfig.intervalMinutes} minutes. CEO assessments are automatically enqueued.`
                : 'Scheduler is disabled. Run CEO cycles manually.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <form action={setIntervalAction} className="flex items-center gap-2">
              <Select name="interval" defaultValue={String(schedulerConfig.intervalMinutes)} className="w-24">
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="120">2 hours</option>
                <option value="360">6 hours</option>
                <option value="720">12 hours</option>
              </Select>
              <Button type="submit" variant="outline" size="sm">Set</Button>
            </form>
            <form action={toggleSchedulerAction.bind(null, !schedulerConfig.enabled)}>
              <Button type="submit" variant={schedulerConfig.enabled ? 'destructive' : 'default'} size="sm">
                {schedulerConfig.enabled ? 'Disable' : 'Enable'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* CEO Activity Timeline */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Assessment Timeline */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Assessment History</h2>
          </div>
          <div className="divide-y divide-slate-200 max-h-[400px] overflow-y-auto">
            {ceoJobs.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No CEO runs yet.</div>
            ) : (
              ceoJobs.map((job) => (
                <div key={job.id} className="px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={getJobStatusVariant(job.status)} className="text-[10px]">{job.status}</Badge>
                      <span className="text-xs text-slate-500">{formatDateTime(job.created_at)}</span>
                    </div>
                    {job.execution_time_ms != null && (
                      <span className="text-xs text-slate-400">{(job.execution_time_ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  {job.result && (
                    <p className="text-xs text-slate-600 mt-1 truncate">
                      {job.result.summary ? job.result.summary.slice(0, 120) : JSON.stringify(job.result).slice(0, 120)}
                    </p>
                  )}
                  {job.error_msg && <p className="text-xs text-red-600 mt-1">{job.error_msg}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Decision Log */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Activity Log</h2>
          </div>
          <div className="divide-y divide-slate-200 max-h-[400px] overflow-y-auto">
            {(!ceoLogs || ceoLogs.length === 0) ? (
              <div className="p-6 text-center text-sm text-slate-500">No CEO activity yet.</div>
            ) : (
              ceoLogs.map((log: any, i: number) => (
                <div key={i} className="px-6 py-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-medium text-slate-700">{log.action.replace('[CEO] ', '')}</span>
                    <span>{formatDateTime(log.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Current Assessment */}
      {assessment ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Latest Executive Assessment</h2>
            <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{assessment.summary}</p>
            {assessment.generatedAt && (
              <p className="text-xs text-slate-400 mt-4">Generated: {formatDateTime(assessment.generatedAt)}</p>
            )}
          </div>

          {assessment.insights.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Insights</h2>
              <ul className="space-y-2">
                {assessment.insights.map((insight: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-amber-500 mt-0.5 shrink-0">&#9679;</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.decisions.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Last Decisions Executed ({successfulDecisions} ok, {failedDecisions} failed)</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {assessment.decisions.map((d: any, i: number) => (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getDecisionVariant(d.type)} className="text-[10px]">{d.type.replace(/_/g, ' ')}</Badge>
                          <Badge variant={d.priority === 'high' ? 'destructive' : d.priority === 'medium' ? 'warning' : 'default'} className="text-[10px]">{d.priority}</Badge>
                          <span className={`text-xs font-medium ${d.executed ? 'text-emerald-600' : 'text-red-600'}`}>
                            {d.executed ? 'Executed' : 'Failed'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mt-1">{d.description}</p>
                        {d.result && <p className="text-xs text-slate-500 mt-1">{d.result}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">System Metrics at Assessment</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricRow label="Failed Jobs" value={assessment.metrics.totalFailedJobs} />
              <MetricRow label="Pending Workflows" value={assessment.metrics.pendingWorkflows} />
              <MetricRow label="Draft Content" value={assessment.metrics.draftContent} />
              <MetricRow label="Unconverted Leads" value={assessment.metrics.unconvertedLeads} />
              <MetricRow label="Completed Tasks" value={assessment.metrics.completedTasks} />
              <MetricRow label="Total Retries" value={assessment.metrics.totalRetries} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500 mb-4">No CEO assessments yet. Run your first CEO cycle to get AI-powered executive insights and autonomous actions.</p>
          <form action={runCeoAction}>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run First CEO Cycle</Button>
          </form>
        </div>
      )}
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

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 mt-0.5">{value}</p>
    </div>
  )
}
