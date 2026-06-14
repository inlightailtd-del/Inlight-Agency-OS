import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  projectFormSchema,
  projectStatuses,
  projectPriorities,
  serviceTypes,
  getStatusLabel,
  getPriorityLabel,
  getServiceTypeLabel,
} from '@/lib/supabase/projects'
import { fetchClients } from '@/lib/supabase/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function createProjectAction(formData: FormData) {
  'use server'

  const rawValues = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )

  const result = projectFormSchema.safeParse(rawValues)
  if (!result.success) {
    throw new Error(result.error.message)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    throw new Error('Unable to determine authenticated user')
  }

  const payload: Record<string, any> = {
    name: result.data.name,
    client_id: result.data.client_id,
    description: result.data.description,
    status: result.data.status,
    priority: result.data.priority,
    service_type: result.data.service_type,
    start_date: result.data.start_date,
    end_date: result.data.end_date,
    budget: result.data.budget,
    actual_cost: result.data.actual_cost,
    currency: result.data.currency,
    notes: result.data.notes,
    health: String(result.data.health_score),
    user_id: user.id,
  }

  const { error } = await supabase.from('projects').insert([payload])

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/projects')
  redirect('/dashboard/projects')
}

export default async function NewProjectPage() {
  const supabase = await createClient()
  const clients = await fetchClients(supabase)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create Project</h1>
          <p className="text-sm text-slate-500 mt-1">
            Link a project to a client, set deadlines, budget, and track delivery milestones.
          </p>
        </div>
        <Link href="/dashboard/projects" className="text-slate-700 hover:text-slate-900">
          Back to projects
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createProjectAction} className="grid gap-6">
          {/* Project Name + Description */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Project name <span className="text-red-500">*</span>
              </label>
              <Input id="name" name="name" required placeholder="Website Redesign Q2" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="client_id">
                Client
              </label>
              <Select id="client_id" name="client_id">
                <option value="">— Select client —</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
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
              placeholder="Brief overview of the project scope and objectives..."
            />
          </div>

          {/* Status + Priority + Service Type */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <Select id="status" name="status" defaultValue="planning">
                {projectStatuses.map((s) => (
                  <option key={s} value={s}>
                    {getStatusLabel(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="priority">
                Priority
              </label>
              <Select id="priority" name="priority" defaultValue="medium">
                {projectPriorities.map((p) => (
                  <option key={p} value={p}>
                    {getPriorityLabel(p)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="service_type">
                Service type
              </label>
              <Select id="service_type" name="service_type">
                <option value="">— Select type —</option>
                {serviceTypes.map((s) => (
                  <option key={s} value={s}>
                    {getServiceTypeLabel(s)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Start + End Dates */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="start_date">
                Start date
              </label>
              <Input id="start_date" name="start_date" type="date" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="end_date">
                End date
              </label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>

          {/* Budget + Actual Cost + Currency */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="budget">
                Budget (PKR)
              </label>
              <Input id="budget" name="budget" type="number" placeholder="500000" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="actual_cost">
                Actual cost (PKR)
              </label>
              <Input
                id="actual_cost"
                name="actual_cost"
                type="number"
                placeholder="0"
                defaultValue="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="health_score">
                Health score (0-100)
              </label>
              <Input
                id="health_score"
                name="health_score"
                type="number"
                min={0}
                max={100}
                defaultValue="50"
                placeholder="50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="notes">
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Important details, scope notes, or special instructions..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/dashboard/projects"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </div>
    </div>
  )
}