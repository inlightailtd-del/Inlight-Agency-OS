import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchProjects } from '@/lib/supabase/projects'
import {
  milestoneFormSchema,
  milestoneStatuses,
  createMilestone,
  getStatusLabel,
} from '@/lib/supabase/milestones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function createMilestoneAction(formData: FormData) {
  'use server'

  const rawValues = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )

  const result = milestoneFormSchema.safeParse(rawValues)
  if (!result.success) {
    throw new Error(result.error.message)
  }

  const supabase = await createClient()

  await createMilestone(supabase, {
    project_id: result.data.project_id,
    name: result.data.name,
    description: result.data.description,
    status: result.data.status,
    due_date: result.data.due_date,
    order_index: result.data.order_index,
  })

  revalidatePath('/dashboard/milestones')
  redirect('/dashboard/milestones')
}

export default async function NewMilestonePage() {
  const supabase = await createClient()
  const projects = await fetchProjects(supabase)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Add Milestone</h1>
          <p className="text-sm text-slate-500 mt-1">
            Link a milestone to a project, set a deadline, and track completion progress.
          </p>
        </div>
        <Link href="/dashboard/milestones" className="text-slate-700 hover:text-slate-900">
          Back to milestones
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createMilestoneAction} className="grid gap-6">
          {/* Project + Name */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="project_id">
                Project <span className="text-red-500">*</span>
              </label>
              <Select id="project_id" name="project_id" required>
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
              <Input id="name" name="name" required placeholder="Design Phase Complete" />
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
              placeholder="Brief description of this milestone deliverable..."
            />
          </div>

          {/* Status + Due Date + Order */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <Select id="status" name="status" defaultValue="pending">
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
              <Input id="due_date" name="due_date" type="date" />
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
                defaultValue="0"
                placeholder="0"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/dashboard/milestones"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <Button type="submit">Create milestone</Button>
          </div>
        </form>
      </div>
    </div>
  )
}