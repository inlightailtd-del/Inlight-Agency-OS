import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getSalesMetrics, getSalesLeads, runFullSalesCycle, ensureSalesAgents } from '@/lib/sales/engine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function runSalesAction() {
  'use server'
  const supabase = await createClient()
  const { runFullSalesCycle, ensureSalesAgents } = await import('@/lib/sales/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureSalesAgents(supabase, user.id)
  await runFullSalesCycle(supabase, user.id)
  revalidatePath('/dashboard/sales')
  redirect('/dashboard/sales')
}

export default async function SalesPipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  await ensureSalesAgents(supabase, user.id)

  const [metrics, leads] = await Promise.all([
    getSalesMetrics(supabase, user.id),
    getSalesLeads(supabase, user.id),
  ])

  const stageColors: Record<string, string> = {
    new: 'bg-slate-100 text-slate-800', qualified: 'bg-blue-100 text-blue-800',
    contacted: 'bg-amber-100 text-amber-800', replied: 'bg-indigo-100 text-indigo-800',
    meeting_booked: 'bg-purple-100 text-purple-800', proposal_sent: 'bg-cyan-100 text-cyan-800',
    won: 'bg-emerald-100 text-emerald-800', lost: 'bg-red-100 text-red-800',
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sales Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous sales department — outreach, followups, proposals, and meetings.</p>
        </div>
        <form action={runSalesAction}>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Sales Cycle</Button>
        </form>
      </div>

      {/* Stage Funnel */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-6">
        {[
          { key: 'newLeads', label: 'New', value: metrics.newLeads, color: 'text-slate-700' },
          { key: 'qualified', label: 'Qualified', value: metrics.qualified, color: 'text-blue-700' },
          { key: 'contacted', label: 'Contacted', value: metrics.contacted, color: 'text-amber-700' },
          { key: 'replied', label: 'Replied', value: metrics.replied, color: 'text-indigo-700' },
          { key: 'meetingsBooked', label: 'Meeting', value: metrics.meetingsBooked, color: 'text-purple-700' },
          { key: 'proposalsSent', label: 'Proposal', value: metrics.proposalsSent, color: 'text-cyan-700' },
          { key: 'won', label: 'Won', value: metrics.won, color: 'text-emerald-700' },
          { key: 'lost', label: 'Lost', value: metrics.lost, color: 'text-red-700' },
        ].map((s) => (
          <div key={s.key} className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
            <p className="text-lg font-bold {s.color}">{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Conversion Rate Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Conversion Rate</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{metrics.conversionRate}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Pipeline Value</p>
            <p className="text-3xl font-bold text-slate-900">${metrics.pipelineValue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Sales Agents */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Sales Agents</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6">
          {[
            { name: 'Sales Director', role: 'Director / Strategist' },
            { name: 'Outreach Specialist', role: 'First Contact' },
            { name: 'Followup Specialist', role: 'Persistence' },
            { name: 'Proposal Writer', role: 'Proposals' },
            { name: 'Meeting Booker', role: 'Meetings' },
          ].map((agent) => (
            <div key={agent.name} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="font-medium text-sm text-slate-900">{agent.name}</p>
              <p className="text-xs text-slate-500 mt-1">{agent.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Pipeline Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Pipeline ({leads.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Lead</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Assignee</th>
                <th className="text-left px-4 py-3">Followups</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leads.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No leads in pipeline. Import leads to get started.</td></tr>
              ) : leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{lead.name}</td>
                  <td className="px-4 py-3 text-slate-500">{lead.company || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${stageColors[lead.status] || 'bg-slate-100'}`}>{lead.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${(lead.score || 0) >= 50 ? 'text-emerald-600' : (lead.score || 0) >= 20 ? 'text-amber-600' : 'text-slate-400'}`}>{lead.score || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{lead.assignee_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{lead.followup_count || 0}x</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
