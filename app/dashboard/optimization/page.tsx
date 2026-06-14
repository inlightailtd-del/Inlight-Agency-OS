import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getLatestPerfReport, getPerfStats, generatePerfReport } from '@/lib/perf/analyzer'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function runPerfAction() {
  'use server'
  const supabase = await createClient()
  const { generatePerfReport } = await import('@/lib/perf/analyzer')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await generatePerfReport(supabase, user.id)
  revalidatePath('/dashboard/optimization')
  redirect('/dashboard/optimization')
}

export default async function OptimizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [report, stats] = await Promise.all([
    getLatestPerfReport(supabase, user.id),
    getPerfStats(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Performance Optimization</h1>
          <p className="text-sm text-slate-500 mt-1">Analyze agent executions, workflows, and queue performance. Get AI-powered optimization recommendations.</p>
        </div>
        <form action={runPerfAction}>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Run Analysis</Button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Analyses Run" value={stats.totalRuns} color="text-slate-900" />
        <StatCard title="Total Executions" value={report?.metrics.totalExecutions || 0} color="text-sky-600" />
        <StatCard title="Success Rate" value={report?.metrics ? `${report.metrics.successRate}%` : '—'} color={report?.metrics && report.metrics.successRate >= 80 ? 'text-emerald-600' : 'text-amber-600'} />
        <StatCard title="Avg Duration" value={report?.metrics ? `${(report.metrics.avgDurationMs / 1000).toFixed(1)}s` : '—'} color="text-indigo-600" />
      </div>

      {report ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Analysis Summary</h2>
              <span className="text-xs text-slate-400">{formatDateTime(report.generatedAt)}</span>
            </div>
            <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{report.summary}</p>
          </div>

          {/* Metrics */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Agent Performance</h2>
              {Object.keys(report.metrics.agentTypeBreakdown).length === 0 ? (
                <p className="text-sm text-slate-500">No agent execution data.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(report.metrics.agentTypeBreakdown).slice(0, 5).map(([model, data]: any) => (
                    <div key={model}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-700 font-medium">{model}</span>
                        <span className="text-slate-500">{data.count} runs</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mb-1">
                        <span>{data.avgMs}ms avg</span>
                        <span className={`font-medium ${data.successRate >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{data.successRate}% success</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${data.successRate >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${data.successRate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Workflow Performance</h2>
              {Object.keys(report.metrics.workflowTypeBreakdown).length === 0 ? (
                <p className="text-sm text-slate-500">No workflow data.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(report.metrics.workflowTypeBreakdown).slice(0, 5).map(([wid, data]: any) => (
                    <div key={wid} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-700 font-medium">{wid}</span>
                        <span className={`font-medium text-xs ${data.successRate >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{data.successRate}%</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {data.count} runs, {(data.totalMs / 1000).toFixed(1)}s total
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottlenecks */}
          {report.bottlenecks.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Detected Bottlenecks</h2>
              <ul className="space-y-2">
                {report.bottlenecks.map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-red-500 mt-0.5 shrink-0">&#9679;</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Optimization Recommendations</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {report.recommendations.map((r: any, i: number) => (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <Badge variant={r.impact === 'high' ? 'destructive' : r.impact === 'medium' ? 'warning' : 'default'} className="text-[10px] shrink-0 mt-0.5">{r.impact}</Badge>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-500 uppercase">{r.area}</span>
                          <span className="text-sm font-medium text-slate-900">{r.issue}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{r.suggestion}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500 mb-4">No performance analysis yet. Run your first analysis to get AI-powered optimization recommendations.</p>
          <form action={runPerfAction}>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Run First Analysis</Button>
          </form>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
