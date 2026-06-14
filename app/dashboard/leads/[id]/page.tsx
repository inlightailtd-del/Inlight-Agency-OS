import Link from 'next/link'; import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'; import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { analyzeLead } from '@/lib/ai/lead-analyzer'
import { fetchLeadById, deleteLead, getSourceLabel, getStatusVariant, getStatusLabel } from '@/lib/supabase/leads'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient(); const lead = await fetchLeadById(supabase, params.id)
  if (!lead) notFound()
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">{lead.name}</h1><div className="flex flex-wrap items-center gap-2 mt-2"><Badge variant={getStatusVariant(lead.status)}>{getStatusLabel(lead.status)}</Badge><Badge variant="default">{getSourceLabel(lead.source)}</Badge>{lead.score > 0 && <Badge variant="info">Score: {lead.score}</Badge>}</div></div>
        <div className="flex flex-wrap gap-3"><Link href="/dashboard/leads" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link><Link href={`/dashboard/leads/${lead.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Edit</Link>{lead.score === 0 && (<form action={analyzeAction}><input type="hidden" name="id" value={lead.id} /><Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white">Analyze Lead</Button></form>)}<form action={deleteAction}><input type="hidden" name="id" value={lead.id} /><Button type="submit" variant="destructive">Delete</Button></form></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Company" value={lead.company ?? '—'} /><DetailRow label="Email" value={lead.email ?? '—'} /><DetailRow label="Phone" value={lead.phone ?? '—'} />
            <DetailRow label="Website" value={lead.website ?? '—'} /><DetailRow label="Industry" value={lead.industry ?? '—'} /><DetailRow label="Country" value={lead.country ?? '—'} />
            <DetailRow label="Source" value={getSourceLabel(lead.source)} /><DetailRow label="Status" value={getStatusLabel(lead.status)} /><DetailRow label="Score" value={String(lead.score)} />
          </div>
          {lead.notes && <div className="mt-6 pt-6 border-t border-slate-200"><h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3><p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{lead.notes}</p></div>}
          {lead.tags && lead.tags.length > 0 && <div className="mt-6 pt-6 border-t border-slate-200 flex flex-wrap gap-2">{lead.tags.map((t) => (<Badge key={t} variant="default">#{t}</Badge>))}</div>}
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-sm font-semibold text-slate-900 mb-4">Details</h3><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Status</span><Badge variant={getStatusVariant(lead.status)}>{getStatusLabel(lead.status)}</Badge></div><div className="flex justify-between"><span className="text-slate-500">Source</span><span className="font-medium">{getSourceLabel(lead.source)}</span></div><div className="flex justify-between"><span className="text-slate-500">Score</span><span className="font-semibold text-sky-600">{lead.score}</span></div></div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500"><p>Created: {formatDateTime(lead.created_at)}</p>{lead.updated_at && <p className="mt-1">Updated: {formatDateTime(lead.updated_at)}</p>}</div>
        </div>
      </div>
    </div>
  )
}
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-sm font-medium text-slate-900">{value}</p></div> }
async function deleteAction(fd: FormData) { 'use server'; const s = await createClient(); await deleteLead(s, String(fd.get('id')||'')); revalidatePath('/dashboard/leads'); redirect('/dashboard/leads') }
async function analyzeAction(fd: FormData) { 'use server'; const id = String(fd.get('id')||''); const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user?.id) throw new Error('Not authenticated'); await analyzeLead(supabase, user.id, id); revalidatePath(`/dashboard/leads/${id}`); redirect(`/dashboard/leads/${id}`) }
