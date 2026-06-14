import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'
import { fetchAgents, getAgentTypeLabel, getAgentStatusVariant } from '@/lib/supabase/agents'
import { fetchOrchTasks, getStatusVariant, getPriorityVariant } from '@/lib/supabase/orchestrator'
import { fetchAgentMessages } from '@/lib/supabase/orchestrator'
import { runWorkflowAction, getWorkflowsAction } from './actions'
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

export default async function OrchestratorPage() {
  const supabase = await createClient()
  const [agents, tasks, messages, workflows] = await Promise.all([
    fetchAgents(supabase),
    fetchOrchTasks(supabase),
    fetchAgentMessages(supabase),
    getWorkflowsAction(),
  ])

  const activeAgents = agents.filter((a) => a.status === 'active').length
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length
  const completedTasks = tasks.filter((t) => t.status === 'completed').length

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Multi-Agent Orchestrator</h1>
          <p className="text-sm text-slate-500 mt-1">Central AI orchestration system managing all agents, tasks, and inter-agent communication.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/orchestrator/agents"><Button variant="outline">Agents</Button></Link>
          <Link href="/dashboard/orchestrator/tasks"><Button variant="outline">Tasks</Button></Link>
          <Link href="/dashboard/orchestrator/history"><Button variant="outline">History</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Agents" value={agents.length} />
        <KPI title="Active Agents" value={activeAgents} color="text-emerald-600" />
        <KPI title="Pending Tasks" value={pendingTasks} color="text-amber-600" />
        <KPI title="Completed Tasks" value={completedTasks} color="text-sky-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPI title="Total Messages" value={messages.length} />
        <KPI title="Avg Performance" value={`${agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.performance_score, 0) / agents.length) : 0}%`} color="text-indigo-600" />
        <KPI title="Total Runs" value={agents.reduce((s, a) => s + a.total_executions, 0)} />
        <KPI title="Idle Agents" value={agents.filter((a) => a.status === 'idle').length} color="text-slate-600" />
      </div>

      {/* Workflow Execution */}
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
                  <Input
                    name="input"
                    placeholder={`Describe your ${wf.name.toLowerCase()}...`}
                    required
                  />
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

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Agent Overview */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Agent Overview</h2>
            <Link href="/dashboard/orchestrator/agents" className="text-xs text-slate-500 hover:text-slate-700">View all</Link>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {agents.map((agent) => (
              <Link key={agent.id} href={`/dashboard/agents/${agent.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{agent.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getAgentStatusVariant(agent.status)}><span className="text-[10px]">{agent.status}</span></Badge>
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
              <div key={task.id} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900 text-sm">{task.title}</p>
                  <div className="flex items-center gap-1">
                    <Badge variant={getStatusVariant(task.status)}><span className="text-[10px]">{task.status.replace(/_/g, ' ')}</span></Badge>
                    <Badge variant={getPriorityVariant(task.priority)}><span className="text-[10px]">{task.priority}</span></Badge>
                  </div>
                </div>
                {task.agent_name && <p className="text-xs text-slate-500 mt-1">Assigned: {task.agent_name}</p>}
              </div>
            ))}
            {tasks.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No tasks delegated yet.</p>}
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
                  <span>{msg.from_agent_name} → {msg.to_agent_name}</span>
                  <span>{formatDateTime(msg.created_at)}</span>
                </div>
                <p className="text-sm text-slate-700">{(msg.message || '').slice(0, 200)}{(msg.message || '').length > 200 ? '...' : ''}</p>
              </div>
            ))}
            {messages.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No messages yet.</p>}
          </div>
        </div>

        {/* Performance Summary */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Performance Summary</h2>
          {agents.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">No agents registered.</p> : (
            <div className="space-y-4">
              {[...agents].sort((a, b) => b.performance_score - a.performance_score).slice(0, 5).map((agent) => (
                <div key={agent.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{agent.name}</span>
                    <span className="font-semibold text-slate-900">{agent.performance_score}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${agent.performance_score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div>
}
