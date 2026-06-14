import Link from 'next/link'; import { redirect } from 'next/navigation'; import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { contentFormSchema, contentTypes, platforms, tones, fetchContentById, updateContentRequest, deleteContentRequest, getContentTypeLabel, getPlatformLabel, getToneLabel } from '@/lib/supabase/content'
import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input'; import { Select } from '@/components/ui/select'; import { Textarea } from '@/components/ui/textarea'

async function updateAction(fd: FormData) { 'use server'; const raw = Object.fromEntries(Array.from(fd.entries(), ([k, v]) => [k, typeof v === 'string' ? v : ''])); const id = String(raw.id||''); if (!id) throw new Error('Missing ID'); const r = contentFormSchema.safeParse(raw); if (!r.success) throw new Error(r.error.message); const s = await createClient(); await updateContentRequest(s, id, r.data); revalidatePath('/dashboard/content'); revalidatePath(`/dashboard/content/${id}`); redirect(`/dashboard/content/${id}`) }
async function deleteAction(fd: FormData) { 'use server'; const s = await createClient(); await deleteContentRequest(s, String(fd.get('id')||'')); revalidatePath('/dashboard/content'); redirect('/dashboard/content') }

export default async function EditContentPage({ params }: { params: { id: string } }) {
  const supabase = await createClient(); const item = await fetchContentById(supabase, params.id)
  if (!item) return <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><p className="text-slate-600">Not found.</p><Link href="/dashboard/content" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm">Back</Link></div>
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Edit Content</h1><p className="text-sm text-slate-500 mt-1">{item.title}</p></div>
        <div className="flex gap-3"><Link href={`/dashboard/content/${item.id}`} className="text-slate-700 hover:text-slate-900">View</Link><form action={deleteAction}><input type="hidden" name="id" value={item.id} /><Button type="submit" variant="destructive">Delete</Button></form></div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateAction} className="grid gap-6">
          <input type="hidden" name="id" value={item.id} />
          <div className="grid gap-6 lg:grid-cols-2"><div><label className="text-sm font-medium text-slate-700" htmlFor="title">Title <span className="text-red-500">*</span></label><Input id="title" name="title" required defaultValue={item.title} /></div><div><label className="text-sm font-medium text-slate-700" htmlFor="tags">Tags</label><Input id="tags" name="tags" defaultValue={item.tags?.join(', ')??''} /></div></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="description">Brief</label><Textarea id="description" name="description" defaultValue={item.description??''} rows={4} /></div>
          <div className="grid gap-6 lg:grid-cols-4">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="content_type">Type</label><Select id="content_type" name="content_type" defaultValue={item.content_type}>{contentTypes.map((t) => (<option key={t} value={t}>{getContentTypeLabel(t)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="platform">Platform</label><Select id="platform" name="platform" defaultValue={item.platform??''}><option value="">—</option>{platforms.map((p) => (<option key={p} value={p}>{getPlatformLabel(p)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="tone">Tone</label><Select id="tone" name="tone" defaultValue={item.tone}>{tones.map((t) => (<option key={t} value={t}>{getToneLabel(t)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="word_count">Words</label><Input id="word_count" name="word_count" type="number" defaultValue={item.word_count??''} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><Link href={`/dashboard/content/${item.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Save</Button></div>
        </form>
      </div>
    </div>
  )
}