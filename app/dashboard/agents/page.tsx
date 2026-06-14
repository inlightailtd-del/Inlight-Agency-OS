import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  fetchAgents, agentTypes, agentStatuses, agentDepartments,
  getAgentTypeLabel, getAgentStatusVariant, getDepartmentLabel,
} from '@/lib/supabase/agents'

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

export default async function AgentsPage({ searchParams }: { searchParams?: { query?: string | string[]; type?: string | string[]; status?: string | string[]; department?: string | string[] } }) {
  const q = G(searchParams?.query); const typ = G(searchParams?.type); const stat = G(searchParams?.status); const dept = G(searchParams?.department)
  const supabase = await createClient()
  const agents = await fetchAgents(supabase, q, typ, stat, dept)

  const filterUrl = (p: Record<string, string>) => {
    const sp = new URLSearchParams()
    const all = { query: q, type: typ, status: stat, department: dept, ...p }
    Object.entries(all).forEach(([k, v]) => { if (v) sp.set(k, v) })
    return `/dashboard/agents?${sp.toString()}`
  }

  const totalAgents = agents.length
  const activeCount = agents.filter((a) => a.status === 'active').length
  const avgPerformance = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.performance_score, 0) / agents.length) : 0
  const totalExecutions = agents.reduce((s, a) => s + a.total_executions, 0)

  // Build filter arrays with explicit types
  const typeFilters: { name: string; key: string; count: number }[] = [
    { name: 'All', key: 'all', count: agents.length },
    ...agentTypes.map((t) => ({ name: getAgentTypeLabel(t), key: t, count: agents.filter((a) => a.type === t).length })),
  ]

  const statusFilters: { name: string; key: string; count: number }[] = [
    { name: 'All', key: 'all', count: agents.length },
    ...agentStatuses.map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), key: s, count: agents.filter((a) => a.status === s).length })),
  ]

  const deptFilters: { name: string; key: string; count: number }[] = [
    { name: 'All', key: 'all', count: agents.length },
    ...agentDepartments.map((d) => ({ name: getDepartmentLabel(d), key: d, count: agents.filter((a) => a.department === d).length })),
  ]

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Agents</h1><p className="text-sm text-slate-500 mt-1">AI employee registry. Manage, monitor, and deploy autonomous agents.</p></div>
        <div className="flex gap-3">
          <Link href="/dashboard/agents/dashboard"><Button variant="outline">Analytics</Button></Link>
          <Link href="/dashboard/agents/timeline"><Button variant="outline">Timeline</Button></Link>
          <Link href="/dashboard/agents/new"><Button>Add Agent</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Agents" value={totalAgents} />
        <KPI title="Active" value={activeCount} color="text-emerald-600" />
        <KPI title="Avg Performance" value={`${avgPerformance}%`} color="text-sky-600" />
        <KPI title="Total Executions" value={totalExecutions} color="text-indigo-600" />
      </div>

      <div className="grid gap-4 mb-6">
        <form method="get" className="flex gap-3"><div className="flex-1"><Input name="query" placeholder="Search agents..." defaultValue={q} /></div><Button type="submit" variant="secondary">Search</Button></form>
        <div className="grid gap-4 md:grid-cols-3">
          <FilterBox title="Types" filters={typeFilters} activeKey={typ || 'all'} filterUrl={filterUrl} param="type" />
          <FilterBox title="Status" filters={statusFilters} activeKey={stat || 'all'} filterUrl={filterUrl} param="status" />
          <FilterBox title="Departments" filters={deptFilters} activeKey={dept || 'all'} filterUrl={filterUrl} param="department" />
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No agents found.</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/dashboard/agents/${agent.id}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-2 mb-3">
                <Badge variant={getAgentStatusVariant(agent.status)}>{agent.status}</Badge>
                <span className="text-xs text-slate-400">{getAgentTypeLabel(agent.type)}</span>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{agent.name}</h3>
              {agent.role && <p className="text-sm text-slate-500 mb-3">{agent.role}</p>}
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                {agent.department && <Badge variant="default">{getDepartmentLabel(agent.department)}</Badge>}
                <span>⚡ {agent.total_executions} runs</span>
                <span>✓ {agent.success_rate}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200"><div className="h-full rounded-full bg-sky-500" style={{ width: `${agent.performance_score}%` }} /></div>
              <p className="text-xs text-slate-400 mt-2">Performance: {agent.performance_score}%</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterBox({ title, filters, activeKey, filterUrl, param }: { title: string; filters: { name: string; key: string; count: number }[]; activeKey: string; filterUrl: (p: Record<string, string>) => string; param: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900 mb-3">{title}</p>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = activeKey === f.key
          return (
            <Link
              key={f.key}
              href={filterUrl({ [param]: f.key === 'all' ? '' : f.key })}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              {f.name} ({f.count})
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div>
}