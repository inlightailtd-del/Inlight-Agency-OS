import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'; import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { fetchContentRequests, getContentTypeLabel, getStatusVariant, getPlatformLabel } from '@/lib/supabase/content'

export default async function ContentHistoryPage() {
  const supabase = await createClient(); const items = await fetchContentRequests(supabase)
  const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Content History</h1><p className="text-sm text-slate-500 mt-1">Complete generation history sorted by date.</p></div>
        <Link href="/dashboard/content"><Button variant="outline">Back</Button></Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Generated" value={items.length} />
        <KPI title="Completed" value={items.filter((i) => i.status === 'completed').length} color="text-emerald-600" />
        <KPI title="Failed" value={items.filter((i) => i.status === 'failed').length} color="text-red-600" />
        <KPI title="In Progress" value={items.filter((i) => i.status === 'generating' || i.status === 'queued').length} color="text-amber-600" />
      </div>
      {sorted.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No content history.</p></div> : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {sorted.map((item) => (
            <Link key={item.id} href={`/dashboard/content/${item.id}`} className={`flex items-start justify-between rounded-lg border p-4 hover:bg-slate-50 transition-colors ${item.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : item.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{item.title}</p><Badge variant={getStatusVariant(item.status)}>{item.status}</Badge></div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <Badge variant="default">{getContentTypeLabel(item.content_type)}</Badge>
                  {item.platform && <span>{getPlatformLabel(item.platform)}</span>}
                  {item.word_count && <span>{item.word_count} words</span>}
                  {item.score > 0 && <span className="text-sky-600 font-medium">{item.score}%</span>}
                </div>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{formatDateTime(item.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div> }