import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  projectFormSchema,
  projectStatuses,
  projectPriorities,
  serviceTypes,
  fetchProjectById,
  getStatusLabel,
  getPriorityLabel,
  getServiceTypeLabel,
  parseHealthScore,
} from '@/lib/supabase/projects'
import { fetchClients } from '@/lib/supabase/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateProjectAction(formData: FormData) {
  'use server'

  const rawValues = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )

  const projectId = String(rawValues.id || '')
  if (!projectId) {
    throw new Error('Missing project ID')
  }

  const result = projectFormSchema.safeParse(rawValues)
  if (!result.success) {
    throw new Error(result.error.message)
  }

  const supabase = await createClient()

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
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('projects').update(payload).eq('id', projectId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/projects')
  revalidatePath(`/dashboard/projects/${projectId}`)
  redirect(`/dashboard/projects/${projectId}`)
}

async function deleteProjectAction(formData: FormData) {
  'use server'

  const projectId = String(formData.get('projectId') || '')
  if (!projectId) throw new Error('Missing project ID')

  const supabase = await createClient()
  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/projects')
  redirect('/dashboard/projects')
}

export default async function EditProjectPage({
  params,
}: {
  params: { projectId: string }
}) {
  const supabase = await createClient()
  const project = await fetchProjectById(supabase, params.projectId)
  const clients = await fetchClients(supabase)

  if (!project) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Project not found.</p>
        <Link
          href="/dashboard/projects"
          className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to projects
        </Link>
      </div>
    )
  }

  const healthScore = parseHealthScore(project.health)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Edit Project</h1>
          <p className="text-sm text-slate-500 mt-1">
            Update project details, status, budget, and tracking information.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/dashboard/projects/${project.id}`} className="text-slate-700 hover:text-slate-900">
            View details
          </Link>
          <form action={deleteProjectAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <Button type="submit" variant="destructive">
              Delete project
            </Button>
          </form>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateProjectAction} className="grid gap-6">
          <input type="hidden" name="id" value={project.id} />

          {/* Project Name + Client */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Project name <span className="text-red-500">*</span>
              </label>
              <Input id="name" name="name" required defaultValue={project.name} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="client_id">
                Client
              </label>
              <Select id="client_id" name="client_id" defaultValue={project.client_id ?? ''}>
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
              defaultValue={project.description ?? ''}
              placeholder="Brief overview of the project scope and objectives..."
            />
          </div>

          {/* Status + Priority + Service Type */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <Select id="status" name="status" defaultValue={project.status}>
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
              <Select id="priority" name="priority" defaultValue={project.priority ?? 'medium'}>
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
              <Select id="service_type" name="service_type" defaultValue={project.service_type ?? ''}>
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
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={project.start_date ?? ''}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="end_date">
                End date
              </label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={project.end_date ?? ''}
              />
            </div>
          </div>

          {/* Budget + Actual Cost + Health */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="budget">
                Budget (PKR)
              </label>
              <Input
                id="budget"
                name="budget"
                type="number"
                defaultValue={project.budget ?? ''}
                placeholder="500000"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="actual_cost">
                Actual cost (PKR)
              </label>
              <Input
                id="actual_cost"
                name="actual_cost"
                type="number"
                defaultValue={project.actual_cost ?? 0}
                placeholder="0"
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
                defaultValue={String(healthScore)}
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
              defaultValue={project.notes ?? ''}
              placeholder="Important details, scope notes, or special instructions..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/dashboard/projects/${project.id}`}
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