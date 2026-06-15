import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'
import { fetchAgents, getAgentTypeLabel, getAgentStatusVariant } from '@/lib/supabase/agents'
import { fetchOrchTasks, getStatusVariant, getPriorityVariant } from '@/lib/supabase/orchestrator'
import { fetchAgentMessages } from '@/lib/supabase/orchestrator'
import { fetchPendingApprovals } from '@/lib/agents/approval'
import { runWorkflowAction, getWorkflowsAction, tickRuntimeAction, runMonitorAction, resolveApprovalAction, manualRunAction } from './actions'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function runWorkflowForm(formData: FormData) {
  'use server'
  const workflowId = String(formData.get('workflowId') || '').trim()
  const input = String(formData.get('input') || '').trim()
  if (!workflowId || !input) throw new Error('Workflow ID and input required')
  await runWorkflowAction(workflowId, input)
  revalidatePath('/dashboard/orchestrator')
  redirect('/dashboard/orchestrator')
}

async function tickForm() {
  'use server'
  const r = await tickRuntimeAction()
  if (!r.ok) throw new Error(r.error ?? 'Tick failed')
  revalidatePath('/dashboard/orchestrator')
  redirect('/dashboard/orchestrator')
}

async function monitorForm() {
  'use server'
  const r = await runMonitorAction()
  if (!r.ok) throw new Error(r.error ?? 'Monitor failed')
  revalidatePath('/dashboard/orchestrator')
  redirect('/dashboard/orchestrator')
}

async function approveForm(formData: FormData) {
  'use server'
  const id = String(formData.get('approvalId') || '')
  const decision = String(formData.get('decision') || '')
  if (!id || !['approved', 'rejected'].includes(decision)) throw new Error('Invalid approval action')
  const reasoning = String(formData.get('reasoning') || '')
  await resolveApprovalAction(id, decision as any, reasoning || undefined)
  revalidatePath('/dashboard/orchestrator')
  redirect('/dashboard/orchestrator')
}

async function manualRunForm(formData: FormData) {
  'use server'
  const agentId = String(formData.get('agentId') || '')
  const prompt = String(formData.get('prompt') || '')
  if (!agentId || !prompt) throw new Error('Agent and prompt required')
  const r = await manualRunAction(agentId, prompt)
  if (!r.ok) throw new Error(r.error ?? 'Manual run failed')
  revalidatePath('/dashboard/orchestrator')
  redirect('/dashboard/orchestrator')
}

export default async function OrchestratorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [agents, tasks, messages, workflows, approvals] = await Promise.all([
    fetchAgents(supabase),
    fetchOrchTasks(supabase),
    fetchAgentMessages(supabase),
    getWorkflowsAction(),
    user?.id ? fetchPendingApprovals(supabase, user.id) : Promise.resolve([]),
  ])

  const activeAgents = agents.filter((a) => a.status === 'active').length
  const idleAgents = agents.filter((a) => a.status === 'idle').length
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length
  const completedTasks = tasks.filter((t) => t.status === 'completed').length
  const pendingApprovals = approvals.length

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Agent Runtime</h1>
          <p className="text-sm text-slate-500 mt-1">Orchestrator — scheduled, manual, and event-driven agent execution.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/orchestrator/agents"><Button variant="outline">Agents</Button></Link>
          <Link href="/dashboard/orchestrator/tasks"><Button variant="outline">Tasks</Button></Link>
          <Link href="/dashboard/orchestrator/history"><Button variant="outline">History</Button></Link>
        </div>
      </div>

      {/* ─── KPI Row ───────────────────────────────────────────── */}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KPI title="Total Agents" value={agents.length} />
        <KPI title="Active/Idle" value={`${activeAgents}/${idleAgents}`} color="text-emerald-600" />
        <KPI title="Pending Tasks" value={pendingTasks} color="text-amber-600" />
        <KPI title="Completed" value={completedTasks} color="text-sky-600" />
        <KPI title="Pending Approvals" value={pendingApprovals} color={pendingApprovals > 0 ? 'text-red-600' : 'text-slate-900'} />
      </div>

      {/* ─── Runtime Controls ──────────────────────────────────── */}

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Scheduled Tick */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Scheduled</h2>
          <p className="text-sm text-slate-500 mb-4">Poll the orchestrator queue and execute pending tasks. Runs via cron (typically every 15 min).</p>
          <form action={tickForm}>
            <Button type="submit" className="w-full">Run Tick</Button>
          </form>
        </div>

        {/* Project Monitor */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Project Monitor</h2>
          <p className="text-sm text-slate-500 mb-4">Scan all active projects for overdue tasks, budget risks, stalled work, and health drops.</p>
          <form action={monitorForm}>
            <Button type="submit" variant="outline" className="w-full">Run Monitor</Button>
          </form>
        </div>

        {/* Manual Execution */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Manual</h2>
          <p className="text-sm text-slate-500 mb-4">Run any agent on-demand with a custom prompt.</p>
          <form action={manualRunForm} className="space-y-3">
            <select name="agentId" required
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
              <option value="">Select agent…</option>
              {agents.filter((a) => a.status === 'idle').map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({getAgentTypeLabel(a.type)})</option>
              ))}
            </select>
            <Input name="prompt" placeholder="Enter instruction for the agent…" required />
            <Button type="submit" variant="secondary" className="w-full">Execute</Button>
          </form>
        </div>
      </div>

      {/* ─── Pending Approvals ─────────────────────────────────── */}

      {pendingApprovals > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-red-900">
              Pending Approvals ({pendingApprovals})
            </h2>
          </div>
          <div className="space-y-3">
            {approvals.map((req: any) => (
              <div key={req.id} className="rounded-lg border border-red-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={
                        req.impact === 'critical' ? 'destructive' :
                        req.impact === 'high' ? 'destructive' :
                        req.impact === 'medium' ? 'warning' : 'default'
                      }>{req.impact}</Badge>
                      <span className="text-xs font-medium text-slate-500">{req.agent_name ?? 'Unknown Agent'}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{req.summary}</p>
                    {req.justification && (
                      <p className="text-xs text-slate-500 mt-1">{req.justification}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <form action={approveForm}>
                    <input type="hidden" name="approvalId" value={req.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Approve
                    </Button>
                  </form>
                  <form action={approveForm}>
                    <input type="hidden" name="approvalId" value={req.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <Button type="submit" size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Multi-Step Workflows ──────────────────────────────── */}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Multi-Step Workflows</h2>
        <p className="text-sm text-slate-500 mb-4">Run end-to-end AI workflows that chain multiple agents together sequentially. Each step passes its output to the next agent.</p>
        <div className="grid gap-6">
          {workflows.map((wf) => (
            <div key={wf.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{wf.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{wf.description}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {wf.steps.map((step) => (
                      <Badge key={step} variant="default" className="text-[10px]">{step}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <form action={runWorkflowForm} className="mt-4 flex gap-3">
                <input type="hidden" name="workflowId" value={wf.id} />
                <div className="flex-1">
                  <Input name="input" placeholder={`Describe your ${wf.name.toLowerCase()}...`} required />
                </div>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                  Run Workflow
                </Button>
              </form>
            </div>
          ))}
          {workflows.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No workflows available.</p>}
        </div>
      </div>

      {/* ─── Agent Overview + Recent Tasks + Messages ─────────── */}

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Agent Overview */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Agents</h2>
            <Link href="/dashboard/orchestrator/agents" className="text-xs text-slate-500 hover:text-slate-700">View all</Link>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {agents.map((agent) => (
              <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{agent.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getAgentStatusVariant(agent.status)}>
                      <span className="text-[10px]">{agent.status}</span>
                    </Badge>
                    <span className="text-xs text-slate-400">{getAgentTypeLabel(agent.type)}</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-sky-600">{agent.performance_score}%</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Tasks</h2>
            <Link href="/dashboard/orchestrator/tasks" className="text-xs text-slate-500 hover:text-slate-700">View all</Link>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900 text-sm truncate">{task.title}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={getStatusVariant(task.status)}><span className="text-[10px]">{task.status.replace(/_/g, ' ')}</span></Badge>
                    <Badge variant={getPriorityVariant(task.priority)}><span className="text-[10px]">{task.priority}</span></Badge>
                  </div>
                </div>
                {task.agent_name && <p className="text-xs text-slate-500 mt-1">Assigned: {task.agent_name}</p>}
              </div>
            ))}
            {tasks.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No tasks yet.</p>}
          </div>
        </div>

        {/* Agent Messages */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Agent Communication</h2>
            <Link href="/dashboard/orchestrator/history" className="text-xs text-slate-500 hover:text-slate-700">View all</Link>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {messages.slice(0, 20).map((msg) => (
              <div key={msg.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-medium">{msg.from_agent_name} → {msg.to_agent_name}</span>
                  <span>{formatDateTime(msg.created_at)}</span>
                </div>
                <p className="text-sm text-slate-700">{(msg.message || '').slice(0, 200)}{(msg.message || '').length > 200 ? '…' : ''}</p>
              </div>
            ))}
            {messages.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No messages yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
