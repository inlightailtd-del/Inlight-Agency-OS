import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { fetchAgents, getAgentTypeLabel, getAgentStatusVariant, getDepartmentLabel } from '@/lib/supabase/agents'

export default async function AgentsTimelinePage() {
  const supabase = await createClient(); const agents = await fetchAgents(supabase)
  const timelineAgents = [...agents].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const allDates = timelineAgents.map((a) => a.created_at)
  let minDate: Date, maxDate: Date
  if (allDates.length > 0) { const sorted = allDates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime()); minDate = new Date(sorted[0].getFullYear(), sorted[0].getMonth(), 1); maxDate = new Date(sorted[sorted.length - 1].getFullYear(), sorted[sorted.length - 1].getMonth() + 2, 0) }
  else { minDate = new Date(); maxDate = new Date(new Date().setMonth(new Date().getMonth() + 6)) }

  const months: { label: string; key: string }[] = []; const cursor = new Date(minDate)
  while (cursor <= maxDate) { months.push({ label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), key: `ag-${cursor.getFullYear()}-${cursor.getMonth()}` }); cursor.setMonth(cursor.getMonth() + 1) }
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))

  const typeGroups: Record<string, typeof timelineAgents> = {}
  timelineAgents.forEach((a) => { const t = a.type; if (!typeGroups[t]) typeGroups[t] = []; typeGroups[t].push(a) })

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Agent Timeline</h1><p className="text-sm text-slate-500 mt-1">Chronological view of agent registrations and deployment.</p></div>
        <Link href="/dashboard/agents"><Button variant="outline">Back to Agents</Button></Link>
      </div>

      {timelineAgents.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No agents registered yet.</p></div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm mb-8">
            <div className="overflow-x-auto"><div style={{ minWidth: `${months.length * 80}px` }}>
              <div className="flex border-b border-slate-200 bg-slate-50"><div className="w-48 shrink-0 px-4 py-3 text-sm font-medium text-slate-600 border-r border-slate-200">Agent Type</div>{months.map((m) => (<div key={m.key} className="flex-1 px-2 py-3 text-center text-xs font-medium text-slate-500 border-r border-slate-100">{m.label}</div>))}</div>
              {Object.entries(typeGroups).map(([type, typeAgents]) => (
                <div key={type} className="border-b border-slate-100">
                  <div className="flex bg-slate-50/50"><div className="w-48 shrink-0 px-4 py-2 border-r border-slate-200"><span className="text-sm font-semibold text-slate-800">{getAgentTypeLabel(type)}</span></div><div className="flex-1 relative py-2">{(() => { const todayOffset = (new Date().getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24); const todayPercent = (todayOffset / totalDays) * 100; if (todayPercent >= 0 && todayPercent <= 100) return <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: `${todayPercent}%` }}><span className="absolute top-0 left-1 text-[10px] text-red-500 whitespace-nowrap">Today</span></div>; return null })()}</div></div>
                  {typeAgents.map((agent) => { const createdDate = new Date(agent.created_at); const dayOffset = (createdDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24); const positionPercent = (dayOffset / totalDays) * 100; return (
                    <div key={agent.id} className="flex hover:bg-slate-50 transition-colors">
                      <div className="w-48 shrink-0 px-4 py-3 border-r border-slate-200"><Link href={`/dashboard/agents/${agent.id}`} className="text-sm font-medium text-slate-900 hover:text-slate-700 hover:underline line-clamp-1">{agent.name}</Link><div className="flex items-center gap-1 mt-1"><Badge variant={getAgentStatusVariant(agent.status)}><span className="text-[10px]">{agent.status}</span></Badge></div></div>
                      <div className="flex-1 relative py-3 px-1"><div className="absolute inset-0 flex">{months.map((m) => (<div key={m.key} className="flex-1 border-r border-slate-50" />))}</div><div className="absolute top-1/2 -translate-y-1/2 flex items-center" style={{ left: `${positionPercent}%` }}><div className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-indigo-300" /><span className="ml-1.5 text-xs text-slate-600 whitespace-nowrap">{formatDate(agent.created_at)}</span></div></div>
                    </div>
                  )})}
                </div>
              ))}
            </div></div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">Agent Growth by Month</h2><div className="space-y-3">{(() => { const monthlyCounts: Record<string, number> = {}; timelineAgents.forEach((a) => { const month = a.created_at.substring(0, 7); monthlyCounts[month] = (monthlyCounts[month] || 0) + 1 }); const sortedMonths = Object.keys(monthlyCounts).sort(); const maxCount = Math.max(...Object.values(monthlyCounts), 1); return sortedMonths.map((month) => (<div key={month}><div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-600">{month}</span><span className="font-semibold text-slate-900">{monthlyCounts[month]}</span></div><div className="h-5 w-full rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round((monthlyCounts[month] / maxCount) * 100)}%` }} /></div></div>)) })()}</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">Recently Added</h2><div className="space-y-3">{timelineAgents.slice(-5).reverse().map((agent) => (<Link key={agent.id} href={`/dashboard/agents/${agent.id}`} className="flex items-start justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><div><p className="font-medium text-slate-900 text-sm">{agent.name}</p><div className="flex items-center gap-2 mt-1"><Badge variant="default"><span className="text-[10px]">{getAgentTypeLabel(agent.type)}</span></Badge></div></div><span className="text-xs text-slate-400">{formatDate(agent.created_at)}</span></Link>))}</div></div>
          </div>
        </>
      )}
    </div>
  )
}