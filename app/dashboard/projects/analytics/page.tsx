import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPKR } from '@/lib/utils'
import {
  fetchProjects,
  getStatusLabel,
  getStatusVariant,
  projectStatuses,
  parseHealthScore,
  getHealthLabel,
  type ProjectWithClient,
} from '@/lib/supabase/projects'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const projects = await fetchProjects(supabase)

  // --- KPIs ---
  const totalProjects = projects.length
  const activeCount = projects.filter((p) => p.status === 'active').length
  const completedCount = projects.filter((p) => p.status === 'completed').length
  const cancelledCount = projects.filter((p) => p.status === 'cancelled').length
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0)
  const totalActual = projects.reduce((sum, p) => sum + (p.actual_cost ?? 0), 0)
  const completionRate = totalProjects > 0 ? Math.round((completedCount / totalProjects) * 100) : 0

  // Status distribution
  const statusDistribution = projectStatuses.map((status) => ({
    name: getStatusLabel(status),
    count: projects.filter((p) => p.status === status).length,
    color:
      status === 'active'
        ? 'bg-emerald-500'
        : status === 'completed'
        ? 'bg-slate-500'
        : status === 'planning'
        ? 'bg-sky-500'
        : status === 'paused'
        ? 'bg-amber-500'
        : 'bg-red-500',
  }))

  // Budget vs Actual by project
  const budgetData = projects
    .filter((p) => p.budget)
    .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))
    .slice(0, 10)

  const maxBudget = Math.max(...budgetData.map((p) => Math.max(p.budget ?? 0, p.actual_cost ?? 0)), 1)

  // Health distribution
  const healthDistribution = [
    { label: 'Excellent (80-100)', min: 80, max: 100, color: 'bg-emerald-500' },
    { label: 'Stable (50-79)', min: 50, max: 79, color: 'bg-amber-500' },
    { label: 'At Risk (30-49)', min: 30, max: 49, color: 'bg-orange-500' },
    { label: 'Critical (0-29)', min: 0, max: 29, color: 'bg-red-500' },
  ].map((range) => ({
    ...range,
    count: projects.filter((p) => {
      const score = parseHealthScore(p.health)
      return score >= range.min && score <= range.max
    }).length,
  }))

  // Service type distribution
  const serviceDistMap = projects.reduce(
    (acc, p) => {
      const key = p.service_type || 'unspecified'
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  const serviceDistribution = Object.entries(serviceDistMap)
    .map(([key, count]) => ({
      name: key === 'unspecified' ? 'Unspecified' : key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count)

  // Average values
  const avgBudget = projects.filter((p) => p.budget).length > 0
    ? projects.filter((p) => p.budget).reduce((sum, p) => sum + (p.budget ?? 0), 0) / projects.filter((p) => p.budget).length
    : 0

  const avgHealth = projects.length > 0
    ? Math.round(projects.reduce((sum, p) => sum + parseHealthScore(p.health), 0) / projects.length)
    : 0

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Project Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            High-level overview of project portfolio health, budget utilization, and delivery metrics.
          </p>
        </div>
        <Link href="/dashboard/projects">
          <Button variant="outline">Back to projects</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No projects yet. Create projects to see analytics.</p>
          <Link href="/dashboard/projects/new" className="mt-4 inline-block">
            <Button variant="outline">Create project</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPI title="Total Projects" value={totalProjects} color="text-slate-900" />
            <KPI title="Active" value={activeCount} color="text-emerald-600" />
            <KPI title="Completion Rate" value={`${completionRate}%`} color="text-sky-600" />
            <KPI title="Avg Health" value={`${avgHealth}%`} color={avgHealth >= 60 ? 'text-emerald-600' : 'text-red-600'} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI title="Total Budget" value={formatPKR(totalBudget)} color="text-slate-900" />
            <KPI title="Total Spent" value={formatPKR(totalActual)} color="text-amber-600" />
            <KPI title="Avg Budget/Project" value={formatPKR(Math.round(avgBudget))} color="text-slate-700" />
            <KPI title="Over Budget" value={`${projects.filter((p) => (p.budget ?? 0) > 0 && (p.actual_cost ?? 0) > (p.budget ?? 0)).length}`} color="text-red-600" />
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
                        className={`h-full rounded-full ${item.color} transition-all duration-500`}
                        style={{
                          width: `${totalProjects > 0 ? Math.round((item.count / totalProjects) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {statusDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    {item.name}: {item.count}
                  </div>
                ))}
              </div>
            </div>

            {/* Health Distribution */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Health Distribution</h2>
              <div className="space-y-4">
                {healthDistribution.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </div>
                    <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-500`}
                        style={{
                          width: `${totalProjects > 0 ? Math.round((item.count / totalProjects) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {healthDistribution.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    {item.label}: {item.count}
                  </div>
                ))}
              </div>
            </div>

            {/* Budget vs Actual */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Budget vs Actual (Top {budgetData.length} projects)
              </h2>
              {budgetData.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">No budget data available.</p>
              ) : (
                <div className="space-y-3">
                  {budgetData.map((project) => {
                    const bud = project.budget ?? 0
                    const act = project.actual_cost ?? 0
                    const pct = bud > 0 ? Math.round((act / bud) * 100) : 0
                    const isOver = bud > 0 && act > bud
                    return (
                      <div key={project.id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="text-slate-700 hover:text-slate-900 hover:underline truncate max-w-[180px]"
                          >
                            {project.name}
                          </Link>
                          <span className={`text-xs font-medium ${isOver ? 'text-red-600' : 'text-slate-500'}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Budget bar */}
                          <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden relative">
                            <div
                              className="absolute inset-y-0 left-0 h-full bg-slate-300 rounded-full"
                              style={{
                                width: `${maxBudget > 0 ? Math.round((bud / maxBudget) * 100) : 0}%`,
                              }}
                            />
                            <div
                              className={`absolute inset-y-0 left-0 h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-emerald-500'} opacity-80`}
                              style={{
                                width: `${maxBudget > 0 ? Math.round((act / maxBudget) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-20 text-right">
                            {formatPKR(act)} / {formatPKR(bud)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Service Type Distribution */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">By Service Type</h2>
              {serviceDistribution.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">No service data available.</p>
              ) : (
                <div className="space-y-4">
                  {serviceDistribution.map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{item.name}</span>
                        <span className="font-semibold text-slate-900">{item.count}</span>
                      </div>
                      <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                          style={{
                            width: `${totalProjects > 0 ? Math.round((item.count / totalProjects) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Project Listing Table */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">All Projects Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-slate-600">Project</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Health</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Budget</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Spent</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Budget %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {projects.map((project) => {
                    const healthScore = parseHealthScore(project.health)
                    const bud = project.budget ?? 0
                    const act = project.actual_cost ?? 0
                    const budgetUsed = bud > 0 ? Math.round((act / bud) * 100) : 0
                    const isOverBudget = bud > 0 && act > bud
                    return (
                      <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="font-medium text-slate-900 hover:text-slate-700"
                          >
                            {project.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getStatusVariant(project.status)}>
                            {getStatusLabel(project.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-slate-900">{healthScore}%</span>
                          <span className="ml-2 text-xs text-slate-500">{getHealthLabel(healthScore)}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatPKR(bud)}</td>
                        <td className={`px-4 py-3 ${isOverBudget ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                          {formatPKR(act)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, budgetUsed)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${isOverBudget ? 'text-red-600' : 'text-slate-600'}`}>
                              {budgetUsed}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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