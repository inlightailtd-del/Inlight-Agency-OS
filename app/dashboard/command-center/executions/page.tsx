import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { fetchExecutionLogs, executionModules } from '@/lib/supabase/command-center'

export default async function ExecutionsPage({ searchParams }: { searchParams?: { module?: string | string[] } }) {
  const mod = Array.isArray(searchParams?.module) ? searchParams?.module[0] : searchParams?.module?.trim() || undefined
  const supabase = await createClient()
  const logs = await fetchExecutionLogs(supabase)

  const filteredLogs = mod && mod !== 'all' ? logs.filter((l) => l.module === mod) : logs

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Execution Logs</h1><p className="text-sm text-slate-500 mt-1">Detailed log of all AI command executions across modules.</p></div>
        <Link href="/dashboard/command-center"><Button variant="outline">Back</Button></Link>
      </div>

      {/* Module filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm mb-6">
        <p className="text-sm font-semibold text-slate-900 mb-3">Modules</p>
        <div className="flex flex-wrap gap-2">
          {[ { name: 'All', key: 'all' }, ...executionModules.map((m) => ({ name: m.charAt(0).toUpperCase() + m.slice(1), key: m })) ].map((item) => {
            const active = (mod || 'all') === item.key
            const count = item.key === 'all' ? logs.length : logs.filter((l) => l.module === item.key).length
            return (
              <Link key={item.key} href={`/dashboard/command-center/executions?module=${item.key === 'all' ? 'all' : item.key}`}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
              >{item.name} ({count})</Link>
            )
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Logs" value={filteredLogs.length} />
        <KPI title="Success" value={filteredLogs.filter((l) => l.status === 'success').length} color="text-emerald-600" />
        <KPI title="Failed" value={filteredLogs.filter((l) => l.status === 'failed').length} color="text-red-600" />
        <KPI title="Warnings" value={filteredLogs.filter((l) => l.status === 'warning').length} color="text-amber-600" />
      </div>

      {filteredLogs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No execution logs found.</p></div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.map((log) => (
            <div key={log.id} className={`rounded-lg border p-3 ${log.status === 'success' ? 'border-emerald-200 bg-emerald-50/50' : log.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 text-sm">{log.action}</p>
                    <Badge variant={log.status === 'success' ? 'success' : log.status === 'failed' ? 'destructive' : 'warning'}>{log.status}</Badge>
                  </div>
                  {log.message && <p className="text-xs text-slate-500 mt-1">{log.message}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    {log.module && <span className="font-medium">{log.module}</span>}
                    {log.entity_type && <span>{log.entity_type}</span>}
                    {log.duration_ms && <span>{log.duration_ms}ms</span>}
                  </div>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(log.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div>
}