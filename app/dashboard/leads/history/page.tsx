import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'; import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { fetchLeads, getSourceLabel, getStatusVariant, getStatusLabel } from '@/lib/supabase/leads'

export default async function LeadsHistoryPage() {
  const supabase = await createClient(); const leads = await fetchLeads(supabase)
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Lead History</h1><p className="text-sm text-slate-500 mt-1">Complete chronological log of all captured leads.</p></div>
        <Link href="/dashboard/leads"><Button variant="outline">Back</Button></Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Leads" value={leads.length} />
        <KPI title="Converted" value={leads.filter((l) => l.status === 'converted').length} color="text-emerald-600" />
        <KPI title="Qualified" value={leads.filter((l) => l.status === 'qualified').length} color="text-sky-600" />
        <KPI title="Lost" value={leads.filter((l) => l.status === 'lost').length} color="text-red-600" />
      </div>
      {leads.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No lead history.</p></div> : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {leads.map((lead) => (
            <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} className={`flex items-start justify-between rounded-lg border p-4 hover:bg-slate-50 transition-colors ${lead.status === 'converted' ? 'border-emerald-200 bg-emerald-50/50' : lead.status === 'lost' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{lead.name}</p><Badge variant={getStatusVariant(lead.status)}>{getStatusLabel(lead.status)}</Badge></div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <Badge variant="default">{getSourceLabel(lead.source)}</Badge>
                  {lead.company && <span>{lead.company}</span>}
                  {lead.score > 0 && <span className="text-sky-600 font-medium">Score: {lead.score}</span>}
                </div>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{formatDateTime(lead.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div> }