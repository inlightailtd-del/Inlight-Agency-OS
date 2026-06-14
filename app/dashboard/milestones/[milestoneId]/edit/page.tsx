import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchProjects } from '@/lib/supabase/projects'
import {
  milestoneFormSchema,
  milestoneStatuses,
  fetchMilestoneById,
  updateMilestone,
  deleteMilestone,
  getStatusLabel,
} from '@/lib/supabase/milestones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateMilestoneAction(formData: FormData) {
  'use server'

  const rawValues = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )

  const milestoneId = String(rawValues.id || '')
  if (!milestoneId) throw new Error('Missing milestone ID')

  const result = milestoneFormSchema.safeParse(rawValues)
  if (!result.success) throw new Error(result.error.message)

  const supabase = await createClient()
  await updateMilestone(supabase, milestoneId, {
    project_id: result.data.project_id,
    name: result.data.name,
    description: result.data.description,
    status: result.data.status,
    due_date: result.data.due_date,
    order_index: result.data.order_index,
  })

  revalidatePath('/dashboard/milestones')
  revalidatePath(`/dashboard/milestones/${milestoneId}`)
  redirect(`/dashboard/milestones/${milestoneId}`)
}

async function deleteMilestoneAction(formData: FormData) {
  'use server'
  const milestoneId = String(formData.get('milestoneId') || '')
  if (!milestoneId) throw new Error('Missing milestone ID')

  const supabase = await createClient()
  await deleteMilestone(supabase, milestoneId)

  revalidatePath('/dashboard/milestones')
  redirect('/dashboard/milestones')
}

export default async function EditMilestonePage({
  params,
}: {
  params: { milestoneId: string }
}) {
  const supabase = await createClient()
  const milestone = await fetchMilestoneById(supabase, params.milestoneId)
  const projects = await fetchProjects(supabase)

  if (!milestone) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Milestone not found.</p>
        <Link
          href="/dashboard/milestones"
          className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to milestones
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Edit Milestone</h1>
          <p className="text-sm text-slate-500 mt-1">
            Update milestone details, status, and deadline.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/dashboard/milestones/${milestone.id}`}
            className="text-slate-700 hover:text-slate-900"
          >
            View details
          </Link>
          <form action={deleteMilestoneAction}>
            <input type="hidden" name="milestoneId" value={milestone.id} />
            <Button type="submit" variant="destructive">
              Delete milestone
            </Button>
          </form>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateMilestoneAction} className="grid gap-6">
          <input type="hidden" name="id" value={milestone.id} />

          {/* Project + Name */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="project_id">
                Project <span className="text-red-500">*</span>
              </label>
              <Select id="project_id" name="project_id" defaultValue={milestone.project_id} required>
                <option value="">— Select project —</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Milestone name <span className="text-red-500">*</span>
              </label>
              <Input id="name" name="name" required defaultValue={milestone.name} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="description">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              defaultValue={milestone.description ?? ''}
              placeholder="Brief description of this milestone deliverable..."
            />
          </div>

          {/* Status + Due Date + Order */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <Select id="status" name="status" defaultValue={milestone.status}>
                {milestoneStatuses.map((s) => (
                  <option key={s} value={s}>
                    {getStatusLabel(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="due_date">
                Due date
              </label>
              <Input id="due_date" name="due_date" type="date" defaultValue={milestone.due_date ?? ''} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="order_index">
                Order
              </label>
              <Input
                id="order_index"
                name="order_index"
                type="number"
                min={0}
                defaultValue={String(milestone.order_index ?? 0)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/dashboard/milestones/${milestone.id}`}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </div>
    </div>
  )
}