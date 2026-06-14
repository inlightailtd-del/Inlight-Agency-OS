import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { automationFormSchema, automationCategories, automationStatuses, triggerTypes, createAutomation, getCategoryLabel } from '@/lib/supabase/automations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function createAutomationAction(formData: FormData) {
  'use server'
  const raw = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const result = automationFormSchema.safeParse(raw)
  if (!result.success) throw new Error(result.error.message)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await createAutomation(supabase, user.id, result.data)
  revalidatePath('/dashboard/automations')
  redirect('/dashboard/automations')
}

export default function NewAutomationPage() {
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">New Automation</h1><p className="text-sm text-slate-500 mt-1">Create a new AI-powered workflow automation.</p></div>
        <Link href="/dashboard/automations" className="text-slate-700 hover:text-slate-900">Back</Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createAutomationAction} className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="name">Name <span className="text-red-500">*</span></label><Input id="name" name="name" required placeholder="Lead Follow-up Bot" /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="schedule_cron">Schedule (Cron)</label><Input id="schedule_cron" name="schedule_cron" placeholder="0 */6 * * *" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="description">Description</label><Textarea id="description" name="description" placeholder="Describe what this automation does..." /></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="category">Category</label><Select id="category" name="category" defaultValue="internal">{automationCategories.map((c) => (<option key={c} value={c}>{getCategoryLabel(c)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue="draft">{automationStatuses.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="trigger_type">Trigger Type</label><Select id="trigger_type" name="trigger_type" defaultValue="manual">{triggerTypes.map((t) => (<option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>))}</Select></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><Link href="/dashboard/automations" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Create automation</Button></div>
        </form>
      </div>
    </div>
  )
}