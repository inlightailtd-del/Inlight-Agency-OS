import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { fetchAgents, getAgentTypeLabel, getAgentStatusVariant, getDepartmentLabel, agentTypes, agentStatuses, agentDepartments, createAgent } from '@/lib/supabase/agents'
import { agentMessageFormSchema, createAgentMessage } from '@/lib/supabase/orchestrator'

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

async function createAgentAction(formData: FormData) {
  'use server'
  const raw = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const name = String(raw.name || '')
  if (!name) throw new Error('Name required')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await createAgent(supabase, user.id, { name, description: String(raw.description || ''), type: String(raw.type || 'general'), role: String(raw.role || ''), status: String(raw.status || 'offline'), department: String(raw.department || '') || null })
  revalidatePath('/dashboard/orchestrator')
  redirect('/dashboard/orchestrator')
}

async function sendMessageAction(formData: FormData) {
  'use server'
  const raw = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await createAgentMessage(supabase, user.id, { from_agent_id: String(raw.from_agent_id || ''), to_agent_id: String(raw.to_agent_id || ''), message: String(raw.message || '') })
  revalidatePath('/dashboard/orchestrator')
  redirect('/dashboard/orchestrator')
}

export default async function OrchestratorAgentsPage({ searchParams }: { searchParams?: { query?: string | string[]; type?: string | string[]; status?: string | string[] } }) {
  const q = G(searchParams?.query); const typ = G(searchParams?.type); const stat = G(searchParams?.status)
  const supabase = await createClient()
  const agents = await fetchAgents(supabase, q, typ, stat)

  const typeFilters = [{ name: 'All', key: 'all', count: agents.length }, ...agentTypes.map((t) => ({ name: getAgentTypeLabel(t), key: t, count: agents.filter((a) => a.type === t).length }))]
  const statusFilters = [{ name: 'All', key: 'all', count: agents.length }, ...agentStatuses.map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), key: s, count: agents.filter((a) => a.status === s).length }))]

  const filterUrl = (p: Record<string, string>) => { const sp = new URLSearchParams(); Object.entries({ query: q, type: typ, status: stat, ...p }).forEach(([k, v]) => { if (v) sp.set(k, v) }); return `/dashboard/orchestrator/agents?${sp.toString()}` }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Agent Registry</h1><p className="text-sm text-slate-500 mt-1">Manage all AI agents, create new ones, and send inter-agent messages.</p></div>
        <Link href="/dashboard/orchestrator"><Button variant="outline">Back</Button></Link>
      </div>

      <div className="grid gap-4 mb-6">
        <form method="get" className="flex gap-3"><div className="flex-1"><Input name="query" placeholder="Search agents..." defaultValue={q} /></div><Button type="submit" variant="secondary">Search</Button></form>
        <div className="grid gap-4 md:grid-cols-2">
          <FilterBox title="Types" filters={typeFilters} activeKey={typ || 'all'} filterUrl={filterUrl} param="type" />
          <FilterBox title="Status" filters={statusFilters} activeKey={stat || 'all'} filterUrl={filterUrl} param="status" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          {agents.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No agents found.</p></div> : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <Link key={agent.id} href={`/dashboard/agents/${agent.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                  <div>
                    <p className="font-semibold text-slate-900">{agent.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getAgentStatusVariant(agent.status)}><span className="text-[10px]">{agent.status}</span></Badge>
                      <Badge variant="default"><span className="text-[10px]">{getAgentTypeLabel(agent.type)}</span></Badge>
                      {agent.department && <span className="text-xs text-slate-400">{getDepartmentLabel(agent.department)}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-sky-600">{agent.performance_score}%</span>
                    <p className="text-xs text-slate-400 mt-1">⚡ {agent.total_executions} runs</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Add Agent Form */}
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Register New Agent</h3>
            <form action={createAgentAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Input name="name" required placeholder="Agent name" /></div>
                <div><Input name="role" placeholder="Role" /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Select name="type" defaultValue="general">{agentTypes.map((t) => (<option key={t} value={t}>{getAgentTypeLabel(t)}</option>))}</Select>
                <Select name="status" defaultValue="offline">{agentStatuses.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>))}</Select>
                <Select name="department"><option value="">— Dept —</option>{agentDepartments.map((d) => (<option key={d} value={d}>{getDepartmentLabel(d)}</option>))}</Select>
              </div>
              <Textarea name="description" placeholder="Description..." />
              <div className="flex justify-end"><Button type="submit">Register</Button></div>
            </form>
          </div>
        </div>

        {/* Send Message */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Send Agent Message</h3>
          <form action={sendMessageAction} className="grid gap-4">
            <Select name="from_agent_id" required><option value="">From agent...</option>{agents.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}</Select>
            <Select name="to_agent_id" required><option value="">To agent...</option>{agents.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}</Select>
            <Textarea name="message" required placeholder="Message..." />
            <div className="flex justify-end"><Button type="submit">Send</Button></div>
          </form>
        </div>
      </div>
    </div>
  )
}

function FilterBox({ title, filters, activeKey, filterUrl, param }: { title: string; filters: { name: string; key: string; count: number }[]; activeKey: string; filterUrl: (p: Record<string, string>) => string; param: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900 mb-3">{title}</p>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => { const active = activeKey === f.key; return <Link key={f.key} href={filterUrl({ [param]: f.key === 'all' ? '' : f.key })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{f.name} ({f.count})</Link> })}
      </div>
    </div>
  )
}