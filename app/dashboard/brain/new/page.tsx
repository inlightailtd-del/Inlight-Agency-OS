import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  knowledgeDocFormSchema,
  knowledgeCategories,
  knowledgeDepartments,
  knowledgeStatuses,
  createKnowledgeDoc,
  getCategoryLabel,
  getDepartmentLabel,
} from '@/lib/supabase/brain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function createDocAction(formData: FormData) {
  'use server'
  const rawValues = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const result = knowledgeDocFormSchema.safeParse(rawValues)
  if (!result.success) throw new Error(result.error.message)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  const newDoc = await createKnowledgeDoc(supabase, user.id, result.data)

  // Auto-index into Company Brain vector store (non-blocking)
  try {
    // Fetch the created doc to get its ID
    const { data: docs } = await supabase
      .from('knowledge_docs')
      .select('id, title, content, category, tags')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (docs && docs.length > 0) {
      const doc = docs[0] as any
      const { indexKnowledgeDoc } = await import('@/lib/brain/embeddings')
      await indexKnowledgeDoc(supabase, user.id, {
        id: doc.id,
        title: doc.title,
        content: doc.content || '',
        category: doc.category || 'general',
        tags: doc.tags || [],
      })
    }
  } catch (err) {
    // Indexing is non-blocking — don't fail the creation
  }

  revalidatePath('/dashboard/brain')
  redirect('/dashboard/brain')
}

export default function NewBrainDocPage() {
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">New Document</h1><p className="text-sm text-slate-500 mt-1">Create an SOP, wiki, policy, guide, or template for the company knowledge base.</p></div>
        <Link href="/dashboard/brain" className="text-slate-700 hover:text-slate-900">Back</Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createDocAction} className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="title">Title <span className="text-red-500">*</span></label><Input id="title" name="title" required placeholder="Employee Onboarding SOP" /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="tags">Tags (comma separated)</label><Input id="tags" name="tags" placeholder="hr, onboarding, checklist" /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="category">Category</label><Select id="category" name="category" defaultValue="general">{knowledgeCategories.map((c) => (<option key={c} value={c}>{getCategoryLabel(c)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="department">Department</label><Select id="department" name="department"><option value="">— None —</option>{knowledgeDepartments.map((d) => (<option key={d} value={d}>{getDepartmentLabel(d)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue="published">{knowledgeStatuses.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}</Select></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="content">Content</label><Textarea id="content" name="content" rows={12} placeholder="Write the document content here (Markdown supported)..." /></div>
          <div className="flex justify-end gap-3 pt-2"><Link href="/dashboard/brain" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Create document</Button></div>
        </form>
      </div>
    </div>
  )
}