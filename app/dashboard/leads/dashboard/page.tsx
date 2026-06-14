import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'; import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { fetchLeads, leadSources, leadStatuses, getSourceLabel, getStatusVariant, getStatusLabel } from '@/lib/supabase/leads'

export default async function LeadsDashboardPage() {
  const supabase = await createClient(); const leads = await fetchLeads(supabase)
  const total = leads.length; const converted = leads.filter((l) => l.status === 'converted').length
  const convRate = total > 0 ? Math.round((converted / total) * 100) : 0
  const pipelineValue = leads.filter((l) => l.status !== 'lost' && l.status !== 'converted').reduce((s, l) => s + l.score, 0)
  const avgScore = total > 0 ? Math.round(leads.reduce((s, l) => s + l.score, 0) / total) : 0

  const sourceDist = leadSources.map((s) => ({ name: getSourceLabel(s), key: s, count: leads.filter((l) => l.source === s).length }))
  const statusDist = leadStatuses.map((s) => ({ name: getStatusLabel(s), key: s, count: leads.filter((l) => l.status === s).length }))

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Lead Analytics</h1><p className="text-sm text-slate-500 mt-1">Conversion metrics, pipeline analysis, and lead source distribution.</p></div>
        <Link href="/dashboard/leads"><Button variant="outline">Back</Button></Link>
      </div>
      {total === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No leads yet.</p></div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPI title="Total Leads" value={total} /><KPI title="Conversion Rate" value={`${convRate}%`} color="text-emerald-600" />
            <KPI title="Pipeline Value" value={pipelineValue} color="text-sky-600" /><KPI title="Avg Score" value={avgScore} color="text-indigo-600" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI title="Converted" value={converted} color="text-emerald-600" /><KPI title="Qualified" value={leads.filter((l) => l.status === 'qualified').length} color="text-sky-600" />
            <KPI title="Lost" value={leads.filter((l) => l.status === 'lost').length} color="text-red-600" /><KPI title="New" value={leads.filter((l) => l.status === 'new').length} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">By Source</h2><div className="space-y-4">{sourceDist.filter((s) => s.count > 0).map((item) => (<div key={item.name}><div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-600">{item.name}</span><span className="font-semibold text-slate-900">{item.count}</span></div><div className="h-6 w-full rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{width:`${total>0?Math.round((item.count/total)*100):0}%`}} /></div></div>))}</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">By Status</h2><div className="space-y-4">{statusDist.map((item) => (<div key={item.name}><div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-600">{item.name}</span><span className="font-semibold text-slate-900">{item.count}</span></div><div className="h-6 w-full rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.key==='converted'?'bg-emerald-500':item.key==='lost'?'bg-red-500':item.key==='qualified'?'bg-sky-500':'bg-slate-400'}`} style={{width:`${total>0?Math.round((item.count/total)*100):0}%`}} /></div></div>))}</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">Top Leads by Score</h2><div className="space-y-3 max-h-[400px] overflow-y-auto">{[...leads].sort((a, b) => b.score - a.score).slice(0, 8).map((lead) => (<Link key={lead.id} href={`/dashboard/leads/${lead.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><div><p className="font-medium text-slate-900 text-sm">{lead.name}</p><p className="text-xs text-slate-500">{lead.company ?? lead.email}</p></div><span className="text-sm font-semibold text-sky-600">{lead.score}</span></Link>))}</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">All Leads</h2><div className="space-y-3 max-h-[400px] overflow-y-auto">{leads.slice(0, 10).map((lead) => (<Link key={lead.id} href={`/dashboard/leads/${lead.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><div><p className="font-medium text-slate-900 text-sm">{lead.name}</p><div className="flex items-center gap-2 mt-1"><Badge variant={getStatusVariant(lead.status)}><span className="text-[10px]">{lead.status}</span></Badge><span className="text-xs text-slate-400">{lead.source}</span></div></div><span className="text-xs text-slate-400">{formatDate(lead.created_at)}</span></Link>))}</div></div>
          </div>
        </>
      )}
    </div>
  )
}
function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div> }