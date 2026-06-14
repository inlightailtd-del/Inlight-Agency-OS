import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getAutoMetrics, getAutoPipeline, runFullAutomationCycle, AUTO_STAGES } from '@/lib/automation/engine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function runAutomationAction() {
  'use server'
  const supabase = await createClient()
  const { runFullAutomationCycle, ensureAutomationAgents } = await import('@/lib/automation/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureAutomationAgents(supabase, user.id)
  await runFullAutomationCycle(supabase, user.id)
  revalidatePath('/dashboard/automations')
  redirect('/dashboard/automations')
}

const stageColors: Record<string, string> = {
  idea: 'bg-slate-100 border-slate-300',
  requirements: 'bg-blue-50 border-blue-300',
  workflow_design: 'bg-violet-50 border-violet-300',
  integration_mapping: 'bg-amber-50 border-amber-300',
  implementation: 'bg-indigo-50 border-indigo-300',
  testing: 'bg-rose-50 border-rose-300',
  deployment: 'bg-cyan-50 border-cyan-300',
  monitoring: 'bg-purple-50 border-purple-300',
  optimization: 'bg-emerald-50 border-emerald-400',
}

const stageLabels: Record<string, string> = {
  idea: 'Idea', requirements: 'Reqs', workflow_design: 'Design',
  integration_mapping: 'Integrate', implementation: 'Implement',
  testing: 'Test', deployment: 'Deploy', monitoring: 'Monitor',
  optimization: 'Optimize',
}

export default async function AutomationsDeptPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [metrics, pipeline] = await Promise.all([
    getAutoMetrics(supabase, user.id),
    getAutoPipeline(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Automation Department</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous workflow automation — idea through optimization across all integrations.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/automations/new"><Button variant="outline">New Automation</Button></Link>
          <form action={runAutomationAction}>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Cycle</Button>
          </form>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Workflows" value={metrics.total} />
        <StatCard title="Active" value={metrics.activeCount} color="text-emerald-600" />
        <StatCard title="Success Rate" value={`${metrics.successRate}%`} color={metrics.successRate >= 70 ? 'text-emerald-600' : metrics.successRate >= 40 ? 'text-amber-600' : 'text-red-600'} />
        <StatCard title="Templates" value={metrics.totalTemplates} color="text-indigo-600" />
        <StatCard title="Integrations" value={metrics.totalIntegrations} color="text-purple-600" />
      </div>

      {/* Integration Providers Grid */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Integration Framework</h2>
          <span className="text-xs text-slate-400">{metrics.connectedIntegrations}/{metrics.totalIntegrations} connected</span>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2 p-4">
          {['Gmail','Outlook','WhatsApp','Telegram','Slack','Discord','LinkedIn','Facebook','Instagram','X','HubSpot','Salesforce','Stripe','Calendly','Google Sheets','Airtable','Supabase','Webhooks'].map((p) => (
            <div key={p} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="text-[10px] font-medium text-slate-700">{p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Automation Team */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Automation Team</h2>
        </div>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3 p-4">
          {['Architect','Designer','Integration','API','Webhook','CRM','Email','Social','Data','Monitor'].map((name) => (
            <div key={name} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="font-medium text-[10px] text-slate-900 leading-tight">{name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="overflow-x-auto mb-6">
        <div className="grid grid-cols-9 gap-2 min-w-[1100px]">
          {AUTO_STAGES.map((stage) => {
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
                        <Badge className="text-[7px] px-1 py-0">{item.category}</Badge>
                      </div>
                      {item.performance_score > 0 && <p className="text-[8px] text-slate-400 mt-1">Score: {item.performance_score}%</p>}
                    </div>
                  ))}
                  {items.length > 8 && <p className="text-[10px] text-slate-400 text-center">+{items.length - 8}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Execution History & Templates */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Execution History</p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>Total runs: <span className="font-medium text-slate-700">{metrics.totalRuns}</span></p>
            <p>Success rate: <span className="font-medium text-emerald-600">{metrics.successRate}%</span></p>
            <p>Failed: <span className="font-medium text-red-600">{metrics.failedCount}</span></p>
            <p>Active workflows: <span className="font-medium text-slate-700">{metrics.activeCount}</span></p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">By Category</p>
          <div className="space-y-2">
            {Object.entries(metrics.byCategory).slice(0, 8).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 capitalize">{cat.replace('_', ' ')}</span>
                <span className="font-medium text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delivery Tracker */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Workflow Registry</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Workflow</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Pipeline</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Assignee</th>
                <th className="text-left px-3 py-2">Runs</th>
                <th className="text-left px-3 py-2">Score</th>
                <th className="text-left px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(() => {
                const allItems = AUTO_STAGES.flatMap((s) => pipeline[s] || [])
                return allItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-xs">No automation workflows yet.</td></tr>
                ) : allItems.slice(0, 20).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900 text-xs">{item.name}</td>
                    <td className="px-3 py-2"><Badge className="text-[8px]">{item.category}</Badge></td>
                    <td className="px-3 py-2 text-xs text-slate-500">{item.pipeline_status || 'idea'}</td>
                    <td className="px-3 py-2"><Badge className={`text-[8px] ${item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : item.status === 'paused' ? 'bg-amber-100 text-amber-800' : item.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>{item.status}</Badge></td>
                    <td className="px-3 py-2 text-xs text-slate-500">{item.assignee_name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{item.total_runs || 0}</td>
                    <td className="px-3 py-2"><span className={`text-xs font-mono ${(item.performance_score || 0) >= 70 ? 'text-emerald-600' : (item.performance_score || 0) >= 40 ? 'text-amber-600' : 'text-slate-400'}`}>{item.performance_score || '—'}</span></td>
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
