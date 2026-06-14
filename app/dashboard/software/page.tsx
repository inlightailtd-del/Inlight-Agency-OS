import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getSwMetrics, getSwPipeline, runFullSoftwareCycle, SW_STAGES } from '@/lib/software/engine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function runSoftwareAction() {
  'use server'
  const supabase = await createClient()
  const { runFullSoftwareCycle, ensureSoftwareAgents } = await import('@/lib/software/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureSoftwareAgents(supabase, user.id)
  await runFullSoftwareCycle(supabase, user.id)
  revalidatePath('/dashboard/software')
  redirect('/dashboard/software')
}

const stageColors: Record<string, string> = {
  idea: 'bg-slate-100 border-slate-300',
  requirements: 'bg-blue-50 border-blue-300',
  architecture: 'bg-violet-50 border-violet-300',
  planning: 'bg-amber-50 border-amber-300',
  frontend: 'bg-indigo-50 border-indigo-300',
  backend: 'bg-orange-50 border-orange-300',
  integration: 'bg-purple-50 border-purple-300',
  testing: 'bg-rose-50 border-rose-300',
  deployment: 'bg-cyan-50 border-cyan-300',
  maintenance: 'bg-emerald-50 border-emerald-400',
}

const stageLabels: Record<string, string> = {
  idea: 'Idea', requirements: 'Reqs', architecture: 'Arch', planning: 'Plan',
  frontend: 'Frontend', backend: 'Backend', integration: 'Integrate',
  testing: 'Test', deployment: 'Deploy', maintenance: 'Maint',
}

export default async function SoftwarePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [metrics, pipeline] = await Promise.all([
    getSwMetrics(supabase, user.id),
    getSwPipeline(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Software Engineering</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous software development — idea through maintenance.</p>
        </div>
        <form action={runSoftwareAction}>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Dev Cycle</Button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <StatCard title="Total Projects" value={metrics.total} />
        <StatCard title="Deployed" value={metrics.totalDeployed} color="text-emerald-600" />
        <StatCard title="Repos" value={metrics.totalRepos} color="text-indigo-600" />
        <StatCard title="APIs" value={metrics.totalApis} color="text-purple-600" />
        <StatCard title="Test Suites" value={metrics.totalTestSuites} color="text-rose-600" />
        <StatCard title="This Month" value={metrics.projectsThisMonth} color="text-cyan-600" />
      </div>

      {/* Quality Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Avg Test Coverage" value={`${metrics.avgTestCoverage}%`} color={metrics.avgTestCoverage >= 70 ? 'text-emerald-600' : metrics.avgTestCoverage >= 40 ? 'text-amber-600' : 'text-red-600'} />
        <StatCard title="Avg Deployments" value={metrics.avgDeployCount} />
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Engineering Team</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {['Architect', 'PM', 'Frontend', 'Backend', 'DB', 'API', 'AI', 'QA', 'DevOps', 'Security'].map((name) => (
              <span key={name} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="overflow-x-auto mb-6">
        <div className="grid grid-cols-10 gap-2 min-w-[1200px]">
          {SW_STAGES.map((stage) => {
            const items = pipeline[stage] || []
            const bgColor = stageColors[stage] || 'bg-slate-50 border-slate-200'
            return (
              <div key={stage} className={`rounded-lg border ${bgColor} p-2`}>
                <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-2">{stageLabels[stage] || stage} ({items.length})</p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {items.slice(0, 8).map((item: any) => (
                    <div key={item.id} className="rounded-md bg-white p-2 shadow-sm border border-slate-100">
                      <p className="text-[10px] font-medium text-slate-900 line-clamp-2">{item.name}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Badge className="text-[7px] px-1 py-0">{item.project_type || '—'}</Badge>
                        {item.assignee_name && <span className="text-[8px] text-slate-400">{item.assignee_name}</span>}
                      </div>
                      {item.tags?.length > 0 && <p className="text-[8px] text-slate-400 mt-1 line-clamp-1">{item.tags.slice(0, 2).join(', ')}</p>}
                    </div>
                  ))}
                  {items.length > 8 && <p className="text-[10px] text-slate-400 text-center">+{items.length - 8}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By Type + Delivery Table */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Projects by Type</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(metrics.byType).slice(0, 6).map(([type, count]) => (
              <div key={type} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                <p className="text-xs font-medium text-slate-900 capitalize">{type}</p>
                <p className="text-lg font-bold text-slate-700">{count}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Agents</p>
          <div className="space-y-2">
            {[
              { role: 'Software Architect', focus: 'System design' },
              { role: 'Product Manager', focus: 'Requirements & sprints' },
              { role: 'Frontend Engineer', focus: 'React/Next.js UI' },
              { role: 'Backend Engineer', focus: 'API & services' },
              { role: 'Database Engineer', focus: 'Schema & migrations' },
              { role: 'API Engineer', focus: 'REST/GraphQL' },
              { role: 'AI Engineer', focus: 'LLM & agents' },
              { role: 'QA Engineer', focus: 'Testing & coverage' },
              { role: 'DevOps Engineer', focus: 'CI/CD & cloud' },
              { role: 'Security Engineer', focus: 'Auth & compliance' },
            ].map((a) => (
              <div key={a.role} className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">{a.role}</span>
                <span className="text-slate-400">{a.focus}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delivery Tracker */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Delivery Tracker</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Project</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Assignee</th>
                <th className="text-left px-3 py-2">Commits</th>
                <th className="text-left px-3 py-2">Coverage</th>
                <th className="text-left px-3 py-2">Tech</th>
                <th className="text-left px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(() => {
                const allItems = SW_STAGES.flatMap((s) => pipeline[s] || [])
                return allItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-xs">No software projects yet.</td></tr>
                ) : allItems.slice(0, 20).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900 text-xs">{item.name}</td>
                    <td className="px-3 py-2"><Badge className="text-[8px]">{item.project_type}</Badge></td>
                    <td className="px-3 py-2"><Badge className="text-[8px]">{item.status}</Badge></td>
                    <td className="px-3 py-2 text-xs text-slate-500">{item.assignee_name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{item.total_commits || 0}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-mono ${(item.test_coverage || 0) >= 70 ? 'text-emerald-600' : (item.test_coverage || 0) >= 40 ? 'text-amber-600' : 'text-slate-400'}`}>{item.test_coverage || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">{(item.tech_stack || []).slice(0, 2).join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{formatDateTime(item.created_at)}</td>
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
