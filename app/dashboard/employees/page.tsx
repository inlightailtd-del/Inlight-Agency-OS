import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { fetchAgents, getAgentTypeLabel, getAgentStatusVariant, getDepartmentLabel } from '@/lib/supabase/agents'
import { fetchEmployees, getEmployeeLevel, getEmployeeStats, evaluateAllEmployees, PROMOTION_THRESHOLDS } from '@/lib/employees/employee'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function evaluateAction() {
  'use server'
  const supabase = await createClient()
  const { evaluateAllEmployees } = await import('@/lib/employees/employee')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await evaluateAllEmployees(supabase, user.id)
  revalidatePath('/dashboard/employees')
  redirect('/dashboard/employees')
}

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const employees = await fetchEmployees(supabase, user.id)
  const stats = await getEmployeeStats(supabase, user.id)

  const topEmployee = employees[0]

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Employees</h1>
          <p className="text-sm text-slate-500 mt-1">AI employee registry with performance tracking, task assignment, and promotion system.</p>
        </div>
        <div className="flex gap-3">
          <form action={evaluateAction}>
            <Button type="submit" variant="outline">Evaluate All</Button>
          </form>
          <a href="/dashboard/agents/new"><Button>Add Employee</Button></a>
        </div>
      </div>

      {topEmployee && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#127942;</span>
            <p className="text-sm font-medium text-emerald-800">
              Top Performer: <strong>{topEmployee.name}</strong> — Lvl {topEmployee.level} {getAgentTypeLabel(topEmployee.type)} with {topEmployee.performance_score}% performance and {topEmployee.success_rate}% success rate
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Employees" value={stats.total} color="text-slate-900" />
        <StatCard title="Active" value={stats.active} color="text-emerald-600" />
        <StatCard title="Avg Performance" value={`${stats.avgPerformance}%`} color={stats.avgPerformance >= 70 ? 'text-emerald-600' : 'text-amber-600'} />
        <StatCard title="Avg Success Rate" value={`${stats.avgSuccessRate}%`} color={stats.avgSuccessRate >= 70 ? 'text-emerald-600' : 'text-amber-600'} />
        <StatCard title="Total Tasks" value={stats.totalTasks} color="text-indigo-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((emp: any) => {
          const { title } = getEmployeeLevel(emp.performance_score, emp.success_rate)
          const level = emp.level || 1
          return (
            <div key={emp.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{emp.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{getAgentTypeLabel(emp.type)}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((l) => (
                        <span key={l} className={`text-lg ${l <= level ? 'text-amber-400' : 'text-slate-200'}`}>&#9733;</span>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 capitalize">{title}</span>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <Badge variant={getAgentStatusVariant(emp.status)}>{emp.status}</Badge>
                  {emp.department && <Badge variant="default">{getDepartmentLabel(emp.department)}</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                    <p className="text-xs text-slate-500">Performance</p>
                    <p className="text-lg font-bold text-slate-900">{emp.performance_score}%</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                    <p className="text-xs text-slate-500">Success Rate</p>
                    <p className="text-lg font-bold text-slate-900">{emp.success_rate}%</p>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-slate-500">
                  <span>Tasks: {emp.tasks_completed || emp.total_executions || 0}</span>
                  <span>Level {level}</span>
                </div>

                <div className="h-2 rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${emp.performance_score >= 70 ? 'bg-emerald-500' : emp.performance_score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${emp.performance_score}%` }} />
                </div>

                {emp.promoted_at && (
                  <p className="text-[10px] text-slate-400">Last promoted: {formatDateTime(emp.promoted_at)}</p>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-200 flex gap-2">
                <a href={`/dashboard/agents/${emp.id}/edit`} className="text-xs text-slate-600 hover:text-slate-900">Edit</a>
                <span className="text-slate-300">|</span>
                <a href={`/dashboard/agents/${emp.id}`} className="text-xs text-slate-600 hover:text-slate-900">View</a>
              </div>
            </div>
          )
        })}
        {employees.length === 0 && (
          <div className="col-span-full rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500 mb-4">No employees yet. Create your first AI employee to start tracking performance.</p>
            <a href="/dashboard/agents/new"><Button>Create Employee</Button></a>
          </div>
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
