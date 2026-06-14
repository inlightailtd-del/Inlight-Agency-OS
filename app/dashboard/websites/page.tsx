import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getWebsiteMetrics, getWebsitePipeline, runFullWebsiteCycle, WEBSITE_STAGES } from '@/lib/websites/engine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function runWebsiteAction() {
  'use server'
  const supabase = await createClient()
  const { runFullWebsiteCycle, ensureWebsiteAgents } = await import('@/lib/websites/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureWebsiteAgents(supabase, user.id)
  await runFullWebsiteCycle(supabase, user.id)
  revalidatePath('/dashboard/websites')
  redirect('/dashboard/websites')
}

const stageColors: Record<string, string> = {
  idea: 'bg-slate-100 border-slate-300',
  requirements: 'bg-blue-50 border-blue-300',
  wireframe: 'bg-amber-50 border-amber-300',
  design: 'bg-purple-50 border-purple-300',
  development: 'bg-indigo-50 border-indigo-300',
  testing: 'bg-rose-50 border-rose-300',
  deployment: 'bg-cyan-50 border-cyan-300',
  live: 'bg-emerald-50 border-emerald-400',
}

const stageLabels: Record<string, string> = {
  idea: 'Idea', requirements: 'Reqs', wireframe: 'Wire', design: 'Design',
  development: 'Dev', testing: 'Test', deployment: 'Deploy', live: 'Live',
}

export default async function WebsitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [metrics, pipeline] = await Promise.all([
    getWebsiteMetrics(supabase, user.id),
    getWebsitePipeline(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Website Department</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous website building — idea to live across all project types.</p>
        </div>
        <form action={runWebsiteAction}>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Website Cycle</Button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Projects" value={metrics.total} />
        <StatCard title="Live Sites" value={metrics.totalLive} color="text-emerald-600" />
        <StatCard title="This Month" value={metrics.projectsThisMonth} color="text-indigo-600" />
        <StatCard title="Templates" value={metrics.totalTemplates} color="text-purple-600" />
        <StatCard title="Deployments" value={metrics.totalDeployments} color="text-cyan-600" />
      </div>

      {/* Quality Scores */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Avg SEO Score" value={`${metrics.avgSeoScore}/100`} color={metrics.avgSeoScore >= 80 ? 'text-emerald-600' : metrics.avgSeoScore >= 60 ? 'text-amber-600' : 'text-red-600'} />
        <StatCard title="Avg Performance" value={`${metrics.avgPerformance}/100`} color={metrics.avgPerformance >= 80 ? 'text-emerald-600' : metrics.avgPerformance >= 60 ? 'text-amber-600' : 'text-red-600'} />
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Web Team</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {['Director', 'Architect', 'Designer', 'Landing', 'SaaS', 'Frontend', 'Backend', 'SEO', 'QA', 'Deploy'].map((name) => (
              <span key={name} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="overflow-x-auto mb-6">
        <div className="grid grid-cols-8 gap-3 min-w-[1000px]">
          {WEBSITE_STAGES.map((stage) => {
            const items = pipeline[stage] || []
            const bgColor = stageColors[stage] || 'bg-slate-50 border-slate-200'
            return (
              <div key={stage} className={`rounded-lg border ${bgColor} p-3`}>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">{stageLabels[stage] || stage} ({items.length})</p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {items.slice(0, 8).map((item: any) => (
                    <div key={item.id} className="rounded-md bg-white p-2 shadow-sm border border-slate-100">
                      <p className="text-xs font-medium text-slate-900 line-clamp-2">{item.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge className="text-[7px] px-1 py-0">{item.website_type || '—'}</Badge>
                        {item.pages && <span className="text-[9px] text-slate-400">{item.pages}p</span>}
                      </div>
                      {item.assignee_name && <p className="text-[9px] text-slate-400 mt-1">{item.assignee_name}</p>}
                      {item.status === 'live' && (
                        <div className="flex gap-1 mt-1 text-[8px] text-slate-400">
                          <span>SEO: {item.seo_score || 0}</span>
                          <span>Perf: {item.performance_score || 0}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length > 8 && <p className="text-xs text-slate-400 text-center">+{items.length - 8} more</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By Type Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(metrics.byType).map(([type, count]) => (
          <div key={type} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-900 capitalize">{type.replace('_', ' ')}</p>
            <p className="text-2xl font-bold text-slate-700 mt-1">{count}</p>
          </div>
        ))}
      </div>

      {/* Delivery Tracker */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Tracker</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Pages</th>
                <th className="text-left px-4 py-3">Assignee</th>
                <th className="text-left px-4 py-3">SEO</th>
                <th className="text-left px-4 py-3">Perf</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(() => {
                const allItems = [...(pipeline.idea || []), ...(pipeline.requirements || []), ...(pipeline.wireframe || []), ...(pipeline.design || []), ...(pipeline.development || []), ...(pipeline.testing || []), ...(pipeline.deployment || []), ...(pipeline.live || [])]
                return allItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No website projects yet.</td></tr>
                ) : allItems.slice(0, 20).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900 text-xs">{item.name}</td>
                    <td className="px-4 py-3"><Badge className="text-[9px]">{item.website_type?.replace('_', ' ') || '—'}</Badge></td>
                    <td className="px-4 py-3"><Badge className="text-[9px]">{item.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.pages || 1}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.assignee_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${(item.seo_score || 0) >= 80 ? 'text-emerald-600' : (item.seo_score || 0) >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>{item.seo_score || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${(item.performance_score || 0) >= 80 ? 'text-emerald-600' : (item.performance_score || 0) >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>{item.performance_score || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(item.created_at)}</td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
