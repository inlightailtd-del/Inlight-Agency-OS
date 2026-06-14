import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { fetchAutomationById, fetchAutomationRuns, deleteAutomation, getCategoryLabel, getStatusVariant } from '@/lib/supabase/automations'

export default async function AutomationDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const automation = await fetchAutomationById(supabase, params.id)
  const runs = await fetchAutomationRuns(supabase, params.id)
  if (!automation) notFound()

  const successRate = automation.total_runs > 0 ? Math.round((automation.success_runs / automation.total_runs) * 100) : 0

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">{automation.name}</h1><div className="flex flex-wrap items-center gap-2 mt-2"><Badge variant={getStatusVariant(automation.status)}>{automation.status}</Badge><Badge variant="default">{getCategoryLabel(automation.category)}</Badge></div></div>
        <div className="flex flex-wrap gap-3"><Link href="/dashboard/automations" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link><Link href={`/dashboard/automations/${automation.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Edit</Link><form action={deleteAction}><input type="hidden" name="automationId" value={automation.id} /><Button type="submit" variant="destructive">Delete</Button></form></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Category" value={getCategoryLabel(automation.category)} />
              <DetailRow label="Status" value={automation.status} />
              <DetailRow label="Trigger" value={automation.trigger_type} />
              {automation.schedule_cron && <DetailRow label="Schedule" value={automation.schedule_cron} />}
            </div>
            {automation.description && <div className="mt-6 pt-6 border-t border-slate-200"><h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3><p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{automation.description}</p></div>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Execution History ({runs.length})</h3>
            {runs.length === 0 ? <p className="text-sm text-slate-500">No runs recorded yet.</p> : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {runs.map((run) => (
                  <div key={run.id} className={`rounded-lg border p-3 ${run.status === 'success' ? 'border-emerald-200 bg-emerald-50/50' : run.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between"><Badge variant={run.status === 'success' ? 'success' : run.status === 'failed' ? 'destructive' : 'default'}>{run.status}</Badge><span className="text-xs text-slate-400">{formatDateTime(run.started_at)}</span></div>
                    {run.duration_ms && <p className="text-xs text-slate-500 mt-1">Duration: {run.duration_ms}ms</p>}
                    {run.error_msg && <p className="text-xs text-red-600 mt-1">{run.error_msg}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Performance</h3>
            <div className="space-y-4">
              <MetricRow label="Success Rate" value={successRate} color="bg-emerald-500" />
              <MetricRow label="Performance Score" value={automation.performance_score} color="bg-sky-500" />
              <div className="flex justify-between text-sm"><span className="text-slate-500">Total Runs</span><span className="font-semibold text-slate-900">{automation.total_runs}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Success</span><span className="font-semibold text-emerald-600">{automation.success_runs}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Failed</span><span className="font-semibold text-red-600">{automation.failed_runs}</span></div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
            <p>Created: {formatDateTime(automation.created_at)}</p>
            {automation.updated_at && <p className="mt-1">Updated: {formatDateTime(automation.updated_at)}</p>}
            {automation.last_run_at && <p className="mt-1">Last Run: {formatDateTime(automation.last_run_at)}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-sm font-medium text-slate-900">{value}</p></div> }
function MetricRow({ label, value, color }: { label: string; value: number; color: string }) { return <div><div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-900">{value}%</span></div><div className="h-3 w-full rounded-full bg-slate-200"><div className={`h-full rounded-full ${color}`} style={{width:`${Math.min(100,value)}%`}} /></div></div> }
async function deleteAction(f: FormData) { 'use server'; const s = await createClient(); await deleteAutomation(s, String(f.get('automationId')||'')); revalidatePath('/dashboard/automations'); redirect('/dashboard/automations') }