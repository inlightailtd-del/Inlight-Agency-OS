import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input'; import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { fetchLeads, leadSources, leadStatuses, getSourceLabel, getStatusVariant, getStatusLabel } from '@/lib/supabase/leads'

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

export default async function LeadsPage({ searchParams }: { searchParams?: { query?: string | string[]; status?: string | string[]; source?: string | string[] } }) {
  const q = G(searchParams?.query); const stat = G(searchParams?.status); const src = G(searchParams?.source)
  const supabase = await createClient(); const leads = await fetchLeads(supabase, q, stat, src)

  const filterUrl = (p: Record<string, string>) => { const sp = new URLSearchParams(); Object.entries({ query: q, status: stat, source: src, ...p }).forEach(([k, v]) => { if (v) sp.set(k, v) }); return `/dashboard/leads?${sp.toString()}` }
  const statusFilters = [{ name: 'All', key: 'all' }, ...leadStatuses.map((s) => ({ name: getStatusLabel(s), key: s }))]
  const sourceFilters = [{ name: 'All', key: 'all' }, ...leadSources.map((s) => ({ name: getSourceLabel(s), key: s }))]

  const total = leads.length; const qualified = leads.filter((l) => l.status === 'qualified' || l.status === 'proposal' || l.status === 'converted').length
  const converted = leads.filter((l) => l.status === 'converted').length; const pipelineValue = leads.filter((l) => l.score > 0).reduce((s, l) => s + l.score, 0)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Lead Generation</h1><p className="text-sm text-slate-500 mt-1">AI-powered lead generation from multiple sources.</p></div>
        <div className="flex gap-3"><Link href="/dashboard/leads/dashboard"><Button variant="outline">Analytics</Button></Link><Link href="/dashboard/leads/history"><Button variant="outline">History</Button></Link><Link href="/dashboard/leads/new"><Button>Add Lead</Button></Link></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Leads" value={total} /><KPI title="Qualified" value={qualified} color="text-emerald-600" />
        <KPI title="Converted" value={converted} color="text-sky-600" /><KPI title="Pipeline Value" value={pipelineValue} color="text-indigo-600" />
      </div>
      <div className="grid gap-4 mb-6">
        <form method="get" className="flex gap-3"><div className="flex-1"><Input name="query" placeholder="Search leads..." defaultValue={q} /></div><Button type="submit" variant="secondary">Search</Button></form>
        <div className="grid gap-4 md:grid-cols-2">
          <FilterBox title="Status" filters={statusFilters} activeKey={stat||'all'} filterUrl={filterUrl} param="status" />
          <FilterBox title="Source" filters={sourceFilters} activeKey={src||'all'} filterUrl={filterUrl} param="source" />
        </div>
      </div>
      {leads.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No leads found.</p></div> : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} className={`flex items-start justify-between rounded-lg border p-4 hover:bg-slate-50 transition-colors ${lead.status === 'converted' ? 'border-emerald-200 bg-emerald-50/50' : lead.status === 'lost' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{lead.name}</p>{lead.company && <span className="text-sm text-slate-500">at {lead.company}</span>}</div>
                <div className="flex items-center gap-2 mt-1"><Badge variant={getStatusVariant(lead.status)}>{getStatusLabel(lead.status)}</Badge><Badge variant="default">{getSourceLabel(lead.source)}</Badge></div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  {lead.email && <span>{lead.email}</span>}{lead.industry && <span>{lead.industry}</span>}{lead.country && <span>{lead.country}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                {lead.score > 0 && <span className="text-sm font-semibold text-sky-600">{lead.score}</span>}
                <p className="text-xs text-slate-400 mt-1">{formatDate(lead.created_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
function FilterBox({ title, filters, activeKey, filterUrl, param }: { title: string; filters: any[]; activeKey: string; filterUrl: Function; param: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-slate-900 mb-3">{title}</p><div className="flex flex-wrap gap-2">{filters.map((f: any) => { const active = activeKey === f.key; return <Link key={f.key} href={filterUrl({ [param]: f.key === 'all' ? '' : f.key })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{f.name}</Link> })}</div></div>
}
function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div> }