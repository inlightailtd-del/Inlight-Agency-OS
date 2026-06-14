import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { agentFormSchema, agentTypes, agentStatuses, agentDepartments, fetchAgentById, updateAgent, deleteAgent, getAgentTypeLabel, getDepartmentLabel } from '@/lib/supabase/agents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateAgentAction(formData: FormData) { 'use server'; const raw = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : ''])); const id = String(raw.id||''); if (!id) throw new Error('Missing ID'); const r = agentFormSchema.safeParse(raw); if (!r.success) throw new Error(r.error.message); const s = await createClient(); await updateAgent(s, id, r.data); revalidatePath('/dashboard/agents'); revalidatePath(`/dashboard/agents/${id}`); redirect(`/dashboard/agents/${id}`) }
async function deleteAction(formData: FormData) { 'use server'; const s = await createClient(); await deleteAgent(s, String(formData.get('agentId')||'')); revalidatePath('/dashboard/agents'); redirect('/dashboard/agents') }

export default async function EditAgentPage({ params }: { params: { id: string } }) {
  const supabase = await createClient(); const agent = await fetchAgentById(supabase, params.id)
  if (!agent) return <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><p className="text-slate-600">Agent not found.</p><Link href="/dashboard/agents" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm">Back</Link></div>

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6"><div><h1 className="text-3xl font-bold text-slate-900">Edit Agent</h1><p className="text-sm text-slate-500 mt-1">{agent.name}</p></div><div className="flex gap-3"><Link href={`/dashboard/agents/${agent.id}`} className="text-slate-700 hover:text-slate-900">View</Link><form action={deleteAction}><input type="hidden" name="agentId" value={agent.id} /><Button type="submit" variant="destructive">Delete</Button></form></div></div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateAgentAction} className="grid gap-6">
          <input type="hidden" name="id" value={agent.id} />
          <div className="grid gap-6 lg:grid-cols-2"><div><label className="text-sm font-medium text-slate-700" htmlFor="name">Name <span className="text-red-500">*</span></label><Input id="name" name="name" required defaultValue={agent.name} /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="role">Role</label><Input id="role" name="role" defaultValue={agent.role??''} /></div></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="description">Description</label><Textarea id="description" name="description" defaultValue={agent.description??''} /></div>
          <div className="grid gap-6 lg:grid-cols-3"><div><label className="text-sm font-medium text-slate-700" htmlFor="type">Type</label><Select id="type" name="type" defaultValue={agent.type}>{agentTypes.map((t) => (<option key={t} value={t}>{getAgentTypeLabel(t)}</option>))}</Select></div><div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue={agent.status}>{agentStatuses.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>))}</Select></div><div><label className="text-sm font-medium text-slate-700" htmlFor="department">Department</label><Select id="department" name="department" defaultValue={agent.department??''}><option value="">— None —</option>{agentDepartments.map((d) => (<option key={d} value={d}>{getDepartmentLabel(d)}</option>))}</Select></div></div>
          <div className="grid gap-6 lg:grid-cols-3"><div><label className="text-sm font-medium text-slate-700" htmlFor="performance_score">Performance</label><Input id="performance_score" name="performance_score" type="number" min="0" max="100" defaultValue={String(agent.performance_score)} /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="success_rate">Success Rate</label><Input id="success_rate" name="success_rate" type="number" min="0" max="100" defaultValue={String(agent.success_rate)} /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="avg_response_time_ms">Avg Response (ms)</label><Input id="avg_response_time_ms" name="avg_response_time_ms" type="number" min="0" defaultValue={String(agent.avg_response_time_ms)} /></div></div>
          <div className="flex justify-end gap-3 pt-2"><Link href={`/dashboard/agents/${agent.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Save changes</Button></div>
        </form>
      </div>
    </div>
  )
}