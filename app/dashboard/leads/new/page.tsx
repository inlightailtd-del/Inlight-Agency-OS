import Link from 'next/link'; import { redirect } from 'next/navigation'; import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { leadFormSchema, leadSources, leadStatuses, createLead, getSourceLabel, getStatusLabel } from '@/lib/supabase/leads'
import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input'; import { Select } from '@/components/ui/select'; import { Textarea } from '@/components/ui/textarea'

async function createAction(fd: FormData) { 'use server'; const raw = Object.fromEntries(Array.from(fd.entries(), ([k, v]) => [k, typeof v === 'string' ? v : ''])); const r = leadFormSchema.safeParse(raw); if (!r.success) throw new Error(r.error.message); const s = await createClient(); const { data: { user } } = await s.auth.getUser(); if (!user?.id) throw new Error('Not authenticated'); await createLead(s, user.id, r.data); revalidatePath('/dashboard/leads'); redirect('/dashboard/leads') }

export default function NewLeadPage() {
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Add Lead</h1><p className="text-sm text-slate-500 mt-1">Capture a new lead from any source.</p></div>
        <Link href="/dashboard/leads" className="text-slate-700 hover:text-slate-900">Back</Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createAction} className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2"><div><label className="text-sm font-medium text-slate-700" htmlFor="name">Name <span className="text-red-500">*</span></label><Input id="name" name="name" required placeholder="John Doe" /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="company">Company</label><Input id="company" name="company" placeholder="Acme Corp" /></div></div>
          <div className="grid gap-6 lg:grid-cols-2"><div><label className="text-sm font-medium text-slate-700" htmlFor="email">Email</label><Input id="email" name="email" type="email" placeholder="john@acme.com" /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="phone">Phone</label><Input id="phone" name="phone" placeholder="+1 234 567 890" /></div></div>
          <div className="grid gap-6 lg:grid-cols-3"><div><label className="text-sm font-medium text-slate-700" htmlFor="website">Website</label><Input id="website" name="website" placeholder="https://acme.com" /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="industry">Industry</label><Input id="industry" name="industry" placeholder="Technology" /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="country">Country</label><Input id="country" name="country" placeholder="United States" /></div></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="source">Source</label><Select id="source" name="source" defaultValue="manual">{leadSources.map((s) => (<option key={s} value={s}>{getSourceLabel(s)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue="new">{leadStatuses.map((s) => (<option key={s} value={s}>{getStatusLabel(s)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="score">Score (0-100)</label><Input id="score" name="score" type="number" min="0" max="100" defaultValue="0" /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2"><div><label className="text-sm font-medium text-slate-700" htmlFor="tags">Tags</label><Input id="tags" name="tags" placeholder="hot, enterprise, ready" /></div></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="notes">Notes</label><Textarea id="notes" name="notes" placeholder="Lead details, context, next steps..." /></div>
          <div className="flex justify-end gap-3 pt-2"><Link href="/dashboard/leads" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Add Lead</Button></div>
        </form>
      </div>
    </div>
  )
}