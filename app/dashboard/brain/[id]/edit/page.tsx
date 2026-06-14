import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  knowledgeDocFormSchema,
  knowledgeCategories,
  knowledgeDepartments,
  knowledgeStatuses,
  fetchKnowledgeDocById,
  updateKnowledgeDoc,
  deleteKnowledgeDoc,
  getCategoryLabel,
  getDepartmentLabel,
} from '@/lib/supabase/brain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateDocAction(formData: FormData) {
  'use server'
  const rawValues = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const docId = String(rawValues.id || '')
  if (!docId) throw new Error('Missing doc ID')
  const result = knowledgeDocFormSchema.safeParse(rawValues)
  if (!result.success) throw new Error(result.error.message)
  const supabase = await createClient()
  await updateKnowledgeDoc(supabase, docId, {
    ...result.data,
    change_summary: String(rawValues.change_summary || ''),
  })
  revalidatePath('/dashboard/brain')
  revalidatePath(`/dashboard/brain/${docId}`)
  redirect(`/dashboard/brain/${docId}`)
}

async function deleteAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await deleteKnowledgeDoc(supabase, String(formData.get('docId') || ''))
  revalidatePath('/dashboard/brain')
  redirect('/dashboard/brain')
}

export default async function EditBrainDocPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const doc = await fetchKnowledgeDocById(supabase, params.id)
  if (!doc) return <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><p className="text-slate-600">Document not found.</p><Link href="/dashboard/brain" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link></div>

  const tagsString = doc.tags?.join(', ') ?? ''

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Edit Document</h1><p className="text-sm text-slate-500 mt-1">{doc.title}</p></div>
        <div className="flex gap-3">
          <Link href={`/dashboard/brain/${doc.id}`} className="text-slate-700 hover:text-slate-900">View</Link>
          <form action={deleteAction}><input type="hidden" name="docId" value={doc.id} /><Button type="submit" variant="destructive">Delete</Button></form>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateDocAction} className="grid gap-6">
          <input type="hidden" name="id" value={doc.id} />
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="title">Title <span className="text-red-500">*</span></label><Input id="title" name="title" required defaultValue={doc.title} /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="tags">Tags (comma separated)</label><Input id="tags" name="tags" defaultValue={tagsString} /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="category">Category</label><Select id="category" name="category" defaultValue={doc.category}>{knowledgeCategories.map((c) => (<option key={c} value={c}>{getCategoryLabel(c)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="department">Department</label><Select id="department" name="department" defaultValue={doc.department ?? ''}><option value="">— None —</option>{knowledgeDepartments.map((d) => (<option key={d} value={d}>{getDepartmentLabel(d)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue={doc.status}>{knowledgeStatuses.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}</Select></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="change_summary">Change summary</label><Input id="change_summary" name="change_summary" placeholder="Brief description of changes made" /></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="content">Content</label><Textarea id="content" name="content" rows={12} defaultValue={doc.content ?? ''} /></div>
          <div className="flex justify-end gap-3 pt-2"><Link href={`/dashboard/brain/${doc.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Save changes</Button></div>
        </form>
      </div>
    </div>
  )
}