import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { fetchOrchTasks, fetchAgentMessages, getStatusVariant } from '@/lib/supabase/orchestrator'
import { fetchCommands, getStatusVariant as getCommandStatusVariant } from '@/lib/supabase/command-center'

export default async function OrchestratorHistoryPage() {
  const supabase = await createClient()
  const [tasks, messages, commands] = await Promise.all([
    fetchOrchTasks(supabase),
    fetchAgentMessages(supabase),
    fetchCommands(supabase),
  ])

  // Combine all into unified timeline
  const timeline: { type: string; id: string; title: string; subtitle: string; status: string; date: string }[] = []

  tasks.forEach((t) => {
    timeline.push({
      type: 'task', id: t.id,
      title: t.title,
      subtitle: t.agent_name ? `Assigned to ${t.agent_name}` : 'Unassigned',
      status: t.status,
      date: t.created_at,
    })
  })

  messages.forEach((m) => {
    timeline.push({
      type: 'message', id: m.id,
      title: `${m.from_agent_name || 'Unknown'} → ${m.to_agent_name || 'Unknown'}`,
      subtitle: m.message,
      status: 'success',
      date: m.created_at,
    })
  })

  commands.forEach((c) => {
    timeline.push({
      type: 'command', id: c.id,
      title: c.command,
      subtitle: c.response || '',
      status: c.status,
      date: c.created_at,
    })
  })

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Execution History</h1>
          <p className="text-sm text-slate-500 mt-1">Complete timeline of all orchestrator tasks, agent messages, and command executions.</p>
        </div>
        <Link href="/dashboard/orchestrator"><Button variant="outline">Back</Button></Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Events" value={timeline.length} />
        <KPI title="Tasks" value={tasks.length} color="text-sky-600" />
        <KPI title="Messages" value={messages.length} color="text-indigo-600" />
        <KPI title="Commands" value={commands.length} color="text-amber-600" />
      </div>

      {timeline.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No activity yet.</p></div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {timeline.map((event) => (
            <div key={`${event.type}-${event.id}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={event.type === 'task' ? 'info' : event.type === 'message' ? 'default' : 'warning'}>
                      {event.type}
                    </Badge>
                    <p className="font-medium text-slate-900">{event.title}</p>
                  </div>
                  {event.subtitle && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{event.subtitle}</p>}
                  {event.type === 'task' && (
                    <div className="mt-1">
                      <Badge variant={getStatusVariant(event.status as any)}><span className="text-[10px]">{event.status.replace(/_/g, ' ')}</span></Badge>
                    </div>
                  )}
                  {event.type === 'command' && (
                    <div className="mt-1">
                      <Badge variant={getCommandStatusVariant(event.status as any)}><span className="text-[10px]">{event.status}</span></Badge>
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(event.date)}</span>
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