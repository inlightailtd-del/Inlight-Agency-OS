import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { fetchAgentById, deleteAgent, getAgentTypeLabel, getAgentStatusVariant, getDepartmentLabel } from '@/lib/supabase/agents'

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const agent = await fetchAgentById(supabase, params.id)
  if (!agent) notFound()

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{agent.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={getAgentStatusVariant(agent.status)}>{agent.status}</Badge>
            <Badge variant="default">{getAgentTypeLabel(agent.type)}</Badge>
            {agent.department && <Badge variant="default">{getDepartmentLabel(agent.department)}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/agents" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link>
          <Link href={`/dashboard/agents/${agent.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Edit</Link>
          <form action={deleteAction}><input type="hidden" name="agentId" value={agent.id} /><Button type="submit" variant="destructive">Delete</Button></form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {agent.role && <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 p-4"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Role</p><p className="mt-1 text-lg font-semibold text-slate-900">{agent.role}</p></div>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Type" value={getAgentTypeLabel(agent.type)} />
            <DetailRow label="Status" value={agent.status} />
            <DetailRow label="Department" value={getDepartmentLabel(agent.department)} />
            <DetailRow label="Assigned Tasks" value={String(agent.assigned_tasks)} />
            <DetailRow label="Assigned Projects" value={String(agent.assigned_projects)} />
          </div>
          {agent.description && <div className="mt-6 pt-6 border-t border-slate-200"><h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3><p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{agent.description}</p></div>}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              <MetricRow label="Performance Score" value={agent.performance_score} max={100} unit="%" color="bg-sky-500" />
              <MetricRow label="Success Rate" value={agent.success_rate} max={100} unit="%" color="bg-emerald-500" />
              <div className="flex justify-between text-sm"><span className="text-slate-500">Total Executions</span><span className="font-semibold text-slate-900">{agent.total_executions}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Avg Response Time</span><span className="font-semibold text-slate-900">{agent.avg_response_time_ms}ms</span></div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
            <p>Created: {formatDateTime(agent.created_at)}</p>
            {agent.updated_at && <p className="mt-1">Updated: {formatDateTime(agent.updated_at)}</p>}
            {agent.last_active_at && <p className="mt-1">Last Active: {formatDateTime(agent.last_active_at)}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-sm font-medium text-slate-900">{value}</p></div> }

function MetricRow({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-900">{value}{unit}</span></div>
      <div className="h-3 w-full rounded-full bg-slate-200"><div className={`h-full rounded-full ${color}`} style={{width:`${Math.min(100,(value/max)*100)}%`}} /></div>
    </div>
  )
}

async function deleteAction(formData: FormData) { 'use server'; const s = await createClient(); await deleteAgent(s, String(formData.get('agentId')||'')); revalidatePath('/dashboard/agents'); redirect('/dashboard/agents') }