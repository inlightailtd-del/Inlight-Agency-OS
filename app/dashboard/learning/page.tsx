import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getLearningSummary, getPatternsByCategory } from '@/lib/learning/patterns'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const G = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ''

export default async function LearningPage({ searchParams }: { searchParams?: { tab?: string | string[] } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const summary = await getLearningSummary(supabase, user.id)
  const activeTab = G(searchParams?.tab) || 'success'

  const tabs = [
    { key: 'success', label: 'Success Patterns', count: summary.successPatterns, category: 'success_pattern' as const },
    { key: 'failure', label: 'Failure Patterns', count: summary.failurePatterns, category: 'failure_pattern' as const },
    { key: 'revenue', label: 'Revenue Patterns', count: summary.revenuePatterns, category: 'revenue_pattern' as const },
    { key: 'growth', label: 'Growth Patterns', count: summary.growthPatterns, category: 'growth_pattern' as const },
    { key: 'employees', label: 'Employee Learnings', count: summary.employeeLearnings, category: 'employee_learning' as const },
  ]

  const activeTabData = tabs.find((t) => t.key === activeTab)
  const patterns = activeTabData ? await getPatternsByCategory(supabase, user.id, activeTabData.category) : []

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Company Brain Learning</h1>
          <p className="text-sm text-slate-500 mt-1">Self-evolving pattern library. Every execution generates lessons that improve future decisions.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Patterns" value={summary.totalPatterns} color="text-slate-900" />
        <StatCard title="Success" value={summary.successPatterns} color="text-emerald-600" />
        <StatCard title="Failures" value={summary.failurePatterns} color="text-red-600" />
        <StatCard title="Revenue" value={summary.revenuePatterns} color="text-sky-600" />
        <StatCard title="Employee" value={summary.employeeLearnings} color="text-indigo-600" />
      </div>

      {/* Top Patterns */}
      {summary.topPatterns.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Impact Patterns</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {summary.topPatterns.slice(0, 6).map((p, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={p.category === 'success_pattern' ? 'success' : p.category === 'failure_pattern' ? 'destructive' : 'info'} className="text-[9px]">{p.category.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs text-slate-400">Used {p.usageCount}x</span>
                </div>
                <p className="text-sm font-medium text-slate-900">{p.title}</p>
                <p className="text-xs text-slate-500 mt-1">{p.description.slice(0, 120)}</p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                  <span>Impact: {p.impactScore}/10</span>
                  <span>Success: {p.successRate}%</span>
                  {p.lastUsed && <span>Last: {formatDateTime(p.lastUsed)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/dashboard/learning?tab=${tab.key}`}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </div>

      {/* Pattern List */}
      <div className="space-y-3">
        {patterns.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500">No patterns in this category yet. Run workflows and revenue cycles to generate learnings.</p>
          </div>
        ) : (
          patterns.map((p, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-900 text-sm">{p.title}</span>
                    {p.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="default" className="text-[9px]">{t}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">{p.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span>Impact: {p.impactScore}/10</span>
                    <span>Used: {p.usageCount}x</span>
                    <span>Success: {p.successRate}%</span>
                    {p.lastUsed && <span>Last: {formatDateTime(p.lastUsed)}</span>}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 max-w-xs">
                    <div className={`h-full rounded-full ${p.impactScore >= 7 ? 'bg-emerald-500' : p.impactScore >= 4 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${p.impactScore * 10}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
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
