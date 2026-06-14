import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { listDepartments, getLatestManagerReport, getManagerStats, DEPARTMENT_DISPLAY_NAMES, type DepartmentType, runManagerAssessment } from '@/lib/ceo/manager'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function runDeptAction(dept: string) {
  'use server'
  const supabase = await createClient()
  const { runManagerAssessment } = await import('@/lib/ceo/manager')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await runManagerAssessment(supabase, user.id, dept as DepartmentType)
  revalidatePath('/dashboard/managers')
  redirect('/dashboard/managers')
}

export default async function ManagersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const departments = listDepartments()
  const [stats, ...reports] = await Promise.all([
    getManagerStats(supabase, user.id),
    ...departments.map((d) => getLatestManagerReport(supabase, user.id, d)),
  ])

  const reportMap = new Map<string, any>()
  departments.forEach((d, i) => reportMap.set(d, reports[i]))

  const getDeptIcon = (dept: string): string => {
    const icons: Record<string, string> = { sales: '💰', marketing: '📢', content: '✍️', operations: '⚙️', finance: '📊' }
    return icons[dept] || '📋'
  }

  const getDecisionVariant = (type: string): 'default' | 'success' | 'warning' | 'destructive' | 'info' => {
    const map: Record<string, any> = { create_task: 'info', launch_workflow: 'success', create_content: 'default', enqueue_job: 'info' }
    return map[type] ?? 'default'
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Department Managers</h1>
          <p className="text-sm text-slate-500 mt-1">AI department managers that monitor their area, generate assessments, and execute tasks autonomously.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => {
          const report = reportMap.get(dept)
          const deptStats = stats[dept]
          const decisions = report?.decisions || []
          const successful = decisions.filter((d: any) => d.executed !== false).length

          return (
            <div key={dept} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getDeptIcon(dept)}</span>
                  <h2 className="text-lg font-semibold text-slate-900">{DEPARTMENT_DISPLAY_NAMES[dept]}</h2>
                </div>
                <form action={runDeptAction.bind(null, dept)}>
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Run</Button>
                </form>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="flex gap-4 text-sm">
                  <div><span className="text-slate-500">Runs:</span> <span className="font-semibold">{deptStats.totalRuns}</span></div>
                  <div><span className="text-slate-500">Decisions:</span> <span className="font-semibold">{decisions.length}</span></div>
                  {deptStats.lastRun && <div className="text-xs text-slate-400 ml-auto">{formatDateTime(deptStats.lastRun)}</div>}
                </div>

                {report ? (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed">{report.summary.slice(0, 200)}{report.summary.length > 200 ? '...' : ''}</p>

                    {report.metrics?.totalJobs != null && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="default">Jobs: {report.metrics.totalJobs}</Badge>
                        <Badge variant={report.metrics.failedJobs > 0 ? 'destructive' : 'default'}>Failed: {report.metrics.failedJobs}</Badge>
                        <Badge variant="info">Pending: {report.metrics.pendingTasks}</Badge>
                      </div>
                    )}

                    {decisions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Decisions ({successful} ok)</p>
                        {decisions.slice(0, 3).map((d: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <Badge variant={getDecisionVariant(d.type)} className="text-[9px] mt-0.5 shrink-0">{d.type.replace(/_/g, ' ')}</Badge>
                            <span className="text-slate-600">{d.description.slice(0, 100)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">No assessments yet.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
