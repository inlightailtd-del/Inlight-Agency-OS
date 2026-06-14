import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchProjects } from '@/lib/supabase/projects'
import {
  taskFormSchema,
  taskStatuses,
  taskPriorities,
  fetchTaskById,
  updateTask,
  deleteTask,
  getStatusLabel,
  getPriorityLabel,
} from '@/lib/supabase/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateTaskAction(formData: FormData) {
  'use server'

  const rawValues = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )

  const taskId = String(rawValues.id || '')
  if (!taskId) throw new Error('Missing task ID')

  const result = taskFormSchema.safeParse(rawValues)
  if (!result.success) throw new Error(result.error.message)

  const supabase = await createClient()
  await updateTask(supabase, taskId, {
    project_id: result.data.project_id,
    title: result.data.title,
    milestone_id: result.data.milestone_id,
    description: result.data.description,
    status: result.data.status,
    priority: result.data.priority,
    due_date: result.data.due_date,
    estimated_hrs: result.data.estimated_hrs,
    actual_hrs: result.data.actual_hrs,
  })

  revalidatePath('/dashboard/tasks')
  revalidatePath(`/dashboard/tasks/${taskId}`)
  redirect(`/dashboard/tasks/${taskId}`)
}

async function deleteTaskAction(formData: FormData) {
  'use server'
  const taskId = String(formData.get('taskId') || '')
  if (!taskId) throw new Error('Missing task ID')
  const supabase = await createClient()
  await deleteTask(supabase, taskId)
  revalidatePath('/dashboard/tasks')
  redirect('/dashboard/tasks')
}

export default async function EditTaskPage({
  params,
}: {
  params: { taskId: string }
}) {
  const supabase = await createClient()
  const task = await fetchTaskById(supabase, params.taskId)
  const projects = await fetchProjects(supabase)

  if (!task) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Task not found.</p>
        <Link href="/dashboard/tasks" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Back to tasks
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Edit Task</h1>
          <p className="text-sm text-slate-500 mt-1">Update task details, status, and assignment.</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/dashboard/tasks/${task.id}`} className="text-slate-700 hover:text-slate-900">View details</Link>
          <form action={deleteTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <Button type="submit" variant="destructive">Delete task</Button>
          </form>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateTaskAction} className="grid gap-6">
          <input type="hidden" name="id" value={task.id} />

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="project_id">Project <span className="text-red-500">*</span></label>
              <Select id="project_id" name="project_id" defaultValue={task.project_id} required>
                <option value="">— Select project —</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="title">Task title <span className="text-red-500">*</span></label>
              <Input id="title" name="title" required defaultValue={task.title} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="description">Description</label>
            <Textarea id="description" name="description" defaultValue={task.description ?? ''} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label>
              <Select id="status" name="status" defaultValue={task.status}>
                {taskStatuses.map((s) => (<option key={s} value={s}>{getStatusLabel(s)}</option>))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="priority">Priority</label>
              <Select id="priority" name="priority" defaultValue={task.priority ?? 'medium'}>
                {taskPriorities.map((p) => (<option key={p} value={p}>{getPriorityLabel(p)}</option>))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="due_date">Due date</label>
              <Input id="due_date" name="due_date" type="date" defaultValue={task.due_date ?? ''} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="milestone_id">Milestone</label>
              <Select id="milestone_id" name="milestone_id" defaultValue={task.milestone_id ?? ''}>
                <option value="">— None —</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="estimated_hrs">Est. hours</label>
              <Input id="estimated_hrs" name="estimated_hrs" type="number" min="0" step="0.5" defaultValue={task.estimated_hrs ?? ''} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="actual_hrs">Actual hours</label>
              <Input id="actual_hrs" name="actual_hrs" type="number" min="0" step="0.5" defaultValue={task.actual_hrs ?? ''} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/dashboard/tasks/${task.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </Link>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </div>
    </div>
  )
}