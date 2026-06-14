import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDate, formatDateTime } from '@/lib/utils'
import {
  fetchProjectById,
  fetchMilestonesForProject,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getStatusLabel,
  getStatusVariant,
  getHealthLabel,
  getHealthColor,
  getPriorityLabel,
  getPriorityVariant,
  getServiceTypeLabel,
  getMilestoneStatusLabel,
  parseHealthScore,
  milestoneStatuses,
  type MilestoneStatus,
} from '@/lib/supabase/projects'

export default async function ProjectDetailPage({
  params,
}: {
  params: { projectId: string }
}) {
  const supabase = await createClient()
  const project = await fetchProjectById(supabase, params.projectId)
  const milestones = await fetchMilestonesForProject(supabase, params.projectId)

  if (!project) {
    notFound()
  }

  const healthScore = parseHealthScore(project.health)

  // Milestone progress
  const totalMilestones = milestones.length
  const completedMilestones = milestones.filter(
    (m: any) => m.status === 'completed' || m.completed_at
  ).length
  const milestoneProgress =
    totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100)

  // Budget tracking
  const budget = project.budget ?? 0
  const actualCost = project.actual_cost ?? 0
  const budgetProgress = budget > 0 ? Math.min(100, Math.round((actualCost / budget) * 100)) : 0
  const isOverBudget = budget > 0 && actualCost > budget
  const remaining = budget - actualCost

  // Timeline calculation
  const today = new Date()
  const startDate = project.start_date ? new Date(project.start_date) : null
  const endDate = project.end_date ? new Date(project.end_date) : null
  const totalDays =
    startDate && endDate ? Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
  const elapsedDays = startDate
    ? Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0
  const timelineProgress = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0
  const isOverdue = endDate && today > endDate
  const daysRemaining = endDate
    ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={getStatusVariant(project.status)}>
              {getStatusLabel(project.status)}
            </Badge>
            <Badge variant={getPriorityVariant(project.priority ?? 'medium')}>
              {getPriorityLabel(project.priority ?? 'medium')}
            </Badge>
            {project.service_type && (
              <Badge variant="default">
                {getServiceTypeLabel(project.service_type)}
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive">Overdue</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/projects"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to projects
          </Link>
          <Link
            href={`/dashboard/projects/${project.id}/edit`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Edit project
          </Link>
          <form action={deleteProjectAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Left Column - Details */}
        <div className="space-y-6">
          {/* Client Info + Key Details */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {project.client_id && project.client_name ? (
              <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Client</p>
                <Link
                  href={`/dashboard/clients/${project.client_id}`}
                  className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-slate-900 hover:text-slate-700"
                >
                  {project.client_name}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              </div>
            ) : (
              <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-sm text-slate-500">No client linked.</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Service type" value={getServiceTypeLabel(project.service_type)} />
              <DetailRow label="Start date" value={project.start_date ? formatDate(project.start_date) : '—'} />
              <DetailRow label="End date" value={project.end_date ? formatDate(project.end_date) : '—'} />
              <DetailRow label="Budget" value={formatPKR(project.budget ?? undefined)} />
              <DetailRow label="Actual cost" value={formatPKR(project.actual_cost ?? undefined)} />
              <DetailRow label="Currency" value={project.currency ?? 'PKR'} />
            </div>

            {project.description && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3>
                <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">
                  {project.description}
                </p>
              </div>
            )}

            {project.notes && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
                <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">
                  {project.notes}
                </p>
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Milestones</h2>
                <p className="text-sm text-slate-500">
                  {completedMilestones} of {totalMilestones} completed
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{milestoneProgress}%</p>
              </div>
            </div>

            {/* Milestone progress bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 mb-6">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${milestoneProgress}%` }}
              />
            </div>

            {milestones.length === 0 ? (
              <p className="text-sm text-slate-500">No milestones yet. Add your first milestone below.</p>
            ) : (
              <ul className="space-y-3 mb-6">
                {milestones.map((m: any) => (
                  <li
                    key={m.id}
                    className={`rounded-lg border p-4 transition-colors ${
                      m.status === 'completed'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : m.status === 'delayed'
                        ? 'border-red-200 bg-red-50/50'
                        : m.status === 'in_progress'
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{m.name}</p>
                          <Badge
                            variant={
                              m.status === 'completed'
                                ? 'success'
                                : m.status === 'in_progress'
                                ? 'warning'
                                : m.status === 'delayed'
                                ? 'destructive'
                                : 'default'
                            }
                          >
                            {getMilestoneStatusLabel(m.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          Due: {m.due_date ? formatDate(m.due_date) : '—'}
                          {m.completed_at && ` • Completed ${formatDate(m.completed_at)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Quick status toggle */}
                        {m.status !== 'completed' && (
                          <form action={markMilestoneCompleteAction}>
                            <input type="hidden" name="milestoneId" value={m.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Complete
                            </Button>
                          </form>
                        )}
                        <form action={deleteMilestoneAction}>
                          <input type="hidden" name="milestoneId" value={m.id} />
                          <input type="hidden" name="projectId" value={project.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            ×
                          </Button>
                        </form>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Add Milestone Form */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <form action={createMilestoneAction} className="grid gap-3">
                <input type="hidden" name="projectId" value={project.id} />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <Input name="name" placeholder="Milestone name" required />
                  <Input name="due_date" type="date" className="sm:w-40" />
                  <Button type="submit">Add milestone</Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column - Tracking */}
        <div className="space-y-6">
          {/* Health Score Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Health score</p>
                <p className="text-3xl font-bold text-slate-900">{healthScore}%</p>
              </div>
              <Badge
                variant={
                  healthScore >= 80 ? 'success' : healthScore >= 50 ? 'warning' : 'destructive'
                }
              >
                {getHealthLabel(healthScore)}
              </Badge>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`${getHealthColor(healthScore)} h-full rounded-full transition-all duration-300`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-700">Interpretation</p>
              <p className="mt-2 text-slate-600">
                {healthScore >= 80
                  ? 'Project is on track with good delivery momentum.'
                  : healthScore >= 50
                  ? 'Project needs attention to stay on course.'
                  : 'Immediate action required. Review project blockers.'}
              </p>
            </div>
          </div>

          {/* Budget Tracking Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Budget Tracking</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Budget</span>
                <span className="font-semibold text-slate-900">{formatPKR(budget)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Spent</span>
                <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatPKR(actualCost)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Remaining</span>
                <span className={`font-semibold ${remaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatPKR(remaining)}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOverBudget ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${budgetProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 text-right">{budgetProgress}% of budget used</p>
              {isOverBudget && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  ⚠️ Over budget by {formatPKR(actualCost - budget)}
                </div>
              )}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Timeline</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Start</span>
                <span className="font-medium text-slate-900">
                  {startDate ? formatDate(startDate) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">End</span>
                <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                  {endDate ? formatDate(endDate) : '—'}
                </span>
              </div>
              {daysRemaining !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {daysRemaining >= 0 ? 'Days remaining' : 'Days overdue'}
                  </span>
                  <span
                    className={`font-medium ${
                      daysRemaining < 0
                        ? 'text-red-600'
                        : daysRemaining <= 7
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {daysRemaining >= 0 ? daysRemaining : Math.abs(daysRemaining)}
                  </span>
                </div>
              )}
              {totalDays > 0 && (
                <>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOverdue ? 'bg-red-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${timelineProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-right">{timelineProgress}% elapsed</p>
                </>
              )}
              {isOverdue && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  ⚠️ This project is past its deadline.
                </div>
              )}
            </div>
          </div>

          {/* Created / Updated Meta */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
            <p>Created: {formatDateTime(project.created_at)}</p>
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

async function deleteProjectAction(formData: FormData) {
  'use server'
  const projectId = String(formData.get('projectId') || '')
  if (!projectId) throw new Error('Missing project id')

  const supabase = await createClient()
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/projects')
  redirect('/dashboard/projects')
}

async function createMilestoneAction(formData: FormData) {
  'use server'
  const projectId = String(formData.get('projectId') || '')
  const name = String(formData.get('name') || '')
  const due_date = String(formData.get('due_date') || '')

  if (!projectId || !name) throw new Error('Missing required fields')

  const supabase = await createClient()
  await createMilestone(supabase, projectId, name, due_date || undefined)

  revalidatePath(`/dashboard/projects/${projectId}`)
  redirect(`/dashboard/projects/${projectId}`)
}

async function deleteMilestoneAction(formData: FormData) {
  'use server'
  const milestoneId = String(formData.get('milestoneId') || '')
  const projectId = String(formData.get('projectId') || '')

  if (!milestoneId) throw new Error('Missing milestone id')

  const supabase = await createClient()
  await deleteMilestone(supabase, milestoneId)

  revalidatePath(`/dashboard/projects/${projectId}`)
  redirect(`/dashboard/projects/${projectId}`)
}

async function markMilestoneCompleteAction(formData: FormData) {
  'use server'
  const milestoneId = String(formData.get('milestoneId') || '')
  const projectId = String(formData.get('projectId') || '')

  if (!milestoneId) throw new Error('Missing milestone id')

  const supabase = await createClient()
  await updateMilestone(supabase, milestoneId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  })

  revalidatePath(`/dashboard/projects/${projectId}`)
  redirect(`/dashboard/projects/${projectId}`)
}