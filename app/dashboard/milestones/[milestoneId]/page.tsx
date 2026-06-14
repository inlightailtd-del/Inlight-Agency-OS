import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  fetchMilestoneById,
  updateMilestone,
  deleteMilestone,
  getStatusLabel,
  getStatusVariant,
  isOverdue,
  getDaysRemaining,
} from '@/lib/supabase/milestones'
import { getStatusLabel as getProjectStatusLabel } from '@/lib/supabase/projects'

export default async function MilestoneDetailPage({
  params,
}: {
  params: { milestoneId: string }
}) {
  const supabase = await createClient()
  const milestone = await fetchMilestoneById(supabase, params.milestoneId)

  if (!milestone) {
    notFound()
  }

  const overdue = isOverdue(milestone.due_date, milestone.status)
  const daysRemaining = getDaysRemaining(milestone.due_date)
  const isCompleted = milestone.status === 'completed'

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{milestone.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={getStatusVariant(milestone.status)}>
              {getStatusLabel(milestone.status)}
            </Badge>
            {overdue && <Badge variant="destructive">Overdue</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/milestones"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to milestones
          </Link>
          <Link
            href={`/dashboard/milestones/${milestone.id}/edit`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Edit milestone
          </Link>
          <form action={deleteMilestoneAction}>
            <input type="hidden" name="milestoneId" value={milestone.id} />
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Details Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {/* Linked Project */}
            <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Project</p>
              <Link
                href={`/dashboard/projects/${milestone.project_id}`}
                className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-slate-900 hover:text-slate-700"
              >
                {milestone.project_name ?? 'Unknown project'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
              {milestone.project_status && (
                <p className="text-sm text-slate-500 mt-1">
                  Project status: {getProjectStatusLabel(milestone.project_status as any)}
                </p>
              )}
              {milestone.client_name && (
                <Link
                  href={`/dashboard/clients/${milestone.client_id}`}
                  className="mt-1 block text-sm text-slate-600 hover:text-slate-900 hover:underline"
                >
                  Client: {milestone.client_name}
                </Link>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Status" value={getStatusLabel(milestone.status)} />
              <DetailRow label="Order" value={`#${milestone.order_index ?? 0}`} />
              <DetailRow label="Due date" value={milestone.due_date ? formatDate(milestone.due_date) : '—'} />
              <DetailRow
                label="Completed"
                value={milestone.completed_at ? formatDate(milestone.completed_at) : 'Not yet'}
              />
            </div>

            {milestone.description && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3>
                <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">
                  {milestone.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Due Date Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Due Date</h3>
            {milestone.due_date ? (
              <>
                <p className="text-3xl font-bold text-slate-900">
                  {formatDate(milestone.due_date)}
                </p>
                {daysRemaining !== null && (
                  <div className="mt-3">
                    <p
                      className={`text-lg font-semibold ${
                        daysRemaining < 0
                          ? 'text-red-600'
                          : daysRemaining <= 3
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {daysRemaining >= 0
                        ? `${daysRemaining} days remaining`
                        : `${Math.abs(daysRemaining)} days overdue`}
                    </p>
                  </div>
                )}
                {overdue && (
                  <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    ⚠️ This milestone is past its due date.
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">No due date set.</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {!isCompleted && (
                <form action={markCompleteAction}>
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    Mark as Complete
                  </Button>
                </form>
              )}
              {milestone.status === 'pending' && (
                <form action={startProgressAction}>
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    Start Progress
                  </Button>
                </form>
              )}
              {milestone.status !== 'delayed' && !isCompleted && (
                <form action={markDelayedAction}>
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    Mark as Delayed
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
            <p>Created: {formatDateTime(milestone.created_at)}</p>
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

// ---- Server Actions ----

async function deleteMilestoneAction(formData: FormData) {
  'use server'
  const milestoneId = String(formData.get('milestoneId') || '')
  if (!milestoneId) throw new Error('Missing milestone id')

  const supabase = await createClient()
  await deleteMilestone(supabase, milestoneId)

  revalidatePath('/dashboard/milestones')
  redirect('/dashboard/milestones')
}

async function markCompleteAction(formData: FormData) {
  'use server'
  const milestoneId = String(formData.get('milestoneId') || '')
  if (!milestoneId) throw new Error('Missing milestone id')

  const supabase = await createClient()
  await updateMilestone(supabase, milestoneId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  })

  revalidatePath(`/dashboard/milestones/${milestoneId}`)
  redirect(`/dashboard/milestones/${milestoneId}`)
}

async function startProgressAction(formData: FormData) {
  'use server'
  const milestoneId = String(formData.get('milestoneId') || '')
  if (!milestoneId) throw new Error('Missing milestone id')

  const supabase = await createClient()
  await updateMilestone(supabase, milestoneId, {
    status: 'in_progress',
  })

  revalidatePath(`/dashboard/milestones/${milestoneId}`)
  redirect(`/dashboard/milestones/${milestoneId}`)
}

async function markDelayedAction(formData: FormData) {
  'use server'
  const milestoneId = String(formData.get('milestoneId') || '')
  if (!milestoneId) throw new Error('Missing milestone id')

  const supabase = await createClient()
  await updateMilestone(supabase, milestoneId, {
    status: 'delayed',
  })

  revalidatePath(`/dashboard/milestones/${milestoneId}`)
  redirect(`/dashboard/milestones/${milestoneId}`)
}