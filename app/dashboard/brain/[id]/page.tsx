import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  fetchKnowledgeDocById,
  fetchDocVersions,
  deleteKnowledgeDoc,
  getCategoryLabel,
  getDepartmentLabel,
  getStatusVariant,
} from '@/lib/supabase/brain'

export default async function BrainDocDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const doc = await fetchKnowledgeDocById(supabase, params.id)
  const versions = await fetchDocVersions(supabase, params.id)
  if (!doc) notFound()

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={getStatusVariant(doc.status)}>{doc.status}</Badge>
            <Badge variant="default">{getCategoryLabel(doc.category)}</Badge>
            {doc.department && <Badge variant="default">{getDepartmentLabel(doc.department)}</Badge>}
            <span className="text-xs text-slate-400">v{doc.version}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/brain" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link>
          <Link href={`/dashboard/brain/${doc.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Edit</Link>
          <form action={deleteAction}><input type="hidden" name="docId" value={doc.id} /><Button type="submit" variant="destructive">Delete</Button></form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="prose prose-slate max-w-none text-sm leading-7 whitespace-pre-wrap">
            {doc.content || <span className="text-slate-400 italic">No content yet.</span>}
          </div>
          {doc.tags && doc.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200 flex flex-wrap gap-2">
              {doc.tags.map((t) => (<Badge key={t} variant="default">#{t}</Badge>))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Document Info</h3>
            <div className="space-y-3 text-sm">
              <DetailRow label="Category" value={getCategoryLabel(doc.category)} />
              <DetailRow label="Department" value={getDepartmentLabel(doc.department)} />
              <DetailRow label="Status" value={doc.status} />
              <DetailRow label="Version" value={`v${doc.version}`} />
              <DetailRow label="Created" value={formatDateTime(doc.created_at)} />
              {doc.updated_at && <DetailRow label="Updated" value={formatDateTime(doc.updated_at)} />}
            </div>
          </div>

          {/* Version History */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Version History ({versions.length})</h3>
            {versions.length === 0 ? (
              <p className="text-sm text-slate-500">No previous versions.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {versions.map((v) => (
                  <div key={v.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900 text-sm">v{v.version}</span>
                      <span className="text-xs text-slate-400">{formatDate(v.created_at)}</span>
                    </div>
                    {v.change_summary && <p className="text-xs text-slate-500 mt-1">{v.change_summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}

async function deleteAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await deleteKnowledgeDoc(supabase, String(formData.get('docId') || ''))
  revalidatePath('/dashboard/brain')
  redirect('/dashboard/brain')
}