import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { fetchAgents, agentTypes, agentStatuses, getAgentTypeLabel, getAgentStatusVariant, getDepartmentLabel } from '@/lib/supabase/agents'

export default async function AgentsDashboardPage() {
  const supabase = await createClient(); const agents = await fetchAgents(supabase)
  const total = agents.length
  const activeCount = agents.filter((a) => a.status === 'active').length
  const avgPerf = total > 0 ? Math.round(agents.reduce((s, a) => s + a.performance_score, 0) / total) : 0
  const avgSuccess = total > 0 ? Math.round(agents.reduce((s, a) => s + a.success_rate, 0) / total) : 0

  const typeDist = agentTypes.map((t) => ({ name: getAgentTypeLabel(t), key: t, count: agents.filter((a) => a.type === t).length }))
  const statusDist = agentStatuses.map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), key: s, count: agents.filter((a) => a.status === s).length }))

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Agent Analytics</h1><p className="text-sm text-slate-500 mt-1">Performance overview and workforce distribution across AI agents.</p></div>
        <Link href="/dashboard/agents"><Button variant="outline">Back to Agents</Button></Link>
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No agents registered yet.</p></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPI title="Total Agents" value={total} />
            <KPI title="Active" value={activeCount} color="text-emerald-600" />
            <KPI title="Avg Performance" value={`${avgPerf}%`} color="text-sky-600" />
            <KPI title="Avg Success Rate" value={`${avgSuccess}%`} color="text-emerald-600" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI title="Total Executions" value={agents.reduce((s, a) => s + a.total_executions, 0)} />
            <KPI title="Busy Agents" value={agents.filter((a) => a.status === 'busy').length} color="text-amber-600" />
            <KPI title="Idle Agents" value={agents.filter((a) => a.status === 'idle').length} color="text-sky-600" />
            <KPI title="Offline" value={agents.filter((a) => a.status === 'offline').length} color="text-slate-600" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">By Agent Type</h2>
              <div className="space-y-4">{typeDist.filter((t) => t.count > 0).map((item) => (<div key={item.name}><div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-600">{item.name}</span><span className="font-semibold text-slate-900">{item.count}</span></div><div className="h-6 w-full rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${total > 0 ? Math.round((item.count / total) * 100) : 0}%` }} /></div></div>))}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">By Status</h2>
              <div className="space-y-4">{statusDist.map((item) => (<div key={item.name}><div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-600">{item.name}</span><span className="font-semibold text-slate-900">{item.count}</span></div><div className="h-6 w-full rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.key === 'active' ? 'bg-emerald-500' : item.key === 'busy' ? 'bg-amber-500' : item.key === 'idle' ? 'bg-sky-500' : 'bg-slate-400'}`} style={{ width: `${total > 0 ? Math.round((item.count / total) * 100) : 0}%` }} /></div></div>))}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Performers</h2>
              <div className="space-y-3">{[...agents].sort((a, b) => b.performance_score - a.performance_score).slice(0, 5).map((a) => (<div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><Link href={`/dashboard/agents/${a.id}`} className="font-medium text-slate-900 text-sm hover:text-slate-700">{a.name}</Link><p className="text-xs text-slate-500">{getAgentTypeLabel(a.type)}</p></div><div className="text-right"><span className="text-sm font-semibold text-sky-600">{a.performance_score}%</span><div className="h-1.5 w-16 rounded-full bg-slate-200 mt-1"><div className="h-full rounded-full bg-sky-500" style={{ width: `${a.performance_score}%` }} /></div></div></div>))}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">All Agents</h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">{agents.map((a) => (<Link key={a.id} href={`/dashboard/agents/${a.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><div><p className="font-medium text-slate-900 text-sm">{a.name}</p><div className="flex items-center gap-2 mt-1"><Badge variant={getAgentStatusVariant(a.status)}><span className="text-[10px]">{a.status}</span></Badge><span className="text-xs text-slate-400">{getAgentTypeLabel(a.type)}</span></div></div><span className="text-xs text-slate-400">✓ {a.success_rate}%</span></Link>))}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div> }