import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import {
  fetchMilestones,
  getStatusLabel,
  getStatusVariant,
  isOverdue,
  getDaysRemaining,
  type MilestoneWithProject,
} from '@/lib/supabase/milestones'

export default async function MilestoneTimelinePage() {
  const supabase = await createClient()
  const milestones = await fetchMilestones(supabase)

  // Filter to milestones with due dates and sort by due_date
  const timelineMilestones = milestones
    .filter((m) => m.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())

  // Calculate timeline range
  const allDates = timelineMilestones.map((m) => m.due_date as string)
  let minDate: Date, maxDate: Date
  if (allDates.length > 0) {
    const sorted = allDates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime())
    minDate = new Date(sorted[0].getFullYear(), sorted[0].getMonth(), 1)
    maxDate = new Date(sorted[sorted.length - 1].getFullYear(), sorted[sorted.length - 1].getMonth() + 2, 0)
  } else {
    minDate = new Date()
    maxDate = new Date(new Date().setMonth(new Date().getMonth() + 6))
  }

  // Generate month headers
  const months: { label: string; key: string }[] = []
  const cursor = new Date(minDate)
  while (cursor <= maxDate) {
    const monthLabel = cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    months.push({ label: monthLabel, key: `m-${cursor.getFullYear()}-${cursor.getMonth()}` })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))

  // Group milestones by project
  const projectGroups: Record<string, { name: string; id: string; milestones: MilestoneWithProject[] }> = {}
  timelineMilestones.forEach((m) => {
    const key = m.project_id
    if (!projectGroups[key]) {
      projectGroups[key] = { name: m.project_name ?? 'Unknown', id: m.project_id, milestones: [] }
    }
    projectGroups[key].milestones.push(m)
  })

  const groups = Object.values(projectGroups)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Milestone Timeline</h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualize milestone deadlines across all projects in a Gantt-style view.
          </p>
        </div>
        <Link href="/dashboard/milestones">
          <Button variant="outline">Back to milestones</Button>
        </Link>
      </div>

      {timelineMilestones.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No milestones with due dates set. Add due dates to visualize the timeline.</p>
          <Link href="/dashboard/milestones/new" className="mt-4 inline-block">
            <Button variant="outline">Create milestone</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${months.length * 80}px` }}>
              {/* Month Headers */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                <div className="w-56 shrink-0 px-4 py-3 text-sm font-medium text-slate-600 border-r border-slate-200">
                  Project / Milestone
                </div>
                {months.map((m) => (
                  <div
                    key={m.key}
                    className="flex-1 px-2 py-3 text-center text-xs font-medium text-slate-500 border-r border-slate-100"
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Project Groups */}
              <div className="divide-y divide-slate-200">
                {groups.map((group) => (
                  <div key={group.id}>
                    {/* Project Header Row */}
                    <div className="flex bg-slate-50/50">
                      <div className="w-56 shrink-0 px-4 py-2 border-r border-slate-200">
                        <Link
                          href={`/dashboard/projects/${group.id}`}
                          className="text-sm font-semibold text-slate-800 hover:text-slate-600 hover:underline"
                        >
                          {group.name}
                        </Link>
                      </div>
                      <div className="flex-1 relative py-2">
                        {/* Today marker */}
                        {(() => {
                          const todayOffset = (new Date().getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
                          const todayPercent = (todayOffset / totalDays) * 100
                          if (todayPercent >= 0 && todayPercent <= 100) {
                            return (
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                                style={{ left: `${todayPercent}%` }}
                              >
                                <span className="absolute top-0 left-1 text-[10px] text-red-500 whitespace-nowrap">Today</span>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                    </div>

                    {/* Milestone Rows */}
                    {group.milestones.map((milestone) => {
                      const dueDate = new Date(milestone.due_date!)
                      const dayOffset = Math.max(0, (dueDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
                      const positionPercent = (dayOffset / totalDays) * 100
                      const overdue = isOverdue(milestone.due_date, milestone.status)
                      const daysRemaining = getDaysRemaining(milestone.due_date)

                      return (
                        <div key={milestone.id} className="flex hover:bg-slate-50 transition-colors">
                          {/* Milestone Name */}
                          <div className="w-56 shrink-0 px-4 py-3 border-r border-slate-200">
                            <Link
                              href={`/dashboard/milestones/${milestone.id}`}
                              className="text-sm font-medium text-slate-900 hover:text-slate-700 hover:underline line-clamp-1"
                            >
                              {milestone.name}
                            </Link>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant={getStatusVariant(milestone.status)}>
                                <span className="text-[10px]">{getStatusLabel(milestone.status)}</span>
                              </Badge>
                              {overdue && (
                                <Badge variant="destructive">
                                  <span className="text-[10px]">Overdue</span>
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Timeline Area */}
                          <div className="flex-1 relative py-3 px-1">
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex">
                              {months.map((m) => (
                                <div key={m.key} className="flex-1 border-r border-slate-50" />
                              ))}
                            </div>

                            {/* Due date marker */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 flex items-center`}
                              style={{ left: `${positionPercent}%` }}
                            >
                              <div
                                className={`w-3 h-3 rounded-full border-2 ${
                                  overdue
                                    ? 'bg-red-500 border-red-300'
                                    : milestone.status === 'completed'
                                    ? 'bg-emerald-500 border-emerald-300'
                                    : milestone.status === 'in_progress'
                                    ? 'bg-amber-500 border-amber-300'
                                    : milestone.status === 'delayed'
                                    ? 'bg-red-500 border-red-300'
                                    : 'bg-slate-400 border-slate-300'
                                }`}
                              />
                              <span className="ml-1.5 text-xs text-slate-600 whitespace-nowrap">
                                {formatDate(milestone.due_date!)}
                                {daysRemaining !== null && (
                                  <span
                                    className={`ml-1 ${
                                      daysRemaining < 0
                                        ? 'text-red-500'
                                        : daysRemaining <= 3
                                        ? 'text-amber-500'
                                        : 'text-emerald-500'
                                    }`}
                                  >
                                    ({daysRemaining >= 0 ? `${daysRemaining}d` : `${Math.abs(daysRemaining)}d late`})
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}