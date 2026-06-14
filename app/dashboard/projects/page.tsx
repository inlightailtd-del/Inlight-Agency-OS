import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDate } from '@/lib/utils'
import {
  projectStatusOptions,
  fetchProjects,
  getStatusLabel,
  getStatusVariant,
  getHealthLabel,
  getHealthColor,
  getPriorityLabel,
  getPriorityVariant,
  getServiceTypeLabel,
  parseHealthScore,
  type ProjectListStatus,
  type ProjectWithClient,
} from '@/lib/supabase/projects'

const getSearchValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value?.trim() ?? ''

const getStatusValue = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value
  return projectStatusOptions.includes(raw as ProjectListStatus)
    ? (raw as ProjectListStatus)
    : 'all'
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: { query?: string | string[]; status?: string | string[] }
}) {
  const query = getSearchValue(searchParams?.query)
  const status = getStatusValue(searchParams?.status)
  const supabase = await createClient()
  const projects = await fetchProjects(supabase, query, status)

  const statusQuery = (statusValue: ProjectListStatus) =>
    `/dashboard/projects?status=${statusValue}${query ? `&query=${encodeURIComponent(query)}` : ''}`

  // Summary stats
  const totalProjects = projects.length
  const activeCount = projects.filter((p) => p.status === 'active').length
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0)
  const totalActual = projects.reduce((sum, p) => sum + (p.actual_cost ?? 0), 0)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track projects linked to clients, monitor budgets, milestones, and delivery health.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/projects/timeline">
            <Button variant="outline">Timeline</Button>
          </Link>
          <Link href="/dashboard/projects/analytics">
            <Button variant="outline">Analytics</Button>
          </Link>
          <Link href="/dashboard/projects/new">
            <Button>Add Project</Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Projects</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalProjects}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Budget</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatPKR(totalBudget)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Spent</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatPKR(totalActual)}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr] mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="sr-only" htmlFor="query">
              Search projects
            </label>
            <Input
              id="query"
              name="query"
              placeholder="Search by name or description"
              defaultValue={query}
            />
          </div>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            Search
          </Button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Status filters</p>
          <div className="flex flex-wrap gap-2">
            {projectStatusOptions.map((option) => {
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

      {/* Projects Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Project</th>
              <th className="px-4 py-3 font-medium text-slate-600">Client</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Priority</th>
              <th className="px-4 py-3 font-medium text-slate-600">Health</th>
              <th className="px-4 py-3 font-medium text-slate-600">Budget</th>
              <th className="px-4 py-3 font-medium text-slate-600">Timeline</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  No projects found. Create your first project to start tracking delivery.
                </td>
              </tr>
            ) : (
              projects.map((project) => {
                const healthScore = parseHealthScore(project.health)
                return (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="font-semibold text-slate-900 hover:text-slate-700"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {getServiceTypeLabel(project.service_type)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {project.client_id ? (
                        <Link
                          href={`/dashboard/clients/${project.client_id}`}
                          className="text-sm text-slate-700 hover:text-slate-900 hover:underline"
                        >
                          {project.client_name ?? 'Unknown'}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge variant={getStatusVariant(project.status)}>
                        {getStatusLabel(project.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge variant={getPriorityVariant(project.priority ?? 'medium')}>
                        {getPriorityLabel(project.priority ?? 'medium')}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 align-top w-40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{healthScore}%</span>
                        <span className="text-xs text-slate-500">{getHealthLabel(healthScore)}</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${getHealthColor(healthScore)}`}
                          style={{ width: `${healthScore}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-sm font-medium text-slate-900">
                        {formatPKR(project.budget ?? undefined)}
                      </p>
                      {project.budget && project.actual_cost ? (
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${(project.actual_cost / project.budget) > 1 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, Math.round((project.actual_cost / project.budget) * 100))}%` }}
                          />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      <p>{project.start_date ? formatDate(project.start_date) : '—'}</p>
                      <p className="text-xs text-slate-400">
                        → {project.end_date ? formatDate(project.end_date) : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-right text-sm font-medium">
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="text-slate-700 hover:text-slate-900"
                      >
                        View
                      </Link>
                      <span className="mx-2 text-slate-300">|</span>
                      <Link
                        href={`/dashboard/projects/${project.id}/edit`}
                        className="text-slate-900 hover:underline"
                      >
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