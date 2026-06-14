import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDateTime } from '@/lib/utils'
import { getRevenueMetrics, runFullRevenueCycle } from '@/lib/revenue/engine'
import { fetchJobs } from '@/lib/queue/queue'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function runRevenueAction() {
  'use server'
  const supabase = await createClient()
  const { runFullRevenueCycle } = await import('@/lib/revenue/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runFullRevenueCycle(supabase, user.id)
  revalidatePath('/dashboard/revenue')
  redirect('/dashboard/revenue')
}

export default async function RevenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [metrics, revenueJobs] = await Promise.all([
    getRevenueMetrics(supabase, user.id),
    fetchJobs(supabase, user.id, undefined, 'revenue_operation', 20),
  ])

  const lastRun = revenueJobs[0]

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Autonomous Revenue Engine</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered lead acquisition, scoring, outreach, proposals, and meeting booking system.</p>
        </div>
        <form action={runRevenueAction}>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Revenue Cycle</Button>
        </form>
      </div>

      {lastRun?.result && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 mb-6">
          <p className="text-xs text-sky-700">
            Last cycle: {formatDateTime(lastRun.created_at)} — Scored: {lastRun.result.scored || 0}, Outreach: {lastRun.result.outreach || 0}, Proposals: {lastRun.result.proposals || 0}, Meetings: {lastRun.result.meetings || 0}
            {lastRun.execution_time_ms ? ` (${(lastRun.execution_time_ms / 1000).toFixed(1)}s)` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Leads" value={metrics.totalLeads} color="text-slate-900" />
        <StatCard title="Leads Today" value={metrics.leadsToday} color="text-sky-600" />
        <StatCard title="Conversion Rate" value={`${metrics.conversionRate}%`} color={metrics.conversionRate >= 20 ? 'text-emerald-600' : 'text-amber-600'} />
        <StatCard title="Revenue" value={formatPKR(metrics.revenueGenerated)} color="text-emerald-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Funnel */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue Funnel</h2>
          <div className="space-y-4">
            <FunnelRow label="Leads" value={metrics.totalLeads} color="bg-sky-500" max={Math.max(metrics.totalLeads, 1)} current={metrics.totalLeads} />
            <FunnelRow label="Outreach" value={metrics.outreachSent} color="bg-blue-500" max={Math.max(metrics.totalLeads, 1)} current={metrics.outreachSent} />
            <FunnelRow label="Proposals" value={metrics.proposalsGenerated} color="bg-indigo-500" max={Math.max(metrics.totalLeads, 1)} current={metrics.proposalsGenerated} />
            <FunnelRow label="Meetings" value={metrics.meetingsBooked} color="bg-violet-500" max={Math.max(metrics.totalLeads, 1)} current={metrics.meetingsBooked} />
            <FunnelRow label="Deals Closed" value={metrics.dealsClosed} color="bg-emerald-500" max={Math.max(metrics.totalLeads, 1)} current={metrics.dealsClosed} />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Pipeline Overview</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <MetricBox label="Leads Today" value={String(metrics.leadsToday)} color="text-sky-600" />
              <MetricBox label="Outreach Sent" value={String(metrics.outreachSent)} color="text-blue-600" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricBox label="Proposals" value={String(metrics.proposalsGenerated)} color="text-indigo-600" />
              <MetricBox label="Meetings Booked" value={String(metrics.meetingsBooked)} color="text-violet-600" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricBox label="Deals Closed" value={String(metrics.dealsClosed)} color="text-emerald-600" />
              <MetricBox label="Revenue" value={formatPKR(metrics.revenueGenerated)} color="text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Cycle History */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Revenue Cycle History</h2>
        </div>
        <div className="divide-y divide-slate-200 max-h-[400px] overflow-y-auto">
          {revenueJobs.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No revenue cycles run yet.</div>
          ) : (
            revenueJobs.map((job) => (
              <div key={job.id} className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'destructive' : 'info'}>{job.status}</Badge>
                    <span className="text-xs text-slate-500">{formatDateTime(job.created_at)}</span>
                  </div>
                  {job.execution_time_ms != null && <span className="text-xs text-slate-400">{(job.execution_time_ms / 1000).toFixed(1)}s</span>}
                </div>
                {job.result && (
                  <div className="flex gap-3 mt-1 text-xs text-slate-500">
                    <span>Scored: {job.result.scored || 0}</span>
                    <span>Outreach: {job.result.outreach || 0}</span>
                    <span>Proposals: {job.result.proposals || 0}</span>
                    <span>Meetings: {job.result.meetings || 0}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
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

function FunnelRow({ label, value, color, max, current }: { label: string; value: number; color: string; max: number; current: number }) {
  const pct = Math.round((current / max) * 100)
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
