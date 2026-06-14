import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getVoiceMetrics, runFullVoiceCycle } from '@/lib/voice/engine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function runAction() {
  'use server'
  const supabase = await createClient()
  const { runFullVoiceCycle, ensureVoiceAgents } = await import('@/lib/voice/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureVoiceAgents(supabase, user.id)
  await runFullVoiceCycle(supabase, user.id)
  revalidatePath('/dashboard/voice')
  redirect('/dashboard/voice')
}

export default async function VoicePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [metrics] = await Promise.all([
    getVoiceMetrics(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Voice AI Calling</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous AI calling — lead selection to customer handoff.</p>
        </div>
        <form action={runAction}>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Voice Cycle</Button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Campaigns" value={metrics.totalCampaigns} />
        <StatCard title="Active" value={metrics.activeCampaigns} color="text-emerald-600" />
        <StatCard title="Total Calls" value={metrics.totalCalls} color="text-indigo-600" />
        <StatCard title="Connected" value={metrics.connectedCalls} color="text-blue-600" />
        <StatCard title="Appointments" value={metrics.appointmentsBooked} color="text-purple-600" />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Deals Closed" value={metrics.dealsClosed} color="text-emerald-600" />
        <StatCard title="Conversion" value={`${metrics.conversionRate}%`} color={metrics.conversionRate >= 30 ? 'text-emerald-600' : 'text-amber-600'} />
        <StatCard title="Total Duration" value={`${metrics.totalDurationMin} min`} />
        <StatCard title="Avg Call" value={`${metrics.avgCallDurationSec}s`} />
        <StatCard title="Top Agent Score" value={`${metrics.topAgentScore}%`} color="text-rose-600" />
      </div>

      {/* Voice AI Team */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Voice AI Team</h2>
        </div>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3 p-4">
          {['Call Strategist','Cold Caller','Appt Setter','Sales Closer','Objection Handler','Qualification','Follow-up','Success','Analytics','Manager'].map((name) => (
            <div key={name} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="font-medium text-[10px] text-slate-900 leading-tight">{name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 10-Stage Pipeline */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Pipeline</h2>
        </div>
        <div className="grid grid-cols-10 gap-2 p-4">
          {[
            ['Select','bg-slate-100'],['Qualify','bg-blue-100'],['Prepare','bg-violet-100'],
            ['Call','bg-indigo-100'],['Objections','bg-rose-100'],['Followup','bg-amber-100'],
            ['Book','bg-purple-100'],['Proposal','bg-cyan-100'],['Close','bg-emerald-100'],
            ['Handoff','bg-teal-100'],
          ].map(([label, color], i) => (
            <div key={label} className={`rounded-lg p-3 text-center border ${color} border-slate-200`}>
              <p className="text-xs font-semibold text-slate-700">{i + 1}</p>
              <p className="text-[9px] text-slate-500 uppercase mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2 p-4">
          {['Twilio','Bland AI','Vapi','Retell AI','ElevenLabs','OpenAI Realtime','Calendly','HubSpot','Google Calendar','Outlook Calendar'].map((p) => (
            <div key={p} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="text-[10px] font-medium text-slate-700">{p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Call Center Summary */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Call Center Summary</h2>
        </div>
        <div className="p-4 text-xs text-slate-500 space-y-2">
          <div className="flex items-center justify-between">
            <span>Total Calls</span>
            <span className="font-medium text-slate-700">{metrics.totalCalls}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Connected</span>
            <span className="font-medium text-slate-700">{metrics.connectedCalls}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Connect Rate</span>
            <span className="font-medium text-emerald-600">{metrics.totalCalls > 0 ? Math.round((metrics.connectedCalls / metrics.totalCalls) * 100) : 0}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Appt → Deal Rate</span>
            <span className="font-medium text-emerald-600">{metrics.appointmentsBooked > 0 ? Math.round((metrics.dealsClosed / metrics.appointmentsBooked) * 100) : 0}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Voice Agents</span>
            <span className="font-medium text-slate-700">{metrics.totalAgents}</span>
          </div>
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
