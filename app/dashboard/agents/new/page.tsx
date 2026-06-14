import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { agentFormSchema, agentTypes, agentStatuses, agentDepartments, createAgent, getAgentTypeLabel, getDepartmentLabel } from '@/lib/supabase/agents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function createAgentAction(formData: FormData) {
  'use server'
  const raw = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const result = agentFormSchema.safeParse(raw)
  if (!result.success) throw new Error(result.error.message)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await createAgent(supabase, user.id, result.data)
  revalidatePath('/dashboard/agents')
  redirect('/dashboard/agents')
}

export default function NewAgentPage() {
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Add Agent</h1><p className="text-sm text-slate-500 mt-1">Register a new AI employee with type, role, and department.</p></div>
        <Link href="/dashboard/agents" className="text-slate-700 hover:text-slate-900">Back</Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createAgentAction} className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="name">Name <span className="text-red-500">*</span></label><Input id="name" name="name" required placeholder="AI Sales Assistant" /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="role">Role</label><Input id="role" name="role" placeholder="Senior Sales Agent" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="description">Description</label><Textarea id="description" name="description" placeholder="Describe what this agent does..." /></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="type">Type</label><Select id="type" name="type" defaultValue="general">{agentTypes.map((t) => (<option key={t} value={t}>{getAgentTypeLabel(t)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue="offline">{agentStatuses.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="department">Department</label><Select id="department" name="department"><option value="">— None —</option>{agentDepartments.map((d) => (<option key={d} value={d}>{getDepartmentLabel(d)}</option>))}</Select></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="performance_score">Performance (0-100)</label><Input id="performance_score" name="performance_score" type="number" min="0" max="100" defaultValue="0" /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="success_rate">Success Rate (%)</label><Input id="success_rate" name="success_rate" type="number" min="0" max="100" defaultValue="0" /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="avg_response_time_ms">Avg Response (ms)</label><Input id="avg_response_time_ms" name="avg_response_time_ms" type="number" min="0" defaultValue="0" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><Link href="/dashboard/agents" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Create agent</Button></div>
        </form>
      </div>
    </div>
  )
}