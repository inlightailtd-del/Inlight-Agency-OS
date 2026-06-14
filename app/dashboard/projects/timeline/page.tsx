import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import {
  fetchProjects,
  getStatusLabel,
  getStatusVariant,
  type ProjectWithClient,
} from '@/lib/supabase/projects'

export default async function TimelinePage() {
  const supabase = await createClient()
  const projects = await fetchProjects(supabase)

  // Filter to projects with dates and sort by start_date
  const timelineProjects = projects
    .filter((p) => p.start_date || p.end_date)
    .sort((a, b) => {
      const aDate = a.start_date ?? a.end_date ?? ''
      const bDate = b.start_date ?? b.end_date ?? ''
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })

  // Calculate timeline range
  const allDates = timelineProjects.flatMap((p) => [p.start_date, p.end_date].filter(Boolean)) as string[]
  let minDate: Date, maxDate: Date
  if (allDates.length > 0) {
    const sorted = allDates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime())
    minDate = new Date(sorted[0].getFullYear(), sorted[0].getMonth(), 1) // Start of month
    maxDate = new Date(sorted[sorted.length - 1].getFullYear(), sorted[sorted.length - 1].getMonth() + 2, 0) // End of following month
  } else {
    minDate = new Date()
    maxDate = new Date(new Date().setMonth(new Date().getMonth() + 6))
  }

  // Generate month headers
  const months: { label: string; key: string }[] = []
  const cursor = new Date(minDate)
  while (cursor <= maxDate) {
    const monthLabel = cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    months.push({ label: monthLabel, key: `month-${cursor.getFullYear()}-${cursor.getMonth()}` })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))

  // Group projects by month for the quarter view
  const projectsByMonth: Record<string, ProjectWithClient[]> = {}
  months.forEach((m) => {
    projectsByMonth[m.key] = []
  })

  timelineProjects.forEach((p) => {
    // Group by start_date month
    if (p.start_date) {
      const startDate = new Date(p.start_date)
      const key = `month-${startDate.getFullYear()}-${startDate.getMonth()}`
      if (projectsByMonth[key]) {
        projectsByMonth[key].push(p)
      }
    }
  })

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Timeline</h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualize project schedules, deadlines, and delivery windows across months.
          </p>
        </div>
        <Link href="/dashboard/projects">
          <Button variant="outline">Back to projects</Button>
        </Link>
      </div>

      {/* Timeline Bar Chart */}
      {timelineProjects.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No projects with dates set. Add start and end dates to visualize the timeline.</p>
          <Link href="/dashboard/projects/new" className="mt-4 inline-block">
            <Button variant="outline">Create project</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Gantt-style Timeline */}
          <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${months.length * 100}px` }}>
                {/* Month Headers */}
                <div className="flex border-b border-slate-200 bg-slate-50">
                  <div className="w-56 shrink-0 px-4 py-3 text-sm font-medium text-slate-600 border-r border-slate-200">
                    Project
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

                {/* Project Rows */}
                <div className="divide-y divide-slate-100">
                  {timelineProjects.map((project) => {
                    const projectStart = project.start_date ? new Date(project.start_date) : null
                    const projectEnd = project.end_date ? new Date(project.end_date) : null

                    const startOffset = projectStart
                      ? Math.max(0, (projectStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
                      : 0
                    const durationDays = projectStart && projectEnd
                      ? Math.max(1, (projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24))
                      : 30

                    const leftPercent = (startOffset / totalDays) * 100
                    const widthPercent = Math.max(2, (durationDays / totalDays) * 100)

                    const isOverdue = projectEnd && new Date() > projectEnd && project.status !== 'completed'

                    return (
                      <div key={project.id} className="flex hover:bg-slate-50 transition-colors">
                        {/* Project Name Column */}
                        <div className="w-56 shrink-0 px-4 py-3 border-r border-slate-200">
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="text-sm font-medium text-slate-900 hover:text-slate-700 hover:underline line-clamp-2"
                          >
                            {project.name}
                          </Link>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant={getStatusVariant(project.status)}>
                              <span className="text-[10px]">{getStatusLabel(project.status)}</span>
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {projectStart ? formatDate(projectStart) : '—'} → {projectEnd ? formatDate(projectEnd) : '—'}
                          </p>
                        </div>

                        {/* Gantt Bar Area */}
                        <div className="flex-1 relative py-3 px-1">
                          {/* Grid lines */}
                          <div className="absolute inset-0 flex">
                            {months.map((m) => (
                              <div
                                key={m.key}
                                className="flex-1 border-r border-slate-50"
                              />
                            ))}
                          </div>

                          {/* Today marker */}
                          {(() => {
                            const todayOffset = (new Date().getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
                            const todayPercent = Math.min(100, Math.max(0, (todayOffset / totalDays) * 100))
                            if (todayPercent >= 0 && todayPercent <= 100) {
                              return (
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                                  style={{ left: `${todayPercent}%` }}
                                >
                                  <span className="absolute top-0 left-1 text-[10px] text-red-500 whitespace-nowrap">
                                    Today
                                  </span>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* Project Bar */}
                          {projectStart && (
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full border ${
                                isOverdue
                                  ? 'bg-red-100 border-red-300'
                                  : project.status === 'completed'
                                  ? 'bg-emerald-100 border-emerald-300'
                                  : project.status === 'active'
                                  ? 'bg-sky-100 border-sky-300'
                                  : project.status === 'paused'
                                  ? 'bg-amber-100 border-amber-300'
                                  : 'bg-slate-100 border-slate-300'
                              }`}
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                              }}
                              title={`${project.name}: ${projectStart ? formatDate(projectStart) : ''} → ${projectEnd ? formatDate(projectEnd) : ''}`}
                            >
                              <div
                                className={`h-full rounded-full ${
                                  isOverdue
                                    ? 'bg-red-500'
                                    : project.status === 'completed'
                                    ? 'bg-emerald-500'
                                    : project.status === 'active'
                                    ? 'bg-sky-500'
                                    : project.status === 'paused'
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                                style={{
                                  width: `${
                                    project.status === 'completed'
                                      ? 100
                                      : Math.min(95, Math.max(5, widthPercent > 0 ? 60 : 20))
                                  }%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Quarterly Breakdown */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Projects by Month</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {months.map((m) => {
                const monthProjects = projectsByMonth[m.key] || []
                if (monthProjects.length === 0) return null
                return (
                  <div key={m.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">{m.label}</h3>
                    <ul className="space-y-2">
                      {monthProjects.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/dashboard/projects/${p.id}`}
                            className="text-sm text-slate-700 hover:text-slate-900 hover:underline"
                          >
                            {p.name}
                          </Link>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant={getStatusVariant(p.status)}>
                              <span className="text-[10px]">{getStatusLabel(p.status)}</span>
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Overdue Projects Summary */}
          {(() => {
            const overdueProjects = timelineProjects.filter(
              (p) => p.end_date && new Date(p.end_date) < new Date() && p.status !== 'completed' && p.status !== 'cancelled'
            )
            if (overdueProjects.length === 0) return null
            return (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-red-900 mb-4">
                  ⚠️ Overdue Projects ({overdueProjects.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {overdueProjects.map((p) => {
                    const daysLate = p.end_date
                      ? Math.ceil((new Date().getTime() - new Date(p.end_date).getTime()) / (1000 * 60 * 60 * 24))
                      : 0
                    return (
                      <Link
                        key={p.id}
                        href={`/dashboard/projects/${p.id}`}
                        className="rounded-lg border border-red-200 bg-white p-3 hover:bg-red-50 transition-colors"
                      >
                        <p className="font-medium text-slate-900 text-sm">{p.name}</p>
                        <p className="text-xs text-red-600 mt-1">
                          Due {formatDate(p.end_date!)} — {daysLate} days overdue
                        </p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}