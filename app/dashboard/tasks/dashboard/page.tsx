import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  fetchTasks,
  taskStatuses,
  getStatusLabel,
  isOverdue,
  getDaysRemaining,
} from '@/lib/supabase/tasks'

export default async function TaskDashboardPage() {
  const supabase = await createClient()
  const tasks = await fetchTasks(supabase)

  const totalTasks = tasks.length
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const todoCount = tasks.filter((t) => t.status === 'todo').length
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length
  const reviewCount = tasks.filter((t) => t.status === 'review').length
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length
  const overdueCount = tasks.filter((t) => isOverdue(t.due_date, t.status)).length
  const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0

  const totalEstHrs = tasks.reduce((sum, t) => sum + (t.estimated_hrs ?? 0), 0)
  const totalActualHrs = tasks.reduce((sum, t) => sum + (t.actual_hrs ?? 0), 0)

  // Status distribution
  const statusDistribution = taskStatuses.map((status) => ({
    name: getStatusLabel(status),
    status,
    count: tasks.filter((t) => t.status === status).length,
  }))

  // Per-project progress
  const projectMap: Record<string, { name: string; total: number; done: number }> = {}
  tasks.forEach((t) => {
    const key = t.project_id
    if (!projectMap[key]) projectMap[key] = { name: t.project_name ?? 'Unknown', total: 0, done: 0 }
    projectMap[key].total += 1
    if (t.status === 'done') projectMap[key].done += 1
  })
  const projectProgress = Object.entries(projectMap)
    .map(([id, data]) => ({
      projectId: id,
      projectName: data.name,
      total: data.total,
      done: data.done,
      progress: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Overdue tasks
  const overdueTasks = tasks.filter((t) => isOverdue(t.due_date, t.status))

  // Upcoming tasks (due within 3 days)
  const upcomingTasks = tasks.filter((t) => {
    if (t.status === 'done') return false
    const remaining = getDaysRemaining(t.due_date)
    return remaining !== null && remaining >= 0 && remaining <= 3
  })

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Task Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview of task progress, workload, and delivery health across all projects.
          </p>
        </div>
        <Link href="/dashboard/tasks">
          <Button variant="outline">Back to tasks</Button>
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No tasks yet. Create tasks to see analytics.</p>
          <Link href="/dashboard/tasks/new" className="mt-4 inline-block">
            <Button variant="outline">Create task</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPI title="Total Tasks" value={totalTasks} />
            <KPI title="Done" value={doneCount} color="text-emerald-600" />
            <KPI title="Completion Rate" value={`${completionRate}%`} color="text-sky-600" />
            <KPI title="Overdue" value={overdueCount} color={overdueCount > 0 ? 'text-red-600' : 'text-slate-900'} />
          </div>

          {/* KPI Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI title="To Do" value={todoCount} color="text-slate-600" />
            <KPI title="In Progress" value={inProgressCount} color="text-sky-600" />
            <KPI title="In Review" value={reviewCount} color="text-amber-600" />
            <KPI title="Blocked" value={blockedCount} color={blockedCount > 0 ? 'text-red-600' : 'text-slate-900'} />
          </div>

          {/* KPI Row 3 - Hours */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI title="Total Est. Hours" value={`${totalEstHrs}h`} color="text-slate-900" />
            <KPI title="Total Actual Hours" value={`${totalActualHrs}h`} color="text-amber-600" />
            <KPI title="Avg. Est. per Task" value={`${totalTasks > 0 ? (totalEstHrs / totalTasks).toFixed(1) : '0'}h`} color="text-slate-700" />
            <KPI title="Due Today/Tomorrow" value={upcomingTasks.filter((t) => {
              const d = getDaysRemaining(t.due_date)
              return d !== null && d <= 1
            }).length} color="text-orange-600" />
          </div>

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
                          item.status === 'done' ? 'bg-emerald-500' :
                          item.status === 'in_progress' ? 'bg-sky-500' :
                          item.status === 'review' ? 'bg-amber-500' :
                          item.status === 'blocked' ? 'bg-red-500' : 'bg-slate-400'
                        } transition-all duration-500`}
                        style={{ width: `${totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0}%` }}
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
                      <Link href={`/dashboard/projects/${proj.projectId}`} className="text-slate-700 hover:text-slate-900 hover:underline truncate max-w-[200px]">
                        {proj.projectName}
                      </Link>
                      <span className="text-xs text-slate-500">{proj.done}/{proj.total} ({proj.progress}%)</span>
                    </div>
                    <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${proj.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue Tasks */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">⚠️ Overdue Tasks ({overdueTasks.length})</h2>
              {overdueTasks.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No overdue tasks. 🎉</p>
              ) : (
                <div className="space-y-3">
                  {overdueTasks.map((t) => {
                    const daysLate = getDaysRemaining(t.due_date)
                    return (
                      <Link key={t.id} href={`/dashboard/tasks/${t.id}`} className="flex items-start justify-between rounded-lg border border-red-200 bg-red-50 p-3 hover:bg-red-100 transition-colors">
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{t.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{t.project_name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive">{daysLate !== null ? `${Math.abs(daysLate)}d late` : 'Overdue'}</Badge>
                          {t.due_date && <p className="text-xs text-red-600 mt-1">Due: {formatDate(t.due_date)}</p>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Deadlines */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">📅 Due Soon ({upcomingTasks.length})</h2>
              {upcomingTasks.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No upcoming deadlines in the next 3 days.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingTasks.sort((a, b) => (getDaysRemaining(a.due_date) ?? 999) - (getDaysRemaining(b.due_date) ?? 999)).map((t) => {
                    const remaining = getDaysRemaining(t.due_date)
                    return (
                      <Link key={t.id} href={`/dashboard/tasks/${t.id}`} className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 transition-colors">
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{t.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{t.project_name}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-medium ${remaining !== null && remaining <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                            {remaining !== null ? (remaining === 0 ? 'Due today' : remaining === 1 ? 'Tomorrow' : `${remaining}d`) : '—'}
                          </span>
                          {t.due_date && <p className="text-xs text-slate-400 mt-1">{formatDate(t.due_date)}</p>}
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

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}