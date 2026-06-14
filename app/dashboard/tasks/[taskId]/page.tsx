import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  fetchTaskById,
  updateTask,
  deleteTask,
  getStatusLabel,
  getStatusVariant,
  getPriorityLabel,
  getPriorityVariant,
  isOverdue,
  getDaysRemaining,
} from '@/lib/supabase/tasks'

export default async function TaskDetailPage({
  params,
}: {
  params: { taskId: string }
}) {
  const supabase = await createClient()
  const task = await fetchTaskById(supabase, params.taskId)

  if (!task) notFound()

  const overdue = isOverdue(task.due_date, task.status)
  const daysRemaining = getDaysRemaining(task.due_date)
  const isDone = task.status === 'done'

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={getStatusVariant(task.status)}>{getStatusLabel(task.status)}</Badge>
            <Badge variant={getPriorityVariant(task.priority ?? 'medium')}>
              {getPriorityLabel(task.priority ?? 'medium')}
            </Badge>
            {overdue && <Badge variant="destructive">Overdue</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/tasks" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to tasks
          </Link>
          <Link href={`/dashboard/tasks/${task.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Edit task
          </Link>
          <form action={deleteTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <Button type="submit" variant="destructive">Delete</Button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {/* Linked Project */}
            <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Project</p>
              <Link href={`/dashboard/projects/${task.project_id}`} className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-slate-900 hover:text-slate-700">
                {task.project_name ?? 'Unknown'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
              {task.client_name && (
                <Link href={`/dashboard/clients/${task.client_id}`} className="mt-1 block text-sm text-slate-600 hover:text-slate-900 hover:underline">
                  Client: {task.client_name}
                </Link>
              )}
              {task.milestone_name && (
                <p className="text-sm text-slate-500 mt-1">Milestone: {task.milestone_name}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Status" value={getStatusLabel(task.status)} />
              <DetailRow label="Priority" value={getPriorityLabel(task.priority ?? 'medium')} />
              <DetailRow label="Due date" value={task.due_date ? formatDate(task.due_date) : '—'} />
              <DetailRow label="Completed" value={task.completed_at ? formatDate(task.completed_at) : 'Not yet'} />
              <DetailRow label="Est. hours" value={task.estimated_hrs != null ? `${task.estimated_hrs}h` : '—'} />
              <DetailRow label="Actual hours" value={task.actual_hrs != null ? `${task.actual_hrs}h` : '—'} />
            </div>

            {task.description && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3>
                <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Due Date</h3>
            {task.due_date ? (
              <>
                <p className="text-3xl font-bold text-slate-900">{formatDate(task.due_date)}</p>
                {daysRemaining !== null && (
                  <p className={`text-lg font-semibold mt-3 ${
                    daysRemaining < 0 ? 'text-red-600' : daysRemaining <= 2 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {daysRemaining >= 0 ? `${daysRemaining} days remaining` : `${Math.abs(daysRemaining)} days overdue`}
                  </p>
                )}
                {overdue && (
                  <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">⚠️ This task is past its due date.</div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">No due date set.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {!isDone && (
                <form action={markDoneAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <Button type="submit" variant="outline" className="w-full">Mark as Done</Button>
                </form>
              )}
              {task.status === 'todo' && (
                <form action={startProgressAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <Button type="submit" variant="outline" className="w-full">Start Progress</Button>
                </form>
              )}
              {task.status === 'in_progress' && (
                <form action={sendToReviewAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <Button type="submit" variant="outline" className="w-full">Send to Review</Button>
                </form>
              )}
              {task.status !== 'blocked' && !isDone && (
                <form action={markBlockedAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <Button type="submit" variant="outline" className="w-full">Mark as Blocked</Button>
                </form>
              )}
              {task.status === 'blocked' && (
                <form action={unblockAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <Button type="submit" variant="outline" className="w-full">Unblock → To Do</Button>
                </form>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
            <p>Created: {formatDateTime(task.created_at)}</p>
            {task.updated_at && <p className="mt-1">Updated: {formatDateTime(task.updated_at)}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

// Server Actions
async function deleteTaskAction(formData: FormData) {
  'use server'
  const taskId = String(formData.get('taskId') || '')
  if (!taskId) throw new Error('Missing task id')
  const supabase = await createClient()
  await deleteTask(supabase, taskId)
  revalidatePath('/dashboard/tasks')
  redirect('/dashboard/tasks')
}

async function markDoneAction(formData: FormData) {
  'use server'
  const taskId = String(formData.get('taskId') || '')
  if (!taskId) throw new Error('Missing task id')
  const supabase = await createClient()
  await updateTask(supabase, taskId, { status: 'done', completed_at: new Date().toISOString() })
  revalidatePath(`/dashboard/tasks/${taskId}`)
  redirect(`/dashboard/tasks/${taskId}`)
}

async function startProgressAction(formData: FormData) {
  'use server'
  const taskId = String(formData.get('taskId') || '')
  if (!taskId) throw new Error('Missing task id')
  const supabase = await createClient()
  await updateTask(supabase, taskId, { status: 'in_progress' })
  revalidatePath(`/dashboard/tasks/${taskId}`)
  redirect(`/dashboard/tasks/${taskId}`)
}

async function sendToReviewAction(formData: FormData) {
  'use server'
  const taskId = String(formData.get('taskId') || '')
  if (!taskId) throw new Error('Missing task id')
  const supabase = await createClient()
  await updateTask(supabase, taskId, { status: 'review' })
  revalidatePath(`/dashboard/tasks/${taskId}`)
  redirect(`/dashboard/tasks/${taskId}`)
}

async function markBlockedAction(formData: FormData) {
  'use server'
  const taskId = String(formData.get('taskId') || '')
  if (!taskId) throw new Error('Missing task id')
  const supabase = await createClient()
  await updateTask(supabase, taskId, { status: 'blocked' })
  revalidatePath(`/dashboard/tasks/${taskId}`)
  redirect(`/dashboard/tasks/${taskId}`)
}

async function unblockAction(formData: FormData) {
  'use server'
  const taskId = String(formData.get('taskId') || '')
  if (!taskId) throw new Error('Missing task id')
  const supabase = await createClient()
  await updateTask(supabase, taskId, { status: 'todo' })
  revalidatePath(`/dashboard/tasks/${taskId}`)
  redirect(`/dashboard/tasks/${taskId}`)
}