import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  type MilestoneListStatus,
} from '@/lib/supabase/milestones'

const getSearchValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value?.trim() ?? ''

const getStatusValue = (value: string | string[] | undefined): MilestoneListStatus => {
  const raw = Array.isArray(value) ? value[0] : value
  const allOptions: MilestoneListStatus[] = ['all', ...milestoneStatuses]
  return allOptions.includes(raw as MilestoneListStatus) ? (raw as MilestoneListStatus) : 'all'
}

export default async function MilestonesPage({
  searchParams,
}: {
  searchParams?: { query?: string | string[]; status?: string | string[] }
}) {
  const query = getSearchValue(searchParams?.query)
  const status = getStatusValue(searchParams?.status)
  const supabase = await createClient()
  const milestones = await fetchMilestones(supabase, query, status)

  const statusQuery = (statusValue: MilestoneListStatus) =>
    `/dashboard/milestones?status=${statusValue}${query ? `&query=${encodeURIComponent(query)}` : ''}`

  // Summary stats
  const totalMilestones = milestones.length
  const completedCount = milestones.filter((m) => m.status === 'completed').length
  const overdueCount = milestones.filter((m) => isOverdue(m.due_date, m.status)).length
  const completionRate = totalMilestones > 0 ? Math.round((completedCount / totalMilestones) * 100) : 0

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Milestones</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track delivery milestones across all projects. Monitor progress, deadlines, and completion.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/milestones/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
          <Link href="/dashboard/milestones/timeline">
            <Button variant="outline">Timeline</Button>
          </Link>
          <Link href="/dashboard/milestones/new">
            <Button>Add Milestone</Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Milestones</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalMilestones}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completion Rate</p>
          <p className="text-2xl font-bold text-sky-600 mt-1">{completionRate}%</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {overdueCount}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr] mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="sr-only" htmlFor="query">Search milestones</label>
            <Input id="query" name="query" placeholder="Search by name or description" defaultValue={query} />
          </div>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">Search</Button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Status filters</p>
          <div className="flex flex-wrap gap-2">
            {(['all', ...milestoneStatuses] as MilestoneListStatus[]).map((option) => {
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

      {/* Milestones Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Milestone</th>
              <th className="px-4 py-3 font-medium text-slate-600">Project</th>
              <th className="px-4 py-3 font-medium text-slate-600">Client</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Due Date</th>
              <th className="px-4 py-3 font-medium text-slate-600">Days Left</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {milestones.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  No milestones found. Create milestones for your projects to track delivery progress.
                </td>
              </tr>
            ) : (
              milestones.map((milestone) => {
                const overdue = isOverdue(milestone.due_date, milestone.status)
                const daysRemaining = getDaysRemaining(milestone.due_date)
                return (
                  <tr key={milestone.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <Link
                        href={`/dashboard/milestones/${milestone.id}`}
                        className="font-semibold text-slate-900 hover:text-slate-700"
                      >
                        {milestone.name}
                      </Link>
                      {milestone.description && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                          {milestone.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {milestone.project_id ? (
                        <Link
                          href={`/dashboard/projects/${milestone.project_id}`}
                          className="text-sm text-slate-700 hover:text-slate-900 hover:underline"
                        >
                          {milestone.project_name ?? 'Unknown project'}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {milestone.client_id ? (
                        <Link
                          href={`/dashboard/clients/${milestone.client_id}`}
                          className="text-sm text-slate-700 hover:text-slate-900 hover:underline"
                        >
                          {milestone.client_name ?? 'Unknown client'}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge variant={getStatusVariant(milestone.status)}>
                        {getStatusLabel(milestone.status)}
                      </Badge>
                      {overdue && (
                        <Badge variant="destructive" className="ml-1">Overdue</Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      {milestone.due_date ? formatDate(milestone.due_date) : '—'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {daysRemaining !== null ? (
                        <span
                          className={`text-sm font-medium ${
                            daysRemaining < 0
                              ? 'text-red-600'
                              : daysRemaining <= 3
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {daysRemaining >= 0 ? `${daysRemaining}d` : `${Math.abs(daysRemaining)}d late`}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-right text-sm font-medium">
                      <Link href={`/dashboard/milestones/${milestone.id}`} className="text-slate-700 hover:text-slate-900">
                        View
                      </Link>
                      <span className="mx-2 text-slate-300">|</span>
                      <Link href={`/dashboard/milestones/${milestone.id}/edit`} className="text-slate-900 hover:underline">
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