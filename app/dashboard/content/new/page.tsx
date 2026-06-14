import Link from 'next/link'
import { redirect } from 'next/navigation'; import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { contentFormSchema, contentTypes, platforms, tones, createContentRequest, getContentTypeLabel, getPlatformLabel, getToneLabel } from '@/lib/supabase/content'
import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input'; import { Select } from '@/components/ui/select'; import { Textarea } from '@/components/ui/textarea'

async function createAction(fd: FormData) { 'use server'; const raw = Object.fromEntries(Array.from(fd.entries(), ([k, v]) => [k, typeof v === 'string' ? v : ''])); if (raw.platform === '') delete raw.platform; const r = contentFormSchema.safeParse(raw); if (!r.success) throw new Error(r.error.message); const s = await createClient(); const { data: { user } } = await s.auth.getUser(); if (!user?.id) throw new Error('Not authenticated'); await createContentRequest(s, user.id, r.data); revalidatePath('/dashboard/content'); redirect('/dashboard/content') }

export default function NewContentPage() {
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">New Content Request</h1><p className="text-sm text-slate-500 mt-1">Request AI-generated content for blogs, social media, ads, or landing pages.</p></div>
        <Link href="/dashboard/content" className="text-slate-700 hover:text-slate-900">Back</Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createAction} className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="title">Title <span className="text-red-500">*</span></label><Input id="title" name="title" required placeholder="10 LinkedIn Growth Strategies" /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="tags">Tags (comma separated)</label><Input id="tags" name="tags" placeholder="linkedin, growth, marketing" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="description">Description / Brief</label><Textarea id="description" name="description" placeholder="Describe the content you need, target audience, key points..." rows={4} /></div>
          <div className="grid gap-6 lg:grid-cols-4">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="content_type">Content Type</label><Select id="content_type" name="content_type" defaultValue="blog">{contentTypes.map((t) => (<option key={t} value={t}>{getContentTypeLabel(t)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="platform">Platform</label><Select id="platform" name="platform"><option value="">— Select —</option>{platforms.map((p) => (<option key={p} value={p}>{getPlatformLabel(p)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="tone">Tone</label><Select id="tone" name="tone" defaultValue="professional">{tones.map((t) => (<option key={t} value={t}>{getToneLabel(t)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="word_count">Target Words</label><Input id="word_count" name="word_count" type="number" min="0" placeholder="500" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><Link href="/dashboard/content" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Create Request</Button></div>
        </form>
      </div>
    </div>
  )
}