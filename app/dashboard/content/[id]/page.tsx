import Link from 'next/link'
import { notFound } from 'next/navigation'; import { revalidatePath } from 'next/cache'; import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'; import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { generateContent } from '@/lib/ai/content-engine'
import { fetchContentById, deleteContentRequest, getContentTypeLabel, getStatusVariant, getPlatformLabel, getToneLabel } from '@/lib/supabase/content'

export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient(); const item = await fetchContentById(supabase, params.id)
  if (!item) notFound()

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">{item.title}</h1><div className="flex flex-wrap items-center gap-2 mt-2"><Badge variant={getStatusVariant(item.status)}>{item.status}</Badge><Badge variant="default">{getContentTypeLabel(item.content_type)}</Badge>{item.platform && <Badge variant="default">{getPlatformLabel(item.platform)}</Badge>}</div></div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/content" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link>
          <Link href={`/dashboard/content/${item.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Edit</Link>
          {(item.status === 'draft' || item.status === 'failed') && (
            <form action={generateAction}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Generate Now</Button>
            </form>
          )}
          <form action={deleteAction}><input type="hidden" name="id" value={item.id} /><Button type="submit" variant="destructive">Delete</Button></form>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Type" value={getContentTypeLabel(item.content_type)} />
            <DetailRow label="Platform" value={getPlatformLabel(item.platform)} />
            <DetailRow label="Tone" value={getToneLabel(item.tone)} />
            <DetailRow label="Status" value={item.status} />
            {item.word_count && <DetailRow label="Target Words" value={String(item.word_count)} />}
            {item.score > 0 && <DetailRow label="Score" value={`${item.score}%`} />}
          </div>
          {item.description && <div className="mt-6 pt-6 border-t border-slate-200"><h3 className="text-sm font-semibold text-slate-900 mb-2">Brief</h3><p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{item.description}</p></div>}
          {item.generated_content && <div className="mt-6 pt-6 border-t border-slate-200"><h3 className="text-sm font-semibold text-slate-900 mb-2">Generated Content</h3><div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border">{item.generated_content}</div></div>}
          {item.tags && item.tags.length > 0 && <div className="mt-6 pt-6 border-t border-slate-200 flex flex-wrap gap-2">{item.tags.map((t) => (<Badge key={t} variant="default">#{t}</Badge>))}</div>}
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Status</span><Badge variant={getStatusVariant(item.status)}>{item.status}</Badge></div>
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium">{getContentTypeLabel(item.content_type)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Platform</span><span className="font-medium">{getPlatformLabel(item.platform)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tone</span><span className="font-medium">{getToneLabel(item.tone)}</span></div>
              {item.feedback && <div className="pt-3 border-t border-slate-200"><span className="text-slate-500">Feedback</span><p className="text-slate-700 mt-1">{item.feedback}</p></div>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
            <p>Created: {formatDateTime(item.created_at)}</p>
            {item.updated_at && <p className="mt-1">Updated: {formatDateTime(item.updated_at)}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-sm font-medium text-slate-900">{value}</p></div> }
async function deleteAction(fd: FormData) { 'use server'; const s = await createClient(); await deleteContentRequest(s, String(fd.get('id')||'')); revalidatePath('/dashboard/content'); redirect('/dashboard/content') }
async function generateAction(fd: FormData) { 'use server'; const id = String(fd.get('id')||''); const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user?.id) throw new Error('Not authenticated'); const item = await fetchContentById(supabase, id); if (!item) throw new Error('Content not found'); await generateContent(supabase, user.id, id, { title: item.title, description: item.description || '', content_type: item.content_type, platform: item.platform || undefined, tone: item.tone, word_count: item.word_count || undefined }); revalidatePath(`/dashboard/content/${id}`); redirect(`/dashboard/content/${id}`) }
