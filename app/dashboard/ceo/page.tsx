import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getLastCeoAssessment, getCeoRunStats } from '@/lib/ceo/ceo'
import { getCeoSchedulerConfig } from '@/lib/ceo/scheduler'
import { getLatestBriefing, getBriefingStats } from '@/lib/ceo/briefings'
import { getLatestMeetingSimulation, getMeetingStats } from '@/lib/ceo/meeting-simulator'
import { getLatestVoiceReport, getVoiceReportStats } from '@/lib/ceo/voice-reports'
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

async function runMorningBriefingAction() {
  'use server'
  const supabase = await createClient()
  const { runMorningBriefing } = await import('@/lib/ceo/briefings')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runMorningBriefing(supabase, user.id)
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo?tab=briefings')
}

async function runEveningBriefingAction() {
  'use server'
  const supabase = await createClient()
  const { runEveningBriefing } = await import('@/lib/ceo/briefings')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runEveningBriefing(supabase, user.id)
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo?tab=briefings')
}

async function runPnLAction() {
  'use server'
  const supabase = await createClient()
  const { runPnLAnalysis } = await import('@/lib/ceo/briefings')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runPnLAnalysis(supabase, user.id)
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo?tab=financial')
}

async function runCashflowAction() {
  'use server'
  const supabase = await createClient()
  const { runCashflowPrediction } = await import('@/lib/ceo/briefings')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runCashflowPrediction(supabase, user.id)
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo?tab=financial')
}

async function runBudgetAction() {
  'use server'
  const supabase = await createClient()
  const { runAutoBudgetSuggestions } = await import('@/lib/ceo/briefings')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runAutoBudgetSuggestions(supabase, user.id)
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo?tab=budget')
}

async function runMeetingAction(type: string) {
  'use server'
  const supabase = await createClient()
  const { runMeetingSimulation } = await import('@/lib/ceo/meeting-simulator')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runMeetingSimulation(supabase, user.id, type as any)
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo?tab=meetings')
}

async function runVoiceReportAction(type: string) {
  'use server'
  const supabase = await createClient()
  const { generateVoiceReport } = await import('@/lib/ceo/voice-reports')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await generateVoiceReport(supabase, user.id, type as any)
  revalidatePath('/dashboard/ceo')
  redirect('/dashboard/ceo?tab=voice')
}

export default async function CeoDashboardPage(props: { searchParams?: { tab?: string } }) {
  const tab = props.searchParams?.tab || 'overview'
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

  const getJobStatusVariant = (s: string) => {
    const map: Record<string, any> = { pending: 'info', running: 'warning', completed: 'success', failed: 'destructive', cancelled: 'default' }
    return map[s] ?? 'default'
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'briefings', label: 'Briefings' },
    { id: 'financial', label: 'P&L / Cashflow' },
    { id: 'budget', label: 'Budget' },
    { id: 'meetings', label: 'Meetings' },
    { id: 'voice', label: 'Voice Reports' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Autonomous CEO Agent</h1>
          <p className="text-sm text-slate-500 mt-1">Executive management, briefings, financial analysis, meetings, and voice reports.</p>
        </div>
        <div className="flex gap-3 items-center">
          <form action={toggleSchedulerAction.bind(null, !schedulerConfig.enabled)}>
            <Button type="submit" variant="outline" className={schedulerConfig.enabled ? 'text-emerald-600 border-emerald-300' : ''}>
              {schedulerConfig.enabled ? 'Autonomous: ON' : 'Autonomous: OFF'}
            </Button>
          </form>
          {activeCeoJob && <Badge variant="warning">CEO Running</Badge>}
          <form action={runCeoAction}>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!!activeCeoJob}>
              Run CEO Cycle
            </Button>
          </form>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="CEO Runs" value={stats.totalRuns} />
        <StatCard title="Decisions Made" value={stats.totalDecisions} />
        <StatCard title="Successful" value={successfulDecisions} color="text-emerald-600" />
        <StatCard title="Failed" value={failedDecisions} color="text-red-600" />
      </div>

      {/* Scheduler Controls */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Autonomous Scheduling</h2>
            <p className="text-sm text-slate-500 mt-1">
              {schedulerConfig.enabled
                ? `Running every ${schedulerConfig.intervalMinutes} minutes.`
                : 'Scheduler is disabled.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <form action={setIntervalAction} className="flex items-center gap-2">
              <select name="interval" defaultValue={String(schedulerConfig.intervalMinutes)} className="border border-slate-300 rounded px-2 py-1 text-sm">
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="120">2 hours</option>
                <option value="360">6 hours</option>
                <option value="720">12 hours</option>
              </select>
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

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`/dashboard/ceo${t.id === 'overview' ? '' : `?tab=${t.id}`}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <OverviewTab assessment={assessment} successfulDecisions={successfulDecisions} failedDecisions={failedDecisions} ceoJobs={ceoJobs} ceoLogs={(ceoLogs ?? []) as any[]} getJobStatusVariant={getJobStatusVariant} runCeoAction={runCeoAction} />
      )}

      {tab === 'briefings' && (
        <BriefingsTab supabase={supabase} userId={user.id} />
      )}

      {tab === 'financial' && (
        <FinancialTab supabase={supabase} userId={user.id} />
      )}

      {tab === 'budget' && (
        <BudgetTab supabase={supabase} userId={user.id} />
      )}

      {tab === 'meetings' && (
        <MeetingsTab supabase={supabase} userId={user.id} />
      )}

      {tab === 'voice' && (
        <VoiceTab supabase={supabase} userId={user.id} />
      )}
    </div>
  )
}

/* ─────── T A B   C O M P O N E N T S ─────── */

async function OverviewTab({
  assessment, successfulDecisions, failedDecisions, ceoJobs, ceoLogs, getJobStatusVariant, runCeoAction,
}: {
  assessment: any; successfulDecisions: number; failedDecisions: number; ceoJobs: any[]; ceoLogs: any[]
  getJobStatusVariant: (s: string) => any; runCeoAction: () => Promise<void>
}) {
  const getDecisionVariant = (type: string) => {
    const map: Record<string, any> = {
      create_task: 'info', launch_workflow: 'success',
      create_content: 'default', create_lead_task: 'warning', enqueue_job: 'info',
    }
    return map[type] ?? 'default'
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 mb-6">
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

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Activity Log</h2>
        </div>
        <div className="divide-y divide-slate-200 max-h-[400px] overflow-y-auto">
          {ceoLogs.length === 0 ? (
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

      {assessment && (
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Latest Executive Assessment</h2>
            <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{assessment.summary}</p>
            {assessment.generatedAt && (
              <p className="text-xs text-slate-400 mt-4">Generated: {formatDateTime(assessment.generatedAt)}</p>
            )}
          </div>

          {assessment.insights?.length > 0 && (
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

          {assessment.decisions?.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Last Decisions ({successfulDecisions} ok, {failedDecisions} failed)</h2>
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

          {assessment.metrics && (
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">System Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <MetricRow label="Failed Jobs" value={assessment.metrics.totalFailedJobs} />
                <MetricRow label="Pending Workflows" value={assessment.metrics.pendingWorkflows} />
                <MetricRow label="Draft Content" value={assessment.metrics.draftContent} />
                <MetricRow label="Unconverted Leads" value={assessment.metrics.unconvertedLeads} />
                <MetricRow label="Completed Tasks" value={assessment.metrics.completedTasks} />
                <MetricRow label="Total Retries" value={assessment.metrics.totalRetries} />
              </div>
            </div>
          )}
        </div>
      )}

      {!assessment && (
        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500 mb-4">No CEO assessments yet. Run your first CEO cycle.</p>
          <form action={runCeoAction}>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run First CEO Cycle</Button>
          </form>
        </div>
      )}
    </div>
  )
}

async function BriefingsTab({ supabase: _supabase, userId }: { supabase: any; userId: string }) {
  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient())
  const [morningBriefing, eveningBriefing, briefingStats] = await Promise.all([
    getLatestBriefing(supabase, userId, 'morning'),
    getLatestBriefing(supabase, userId, 'evening'),
    getBriefingStats(supabase, userId),
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Morning Briefings" value={briefingStats.totalMorning} />
        <StatCard title="Evening Briefings" value={briefingStats.totalEvening} />
        {briefingStats.lastMorning && <StatCard title="Last Morning" value={formatDateTime(briefingStats.lastMorning)!} />}
        {briefingStats.lastEvening && <StatCard title="Last Evening" value={formatDateTime(briefingStats.lastEvening)!} />}
      </div>

      <div className="flex gap-4 mb-4">
        <form action={runMorningBriefingAction}>
          <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white">Run Morning Briefing</Button>
        </form>
        <form action={runEveningBriefingAction}>
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">Run Evening Briefing</Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {morningBriefing && (
          <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-800 mb-3">Latest Morning Briefing</h2>
            <p className="text-xs text-slate-400 mb-3">{formatDateTime(morningBriefing.date)}</p>
            <p className="text-sm text-slate-700 leading-7 mb-4">{morningBriefing.summary}</p>
            {morningBriefing.sections?.map((s: any, i: number) => (
              <div key={i} className="mb-3 pb-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.priority === 'high' ? 'bg-red-100 text-red-700' : s.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{s.priority}</span>
                  <span className="font-medium text-sm text-slate-800">{s.title}</span>
                </div>
                <p className="text-xs text-slate-600">{s.content}</p>
              </div>
            ))}
            {morningBriefing.actionItems?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Action Items</h3>
                <ul className="space-y-1">
                  {morningBriefing.actionItems.map((a: any, i: number) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                      {a.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {eveningBriefing && (
          <div className="rounded-lg border border-indigo-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-indigo-800 mb-3">Latest Evening Briefing</h2>
            <p className="text-xs text-slate-400 mb-3">{formatDateTime(eveningBriefing.date)}</p>
            <p className="text-sm text-slate-700 leading-7 mb-4">{eveningBriefing.summary}</p>
            {eveningBriefing.sections?.map((s: any, i: number) => (
              <div key={i} className="mb-3 pb-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.priority === 'high' ? 'bg-red-100 text-red-700' : s.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{s.priority}</span>
                  <span className="font-medium text-sm text-slate-800">{s.title}</span>
                </div>
                <p className="text-xs text-slate-600">{s.content}</p>
              </div>
            ))}
            {eveningBriefing.actionItems?.map((a: any, i: number) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                {a.description}
              </li>
            ))}
          </div>
        )}

        {!morningBriefing && !eveningBriefing && (
          <div className="lg:col-span-2 text-center text-slate-500 py-12">No briefings yet. Run a morning or evening briefing to get started.</div>
        )}
      </div>
    </div>
  )
}

async function FinancialTab({ supabase: _supabase, userId }: { supabase: any; userId: string }) {
  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient())

  const { data: pnlMemories } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'ceo_pnl_analysis')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: cfMemories } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'ceo_cashflow_prediction')
    .order('created_at', { ascending: false })
    .limit(1)

  const pnlData = (pnlMemories?.[0] as any)?.content
  const cfData = (cfMemories?.[0] as any)?.content

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-4">
        <form action={runPnLAction}>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Run P&L Analysis</Button>
        </form>
        <form action={runCashflowAction}>
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">Run Cashflow Prediction</Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {pnlData && (
          <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-blue-800 mb-1">P&L Analysis</h2>
            <p className="text-xs text-slate-400 mb-4">Period: {pnlData.period}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-emerald-50 rounded p-3">
                <p className="text-xs text-emerald-600">Revenue</p>
                <p className="text-lg font-bold text-emerald-800">PKR {pnlData.revenue?.total?.toLocaleString() || 0}</p>
                <p className="text-xs text-emerald-500">{pnlData.revenue?.count || 0} invoices</p>
              </div>
              <div className="bg-red-50 rounded p-3">
                <p className="text-xs text-red-600">Expenses</p>
                <p className="text-lg font-bold text-red-800">PKR {pnlData.expenses?.total?.toLocaleString() || 0}</p>
                <p className="text-xs text-red-500">{pnlData.expenses?.count || 0} expenses</p>
              </div>
              <div className="bg-blue-50 rounded p-3">
                <p className="text-xs text-blue-600">Gross Profit</p>
                <p className="text-lg font-bold text-blue-800">PKR {pnlData.grossProfit?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-purple-50 rounded p-3">
                <p className="text-xs text-purple-600">Profit Margin</p>
                <p className={`text-lg font-bold ${pnlData.profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {pnlData.profitMargin}%
                </p>
              </div>
            </div>
            {pnlData.breakdowns?.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Breakdown</h3>
                {pnlData.breakdowns.map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-600">{b.category}</span>
                    <span className="font-medium">{b.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
            {pnlData.insights?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">AI Insights</h3>
                <ul className="space-y-1">
                  {pnlData.insights.map((i: string, idx: number) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">&#9679;</span>
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {cfData && (
          <div className="rounded-lg border border-purple-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-purple-800 mb-1">Cashflow Prediction</h2>
            <p className="text-xs text-slate-400 mb-4">Risk Level: <span className={`font-medium ${cfData.riskLevel === 'high' ? 'text-red-600' : cfData.riskLevel === 'medium' ? 'text-amber-600' : 'text-emerald-600'}`}>{cfData.riskLevel}</span></p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-emerald-50 rounded p-3">
                <p className="text-xs text-emerald-600">Current Balance</p>
                <p className="text-lg font-bold text-emerald-800">PKR {cfData.currentBalance?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-blue-50 rounded p-3">
                <p className="text-xs text-blue-600">Projections</p>
                <p className="text-lg font-bold text-blue-800">{cfData.netProjection?.length || 0} months</p>
              </div>
            </div>
            {cfData.netProjection?.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Monthly Projections</h3>
                {cfData.netProjection.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-600">{p.month}</span>
                    <span className={`font-medium ${p.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      PKR {p.amount?.toLocaleString() || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {cfData.recommendations?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Recommendations</h3>
                <ul className="space-y-1">
                  {cfData.recommendations.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5">&#9679;</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!pnlData && !cfData && (
          <div className="lg:col-span-2 text-center text-slate-500 py-12">No financial data yet. Run a P&L analysis or cashflow prediction.</div>
        )}
      </div>
    </div>
  )
}

async function BudgetTab({ supabase: _supabase, userId }: { supabase: any; userId: string }) {
  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient())

  const { data } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'ceo_budget_suggestions')
    .order('created_at', { ascending: false })
    .limit(1)

  const suggestions = ((data as any[])?.[0]?.content?.suggestions || []) as any[]

  return (
    <div className="space-y-6">
      <form action={runBudgetAction}>
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white">Generate Budget Suggestions</Button>
      </form>

      {suggestions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((s: any, i: number) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-800 capitalize">{s.category}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.priority === 'high' ? 'bg-red-100 text-red-700' : s.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{s.priority}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-500">Current</p>
                  <p className="text-sm font-semibold text-slate-700">PKR {s.currentSpend?.toLocaleString() || 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Suggested</p>
                  <p className="text-sm font-semibold text-emerald-600">PKR {s.suggestedBudget?.toLocaleString() || 0}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-2">{s.reasoning}</p>
              <p className="text-xs text-emerald-600 font-medium">{s.expectedImpact}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-slate-500 py-12">No budget suggestions yet. Run budget analysis to get started.</div>
      )}
    </div>
  )
}

async function MeetingsTab({ supabase: _supabase, userId }: { supabase: any; userId: string }) {
  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient())
  const [latestMeeting, meetingStats] = await Promise.all([
    getLatestMeetingSimulation(supabase, userId),
    getMeetingStats(supabase, userId),
  ])

  const meetingTypes = ['board', 'quarterly_review', 'strategy', 'one_on_one', 'all_hands']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Meetings" value={meetingStats.totalMeetings} />
        {Object.entries(meetingStats.meetingsByType).slice(0, 3).map(([type, count]) => (
          <StatCard key={type} title={type.replace(/_/g, ' ')} value={count as number} />
        ))}
        {meetingStats.lastMeeting && <StatCard title="Last Meeting" value={formatDateTime(meetingStats.lastMeeting)!} />}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {meetingTypes.map((type) => (
          <form key={type} action={runMeetingAction.bind(null, type)}>
            <Button type="submit" variant="outline" className="capitalize">
              Simulate {type.replace(/_/g, ' ')}
            </Button>
          </form>
        ))}
      </div>

      {latestMeeting && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{latestMeeting.title}</h2>
              <p className="text-xs text-slate-400">{formatDateTime(latestMeeting.date)}</p>
            </div>
            <Badge className="capitalize">{latestMeeting.type?.replace(/_/g, ' ')}</Badge>
          </div>

          <p className="text-sm text-slate-700 mb-6">{latestMeeting.summary}</p>

          {latestMeeting.participants?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Participants ({latestMeeting.participants.length})</h3>
              <div className="flex flex-wrap gap-2">
                {latestMeeting.participants.map((p: any, i: number) => (
                  <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                    {p.name} <span className="text-slate-400">({p.role})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {latestMeeting.agenda?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Agenda</h3>
              <div className="space-y-1">
                {latestMeeting.agenda.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-700">{i + 1}. {a.topic}</span>
                    <span className="text-slate-400">{a.duration_minutes}min</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestMeeting.decisions?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Decisions ({latestMeeting.decisions.length})</h3>
              {latestMeeting.decisions.map((d: any, i: number) => (
                <div key={i} className="text-xs text-slate-600 py-1 border-b border-slate-100 last:border-0">
                  <span className="font-medium">{d.decision}</span>
                  {d.reasoning && <span className="text-slate-400"> — {d.reasoning}</span>}
                </div>
              ))}
            </div>
          )}

          {latestMeeting.actionItems?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Action Items</h3>
              {latestMeeting.actionItems.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-600 py-1 border-b border-slate-100 last:border-0">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  <div>
                    <span>{a.action}</span>
                    <span className="text-slate-400"> — {a.assignee}, by {a.deadline}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!latestMeeting && (
        <div className="text-center text-slate-500 py-12">No meetings yet. Simulate a meeting to get started.</div>
      )}
    </div>
  )
}

async function VoiceTab({ supabase: _supabase, userId }: { supabase: any; userId: string }) {
  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient())
  const [report, stats] = await Promise.all([
    getLatestVoiceReport(supabase, userId),
    getVoiceReportStats(supabase, userId),
  ])

  const reportTypes = ['daily_brief', 'weekly_review', 'alert', 'status_update']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Voice Reports" value={stats.totalReports} />
        {stats.lastReport && <StatCard title="Last Report" value={formatDateTime(stats.lastReport)!} />}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {reportTypes.map((type) => (
          <form key={type} action={runVoiceReportAction.bind(null, type)}>
            <Button type="submit" variant="outline" className="capitalize">
              {type.replace(/_/g, ' ')}
            </Button>
          </form>
        ))}
      </div>

      {report && (
        <div className="rounded-lg border border-violet-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-violet-800">{report.title}</h2>
              <p className="text-xs text-slate-400">{formatDateTime(report.generatedAt)}</p>
            </div>
            <span className="text-xs text-slate-400">~{report.duration_seconds}s narration</span>
          </div>

          <div className="bg-violet-50 rounded-lg p-4 mb-4 italic text-sm text-slate-700 leading-7">
            &ldquo;{report.narration}&rdquo;
          </div>

          {report.sections?.map((s: any, i: number) => (
            <div key={i} className="mb-3 pb-3 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.tone === 'urgent' ? 'bg-red-100 text-red-700' : s.tone === 'positive' ? 'bg-emerald-100 text-emerald-700' : s.tone === 'concerned' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{s.tone}</span>
                <span className="font-medium text-sm text-slate-800">{s.heading}</span>
              </div>
              <p className="text-xs text-slate-600">{s.content}</p>
            </div>
          ))}
        </div>
      )}

      {!report && (
        <div className="text-center text-slate-500 py-12">No voice reports yet. Generate a voice report to get started.</div>
      )}
    </div>
  )
}

/* ─────── U T I L I T Y   C O M P O N E N T S ─────── */

function StatCard({ title, value, color }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-slate-900'}`}>{value}</p>
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
