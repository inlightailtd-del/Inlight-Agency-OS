import Link from 'next/link'; import { redirect } from 'next/navigation'; import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { leadFormSchema, leadSources, leadStatuses, fetchLeadById, updateLead, deleteLead, getSourceLabel, getStatusLabel } from '@/lib/supabase/leads'
import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input'; import { Select } from '@/components/ui/select'; import { Textarea } from '@/components/ui/textarea'

async function updateAction(fd: FormData) { 'use server'; const raw = Object.fromEntries(Array.from(fd.entries(), ([k, v]) => [k, typeof v === 'string' ? v : ''])); const id = String(raw.id||''); if (!id) throw new Error('Missing ID'); const r = leadFormSchema.safeParse(raw); if (!r.success) throw new Error(r.error.message); const s = await createClient(); await updateLead(s, id, r.data); revalidatePath('/dashboard/leads'); revalidatePath(`/dashboard/leads/${id}`); redirect(`/dashboard/leads/${id}`) }
async function deleteAction(fd: FormData) { 'use server'; const s = await createClient(); await deleteLead(s, String(fd.get('id')||'')); revalidatePath('/dashboard/leads'); redirect('/dashboard/leads') }

export default async function EditLeadPage({ params }: { params: { id: string } }) {
  const supabase = await createClient(); const lead = await fetchLeadById(supabase, params.id)
  if (!lead) return <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><p className="text-slate-600">Not found.</p><Link href="/dashboard/leads" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm">Back</Link></div>
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Edit Lead</h1><p className="text-sm text-slate-500 mt-1">{lead.name}</p></div>
        <div className="flex gap-3"><Link href={`/dashboard/leads/${lead.id}`} className="text-slate-700 hover:text-slate-900">View</Link><form action={deleteAction}><input type="hidden" name="id" value={lead.id} /><Button type="submit" variant="destructive">Delete</Button></form></div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateAction} className="grid gap-6">
          <input type="hidden" name="id" value={lead.id} />
          <div className="grid gap-6 lg:grid-cols-2"><div><label className="text-sm font-medium text-slate-700" htmlFor="name">Name *</label><Input id="name" name="name" required defaultValue={lead.name} /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="company">Company</label><Input id="company" name="company" defaultValue={lead.company??''} /></div></div>
          <div className="grid gap-6 lg:grid-cols-2"><div><label className="text-sm font-medium text-slate-700" htmlFor="email">Email</label><Input id="email" name="email" type="email" defaultValue={lead.email??''} /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="phone">Phone</label><Input id="phone" name="phone" defaultValue={lead.phone??''} /></div></div>
          <div className="grid gap-6 lg:grid-cols-3"><div><label className="text-sm font-medium text-slate-700" htmlFor="website">Website</label><Input id="website" name="website" defaultValue={lead.website??''} /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="industry">Industry</label><Input id="industry" name="industry" defaultValue={lead.industry??''} /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="country">Country</label><Input id="country" name="country" defaultValue={lead.country??''} /></div></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="source">Source</label><Select id="source" name="source" defaultValue={lead.source}>{leadSources.map((s) => (<option key={s} value={s}>{getSourceLabel(s)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue={lead.status}>{leadStatuses.map((s) => (<option key={s} value={s}>{getStatusLabel(s)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="score">Score</label><Input id="score" name="score" type="number" min="0" max="100" defaultValue={String(lead.score)} /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="tags">Tags</label><Input id="tags" name="tags" defaultValue={lead.tags?.join(', ')??''} /></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="notes">Notes</label><Textarea id="notes" name="notes" defaultValue={lead.notes??''} /></div>
          <div className="flex justify-end gap-3 pt-2"><Link href={`/dashboard/leads/${lead.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Save</Button></div>
        </form>
      </div>
    </div>
  )
}