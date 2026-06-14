import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { formatDateTime } from '@/lib/utils'
import { executeAgentTask } from '@/lib/ai/execution'
import { fetchAgents } from '@/lib/supabase/agents'
import { fetchOrchTasks, orchTaskStatuses, orchPriorities, getStatusVariant, getPriorityVariant, createOrchTask, updateOrchTask, deleteOrchTask } from '@/lib/supabase/orchestrator'

const TASK_AGENT_MATCHING: Record<string, string[]> = {
  content: ['content', 'seo', 'marketing'], blog: ['content'], write: ['content'],
  social: ['content', 'marketing'], sales: ['sales'], lead: ['sales'],
  proposal: ['sales'], seo: ['seo'], keyword: ['seo'],
  research: ['research'], analyze: ['research'], report: ['research'],
  support: ['support'], help: ['support'], code: ['developer'],
  develop: ['developer'], build: ['developer'], finance: ['finance'],
  invoice: ['finance'], revenue: ['finance'], marketing: ['marketing'],
  campaign: ['marketing'], automation: ['automation'], workflow: ['automation'],
}

function detectAgentType(title: string, description: string | null): string[] {
  const text = `${title} ${description || ''}`.toLowerCase()
  for (const [keyword, types] of Object.entries(TASK_AGENT_MATCHING)) {
    if (text.includes(keyword)) return types
  }
  return ['general']
}

function selectBestAgent(matchingTypes: string[], agents: { id: string; type: string; status: string; name: string }[]): { id: string; type: string; name: string } | null {
  // Prefer active agents matching the detected type
  const activeMatch = agents.find((a) => matchingTypes.includes(a.type) && a.status === 'active')
  if (activeMatch) return activeMatch
  // Fall back to any active agent
  const anyActive = agents.find((a) => a.status === 'active')
  if (anyActive) return anyActive
  // Last resort: any agent
  const any = agents[0]
  return any || null
}

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

async function createTaskAction(formData: FormData) {
  'use server'
  const raw = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const title = String(raw.title || '')
  if (!title) throw new Error('Title required')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  const description = String(raw.description || '')

  // Create task as pending
  const { data: task } = await supabase.from('orchestrator_tasks').insert([{
    user_id: user.id, title, description: description || null,
    status: 'pending', priority: String(raw.priority || 'medium'),
  }]).select().single()
  if (!task) throw new Error('Failed to create task')

  // Auto-assign best agent
  const agents = await fetchAgents(supabase)
  const matchingTypes = detectAgentType(title, description)
  const agent = selectBestAgent(matchingTypes, agents)

  if (!agent) {
    await supabase.from('orchestrator_tasks').update({ status: 'failed', result: 'No agents available to assign' }).eq('id', task.id)
    revalidatePath('/dashboard/orchestrator/tasks')
    redirect('/dashboard/orchestrator/tasks')
  }

  // Update to assigned
  await supabase.from('orchestrator_tasks').update({
    agent_id: agent.id, status: 'assigned', assigned_at: new Date().toISOString(),
  }).eq('id', task.id)

  // Execute AI
  const systemPrompt = `You are an AI agent of type "${agent.type}" named "${agent.name}". Execute the delegated task and provide a clear result.`
  const result = await executeAgentTask(supabase, user.id, agent.id, description || title, { systemPrompt, taskId: task.id })

  // Update with result
  await supabase.from('orchestrator_tasks').update({
    status: result.status === 'completed' ? 'completed' : 'failed',
    result: result.response || result.error_msg || 'No result',
    completed_at: result.status === 'completed' ? new Date().toISOString() : null,
  }).eq('id', task.id)

  revalidatePath('/dashboard/orchestrator/tasks')
  redirect('/dashboard/orchestrator/tasks')
}

async function updateStatusAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await updateOrchTask(supabase, String(formData.get('taskId') || ''), { status: String(formData.get('status') || 'pending') })
  revalidatePath('/dashboard/orchestrator/tasks')
  redirect('/dashboard/orchestrator/tasks')
}

async function deleteTaskAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await deleteOrchTask(supabase, String(formData.get('taskId') || ''))
  revalidatePath('/dashboard/orchestrator/tasks')
  redirect('/dashboard/orchestrator/tasks')
}

export default async function OrchestratorTasksPage({ searchParams }: { searchParams?: { query?: string | string[]; status?: string | string[] } }) {
  const q = G(searchParams?.query); const stat = G(searchParams?.status)
  const supabase = await createClient()
  const [tasks, agents] = await Promise.all([fetchOrchTasks(supabase, q, stat), fetchAgents(supabase)])

  const statusFilters = [{ name: 'All', key: 'all', count: tasks.length }, ...orchTaskStatuses.map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '), key: s, count: tasks.filter((t) => t.status === s).length }))]
  const filterUrl = (p: Record<string, string>) => { const sp = new URLSearchParams(); Object.entries({ query: q, status: stat, ...p }).forEach(([k, v]) => { if (v) sp.set(k, v) }); return `/dashboard/orchestrator/tasks?${sp.toString()}` }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Task Delegation</h1><p className="text-sm text-slate-500 mt-1">Create, assign, and track tasks delegated to AI agents.</p></div>
        <Link href="/dashboard/orchestrator"><Button variant="outline">Back</Button></Link>
      </div>

      <div className="grid gap-4 mb-6">
        <form method="get" className="flex gap-3"><div className="flex-1"><Input name="query" placeholder="Search tasks..." defaultValue={q} /></div><Button type="submit" variant="secondary">Search</Button></form>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-slate-900 mb-3">Status</p><div className="flex flex-wrap gap-2">{statusFilters.map((f) => { const active = (stat || 'all') === f.key; return <Link key={f.key} href={filterUrl({ status: f.key === 'all' ? '' : f.key })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{f.name} ({f.count})</Link> })}</div></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {tasks.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No tasks delegated yet.</p></div> : (
            tasks.map((task) => (
              <div key={task.id} className={`rounded-lg border p-4 ${task.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : task.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{task.title}</p>
                      <Badge variant={getStatusVariant(task.status)}>{task.status.replace(/_/g, ' ')}</Badge>
                      <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
                    </div>
                    {task.description && <p className="text-sm text-slate-500 mt-1">{task.description}</p>}
                    {task.result && <div className="mt-2 text-sm text-slate-600 bg-slate-50 rounded p-2 border whitespace-pre-wrap">{task.result}</div>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      {task.agent_name && <span>Agent: {task.agent_name}</span>}
                      {task.assigned_at && <span>Assigned: {formatDateTime(task.assigned_at)}</span>}
                      {task.completed_at && <span>Completed: {formatDateTime(task.completed_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.status !== 'completed' && task.status !== 'failed' && (
                      <form action={updateStatusAction} className="flex gap-1">
                        <input type="hidden" name="taskId" value={task.id} />
                        <Select name="status" defaultValue={task.status}>
                          {orchTaskStatuses.map((s) => (<option key={s} value={s}>{s.replace(/_/g, ' ')}</option>))}
                        </Select>
                        <Button type="submit" size="sm" variant="secondary">Update</Button>
                      </form>
                    )}
                    <form action={deleteTaskAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <Button type="submit" variant="ghost" size="sm">×</Button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Task Form */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Delegate New Task</h3>
          <form action={createTaskAction} className="grid gap-4">
            <Input name="title" required placeholder="Task title" />
            <Textarea name="description" placeholder="Description..." />
            <div className="grid grid-cols-2 gap-3">
              <Select name="status" defaultValue="pending">{orchTaskStatuses.map((s) => (<option key={s} value={s}>{s.replace(/_/g, ' ')}</option>))}</Select>
              <Select name="priority" defaultValue="medium">{orchPriorities.map((p) => (<option key={p} value={p}>{p}</option>))}</Select>
            </div>
            <Button type="submit" className="w-full">Delegate Task</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
