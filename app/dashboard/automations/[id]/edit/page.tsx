import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { automationFormSchema, automationCategories, automationStatuses, triggerTypes, fetchAutomationById, updateAutomation, deleteAutomation, getCategoryLabel } from '@/lib/supabase/automations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateAutomationAction(formData: FormData) {
  'use server'
  const raw = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const id = String(raw.id || '')
  if (!id) throw new Error('Missing ID')
  const result = automationFormSchema.safeParse(raw)
  if (!result.success) throw new Error(result.error.message)
  const supabase = await createClient()
  await updateAutomation(supabase, id, result.data)
  revalidatePath('/dashboard/automations')
  revalidatePath(`/dashboard/automations/${id}`)
  redirect(`/dashboard/automations/${id}`)
}

async function deleteAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await deleteAutomation(supabase, String(formData.get('automationId') || ''))
  revalidatePath('/dashboard/automations')
  redirect('/dashboard/automations')
}

export default async function EditAutomationPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const automation = await fetchAutomationById(supabase, params.id)
  if (!automation) return <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><p className="text-slate-600">Automation not found.</p><Link href="/dashboard/automations" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm">Back</Link></div>

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Edit Automation</h1><p className="text-sm text-slate-500 mt-1">{automation.name}</p></div>
        <div className="flex gap-3">
          <Link href={`/dashboard/automations/${automation.id}`} className="text-slate-700 hover:text-slate-900">View</Link>
          <form action={deleteAction}><input type="hidden" name="automationId" value={automation.id} /><Button type="submit" variant="destructive">Delete</Button></form>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateAutomationAction} className="grid gap-6">
          <input type="hidden" name="id" value={automation.id} />
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="name">Name <span className="text-red-500">*</span></label><Input id="name" name="name" required defaultValue={automation.name} /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="schedule_cron">Schedule (Cron)</label><Input id="schedule_cron" name="schedule_cron" defaultValue={automation.schedule_cron ?? ''} /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="description">Description</label><Textarea id="description" name="description" defaultValue={automation.description ?? ''} /></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="category">Category</label><Select id="category" name="category" defaultValue={automation.category}>{automationCategories.map((c) => (<option key={c} value={c}>{getCategoryLabel(c)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue={automation.status}>{automationStatuses.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="trigger_type">Trigger Type</label><Select id="trigger_type" name="trigger_type" defaultValue={automation.trigger_type}>{triggerTypes.map((t) => (<option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>))}</Select></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><Link href={`/dashboard/automations/${automation.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Save changes</Button></div>
        </form>
      </div>
    </div>
  )
}