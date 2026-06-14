import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getOutreachMetrics, getOutreachPipeline, runFullOutreachCycle, OUTREACH_STAGES } from '@/lib/outreach/engine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function runAction() {
  'use server'
  const supabase = await createClient()
  const { runFullOutreachCycle, ensureOutreachAgents } = await import('@/lib/outreach/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureOutreachAgents(supabase, user.id)
  await runFullOutreachCycle(supabase, user.id)
  revalidatePath('/dashboard/outreach')
  redirect('/dashboard/outreach')
}

const stageColors: Record<string, string> = {
  prospect_discovery: 'bg-slate-100 border-slate-300',
  enrichment: 'bg-blue-50 border-blue-300',
  qualification: 'bg-violet-50 border-violet-300',
  personalization: 'bg-amber-50 border-amber-300',
  outreach: 'bg-indigo-50 border-indigo-300',
  followup: 'bg-rose-50 border-rose-300',
  response: 'bg-green-50 border-green-300',
  appointment: 'bg-purple-50 border-purple-300',
  proposal: 'bg-cyan-50 border-cyan-300',
  closed: 'bg-emerald-50 border-emerald-400',
}

const stageLabels: Record<string, string> = {
  prospect_discovery: 'Discover', enrichment: 'Enrich', qualification: 'Qualify',
  personalization: 'Personalize', outreach: 'Outreach', followup: 'Followup',
  response: 'Response', appointment: 'Meeting', proposal: 'Proposal', closed: 'Closed',
}

export default async function OutreachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [metrics] = await Promise.all([
    getOutreachMetrics(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Outreach & Lead Gen</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous prospecting, outreach, followup, and deal closing.</p>
        </div>
        <form action={runAction}>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Outreach Cycle</Button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Campaigns" value={metrics.totalCampaigns} />
        <StatCard title="Active" value={metrics.activeCampaigns} color="text-emerald-600" />
        <StatCard title="Sent" value={metrics.sentCount} color="text-indigo-600" />
        <StatCard title="Replies" value={metrics.replyCount} color="text-purple-600" />
        <StatCard title="Meetings" value={metrics.meetingCount} color="text-rose-600" />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Conversion" value={`${metrics.conversionRate}%`} color={metrics.conversionRate >= 10 ? 'text-emerald-600' : 'text-amber-600'} />
        <StatCard title="Prospects" value={metrics.totalProspects} />
        <StatCard title="Messages" value={metrics.totalMessages} />
        <StatCard title="Appointments" value={metrics.totalAppointments} color="text-blue-600" />
        <StatCard title="Deals Pipeline" value={`$${metrics.dealsValue.toLocaleString()}`} color="text-emerald-600" />
      </div>

      {/* Outreach Team */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Outreach Team</h2>
        </div>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3 p-4">
          {['Lead Researcher','Data Enrichment','LinkedIn Spec','Cold Email','Cold DM','Personalization','Appt Setter','SDR','Deal Manager','Analytics'].map((name) => (
            <div key={name} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="font-medium text-[10px] text-slate-900 leading-tight">{name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 10-Stage Pipeline Bar */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Pipeline Overview</h2>
        </div>
        <div className="grid grid-cols-10 gap-2 p-4">
          {OUTREACH_STAGES.map((stage, i) => {
            const color = (stageColors[stage] || 'bg-slate-100').split(' ')[0]
            return (
              <div key={stage} className={`rounded-lg p-3 text-center border ${stageColors[stage] || 'border-slate-200'}`}>
                <p className="text-xs font-semibold text-slate-700">{i + 1}</p>
                <p className="text-[9px] text-slate-500 uppercase mt-1">{stageLabels[stage] || stage}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Integrations */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2 p-4">
          {['LinkedIn','Email','Gmail','Outlook','Apollo','Clay','Instantly','Smartlead','Calendly','HubSpot'].map((p) => (
            <div key={p} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="text-[10px] font-medium text-slate-700">{p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Deals Pipeline */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Deal Pipeline (${metrics.dealsValue.toLocaleString()})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Campaign</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Sent</th>
                <th className="text-left px-3 py-2">Replies</th>
                <th className="text-left px-3 py-2">Meetings</th>
                <th className="text-left px-3 py-2">Conversion</th>
                <th className="text-left px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {metrics.totalCampaigns === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400 text-xs">No campaigns yet. Run a cycle to start.</td></tr>
              ) : (
                <tr className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900 text-xs">Active Campaigns</td>
                  <td className="px-3 py-2"><Badge className="text-[8px]">{metrics.activeCampaigns} active</Badge></td>
                  <td className="px-3 py-2 text-xs text-slate-600">{metrics.sentCount}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{metrics.replyCount}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{metrics.meetingCount}</td>
                  <td className="px-3 py-2"><span className="text-xs font-mono text-emerald-600">{metrics.conversionRate}%</span></td>
                  <td className="px-3 py-2 text-xs text-slate-400">{metrics.totalCampaigns} campaigns</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
