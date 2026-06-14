import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  fetchMilestones,
  milestoneStatuses,
  getStatusLabel,
  getStatusVariant,
  isOverdue,
  getDaysRemaining,
  type MilestoneWithProject,
} from '@/lib/supabase/milestones'

export default async function MilestoneDashboardPage() {
  const supabase = await createClient()
  const milestones = await fetchMilestones(supabase)

  // --- KPIs ---
  const totalMilestones = milestones.length
  const completedCount = milestones.filter((m) => m.status === 'completed').length
  const inProgressCount = milestones.filter((m) => m.status === 'in_progress').length
  const pendingCount = milestones.filter((m) => m.status === 'pending').length
  const delayedCount = milestones.filter((m) => m.status === 'delayed').length
  const overdueCount = milestones.filter((m) => isOverdue(m.due_date, m.status)).length
  const completionRate = totalMilestones > 0 ? Math.round((completedCount / totalMilestones) * 100) : 0

  // Status distribution
  const statusDistribution = milestoneStatuses.map((status) => ({
    name: getStatusLabel(status),
    status,
    count: milestones.filter((m) => m.status === status).length,
  }))

  // Per-project progress
  const projectMap: Record<
    string,
    { name: string; total: number; completed: number; milestones: MilestoneWithProject[] }
  > = {}
  milestones.forEach((m) => {
    const key = m.project_id
    if (!projectMap[key]) {
      projectMap[key] = {
        name: m.project_name ?? 'Unknown',
        total: 0,
        completed: 0,
        milestones: [],
      }
    }
    projectMap[key].total += 1
    if (m.status === 'completed') projectMap[key].completed += 1
    projectMap[key].milestones.push(m)
  })
  const projectProgress = Object.entries(projectMap)
    .map(([id, data]) => ({
      projectId: id,
      projectName: data.name,
      total: data.total,
      completed: data.completed,
      progress: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      milestones: data.milestones,
    }))
    .sort((a, b) => b.total - a.total)

  // Overdue milestones
  const overdueMilestones = milestones.filter((m) => isOverdue(m.due_date, m.status))

  // Upcoming (due within 7 days, not completed)
  const upcomingMilestones = milestones.filter((m) => {
    if (m.status === 'completed') return false
    const remaining = getDaysRemaining(m.due_date)
    return remaining !== null && remaining >= 0 && remaining <= 7
  })

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Milestone Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            High-level overview of milestone progress, deadlines, and delivery health.
          </p>
        </div>
        <Link href="/dashboard/milestones">
          <Button variant="outline">Back to milestones</Button>
        </Link>
      </div>

      {milestones.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No milestones yet. Create milestones to see analytics.</p>
          <Link href="/dashboard/milestones/new" className="mt-4 inline-block">
            <Button variant="outline">Create milestone</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPI title="Total Milestones" value={totalMilestones} />
            <KPI title="Completed" value={completedCount} color="text-emerald-600" />
            <KPI title="Completion Rate" value={`${completionRate}%`} color="text-sky-600" />
            <KPI title="Overdue" value={overdueCount} color={overdueCount > 0 ? 'text-red-600' : 'text-slate-900'} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI title="Pending" value={pendingCount} color="text-slate-600" />
            <KPI title="In Progress" value={inProgressCount} color="text-amber-600" />
            <KPI title="Delayed" value={delayedCount} color="text-red-600" />
            <KPI title="Due This Week" value={upcomingMilestones.length} color="text-orange-600" />
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* Status Distribution */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Status Distribution</h2>
              <div className="space-y-4">
                {statusDistribution.map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.name}</span>
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </div>
                    <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          item.status === 'completed'
                            ? 'bg-emerald-500'
                            : item.status === 'in_progress'
                            ? 'bg-amber-500'
                            : item.status === 'delayed'
                            ? 'bg-red-500'
                            : 'bg-slate-400'
                        } transition-all duration-500`}
                        style={{
                          width: `${totalMilestones > 0 ? Math.round((item.count / totalMilestones) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-Project Progress */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Progress by Project</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {projectProgress.map((proj) => (
                  <div key={proj.projectId}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <Link
                        href={`/dashboard/projects/${proj.projectId}`}
                        className="text-slate-700 hover:text-slate-900 hover:underline truncate max-w-[200px]"
                      >
                        {proj.projectName}
                      </Link>
                      <span className="text-xs text-slate-500">
                        {proj.completed}/{proj.total} ({proj.progress}%)
                      </span>
                    </div>
                    <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue Milestones */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                ⚠️ Overdue Milestones ({overdueMilestones.length})
              </h2>
              {overdueMilestones.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No overdue milestones. 🎉</p>
              ) : (
                <div className="space-y-3">
                  {overdueMilestones.map((m) => {
                    const daysLate = getDaysRemaining(m.due_date)
                    return (
                      <Link
                        key={m.id}
                        href={`/dashboard/milestones/${m.id}`}
                        className="flex items-start justify-between rounded-lg border border-red-200 bg-red-50 p-3 hover:bg-red-100 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{m.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{m.project_name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive">
                            {daysLate !== null ? `${Math.abs(daysLate)}d late` : 'Overdue'}
                          </Badge>
                          {m.due_date && (
                            <p className="text-xs text-red-600 mt-1">Due: {formatDate(m.due_date)}</p>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Milestones */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                📅 Due This Week ({upcomingMilestones.length})
              </h2>
              {upcomingMilestones.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No upcoming deadlines this week.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingMilestones
                    .sort((a, b) => {
                      const aDays = getDaysRemaining(a.due_date) ?? 999
                      const bDays = getDaysRemaining(b.due_date) ?? 999
                      return aDays - bDays
                    })
                    .map((m) => {
                      const remaining = getDaysRemaining(m.due_date)
                      return (
                        <Link
                          key={m.id}
                          href={`/dashboard/milestones/${m.id}`}
                          className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{m.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{m.project_name}</p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-xs font-medium ${
                                remaining !== null && remaining <= 1
                                  ? 'text-red-600'
                                  : remaining !== null && remaining <= 3
                                  ? 'text-amber-600'
                                  : 'text-slate-600'
                              }`}
                            >
                              {remaining !== null
                                ? remaining === 0
                                  ? 'Due today'
                                  : `${remaining}d left`
                                : '—'}
                            </span>
                            {m.due_date && (
                              <p className="text-xs text-slate-400 mt-1">{formatDate(m.due_date)}</p>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KPI({
  title,
  value,
  color = 'text-slate-900',
}: {
  title: string
  value: string | number
  color?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}