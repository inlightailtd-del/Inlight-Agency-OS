import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  fetchTasks,
  taskStatusOptions,
  getStatusLabel,
  getStatusVariant,
  getPriorityLabel,
  getPriorityVariant,
  isOverdue,
  getDaysRemaining,
  type TaskWithRelations,
  type TaskListStatus,
} from '@/lib/supabase/tasks'

const getSearchValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value?.trim() ?? ''

const getStatusValue = (value: string | string[] | undefined): TaskListStatus => {
  const raw = Array.isArray(value) ? value[0] : value
  return taskStatusOptions.includes(raw as TaskListStatus) ? (raw as TaskListStatus) : 'all'
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: { query?: string | string[]; status?: string | string[] }
}) {
  const query = getSearchValue(searchParams?.query)
  const status = getStatusValue(searchParams?.status)
  const supabase = await createClient()
  const tasks = await fetchTasks(supabase, query, status)

  const statusQuery = (statusValue: TaskListStatus) =>
    `/dashboard/tasks?status=${statusValue}${query ? `&query=${encodeURIComponent(query)}` : ''}`

  // Summary stats
  const totalTasks = tasks.length
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length
  const overdueCount = tasks.filter((t) => isOverdue(t.due_date, t.status)).length
  const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage task assignments, track progress, deadlines, and delivery across projects.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/tasks/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
          <Link href="/dashboard/tasks/timeline">
            <Button variant="outline">Timeline</Button>
          </Link>
          <Link href="/dashboard/tasks/new">
            <Button>Add Task</Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Tasks</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalTasks}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Done</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{doneCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completion</p>
          <p className="text-2xl font-bold text-sky-600 mt-1">{completionRate}%</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overdue / Blocked</p>
          <p className={`text-2xl font-bold mt-1 ${overdueCount > 0 || blockedCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {overdueCount} / {blockedCount}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr] mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="sr-only" htmlFor="query">Search tasks</label>
            <Input id="query" name="query" placeholder="Search by title or description" defaultValue={query} />
          </div>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">Search</Button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Status filters</p>
          <div className="flex flex-wrap gap-2">
            {taskStatusOptions.map((option) => {
              const active = status === option
              return (
                <Link
                  key={option}
                  href={statusQuery(option)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {getStatusLabel(option)}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Task</th>
              <th className="px-4 py-3 font-medium text-slate-600">Project</th>
              <th className="px-4 py-3 font-medium text-slate-600">Milestone</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Priority</th>
              <th className="px-4 py-3 font-medium text-slate-600">Due Date</th>
              <th className="px-4 py-3 font-medium text-slate-600">Est. Hrs</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  No tasks found. Create tasks for your projects to track work.
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const overdue = isOverdue(task.due_date, task.status)
                const daysRemaining = getDaysRemaining(task.due_date)
                return (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
                        className="font-semibold text-slate-900 hover:text-slate-700"
                      >
                        {task.title}
                      </Link>
                      {task.description && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-1">{task.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Link
                        href={`/dashboard/projects/${task.project_id}`}
                        className="text-sm text-slate-700 hover:text-slate-900 hover:underline"
                      >
                        {task.project_name ?? '—'}
                      </Link>
                      {task.client_name && (
                        <p className="text-xs text-slate-400 mt-0.5">{task.client_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      {task.milestone_name ?? '—'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge variant={getStatusVariant(task.status)}>
                        {getStatusLabel(task.status)}
                      </Badge>
                      {overdue && <Badge variant="destructive" className="ml-1">Overdue</Badge>}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge variant={getPriorityVariant(task.priority ?? 'medium')}>
                        {getPriorityLabel(task.priority ?? 'medium')}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {task.due_date ? (
                        <div>
                          <span className="text-sm text-slate-600">{formatDate(task.due_date)}</span>
                          {daysRemaining !== null && (
                            <p
                              className={`text-xs font-medium mt-0.5 ${
                                daysRemaining < 0
                                  ? 'text-red-600'
                                  : daysRemaining <= 2
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {daysRemaining >= 0 ? `${daysRemaining}d left` : `${Math.abs(daysRemaining)}d late`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      {task.estimated_hrs != null ? `${task.estimated_hrs}h` : '—'}
                    </td>
                    <td className="px-4 py-4 align-top text-right text-sm font-medium">
                      <Link href={`/dashboard/tasks/${task.id}`} className="text-slate-700 hover:text-slate-900">
                        View
                      </Link>
                      <span className="mx-2 text-slate-300">|</span>
                      <Link href={`/dashboard/tasks/${task.id}/edit`} className="text-slate-900 hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}