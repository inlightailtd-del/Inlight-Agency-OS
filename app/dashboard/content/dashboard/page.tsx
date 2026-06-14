import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'; import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { fetchContentRequests, contentTypes, contentStatuses, getContentTypeLabel, getStatusVariant } from '@/lib/supabase/content'

export default async function ContentDashboardPage() {
  const supabase = await createClient(); const items = await fetchContentRequests(supabase)
  const total = items.length; const completed = items.filter((i) => i.status === 'completed').length
  const avgScore = completed > 0 ? Math.round(items.filter((i) => i.status === 'completed').reduce((s, i) => s + i.score, 0) / completed) : 0

  const typeDist = contentTypes.map((t) => ({ name: getContentTypeLabel(t), key: t, count: items.filter((i) => i.content_type === t).length }))
  const statusDist = contentStatuses.map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), key: s, count: items.filter((i) => i.status === s).length }))

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Content Analytics</h1><p className="text-sm text-slate-500 mt-1">Performance metrics and content generation statistics.</p></div>
        <Link href="/dashboard/content"><Button variant="outline">Back</Button></Link>
      </div>
      {total === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No content generated yet.</p></div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPI title="Total Requests" value={total} /><KPI title="Completed" value={completed} color="text-emerald-600" />
            <KPI title="Avg Score" value={`${avgScore}%`} color="text-sky-600" /><KPI title="Failed" value={items.filter((i) => i.status === 'failed').length} color="text-red-600" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI title="In Queue" value={items.filter((i) => i.status === 'queued').length} />
            <KPI title="Generating" value={items.filter((i) => i.status === 'generating').length} color="text-amber-600" />
            <KPI title="In Review" value={items.filter((i) => i.status === 'review').length} color="text-amber-600" />
            <KPI title="Drafts" value={items.filter((i) => i.status === 'draft').length} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">By Content Type</h2><div className="space-y-4">{typeDist.filter((t) => t.count > 0).map((item) => (<div key={item.name}><div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-600">{item.name}</span><span className="font-semibold text-slate-900">{item.count}</span></div><div className="h-6 w-full rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{width:`${total>0?Math.round((item.count/total)*100):0}%`}} /></div></div>))}</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">By Status</h2><div className="space-y-4">{statusDist.map((item) => (<div key={item.name}><div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-600">{item.name}</span><span className="font-semibold text-slate-900">{item.count}</span></div><div className="h-6 w-full rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.key==='completed'?'bg-emerald-500':item.key==='failed'?'bg-red-500':item.key==='generating'?'bg-amber-500':'bg-slate-400'}`} style={{width:`${total>0?Math.round((item.count/total)*100):0}%`}} /></div></div>))}</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">Best Performers</h2><div className="space-y-3">{[...items].filter((i) => i.status === 'completed' && i.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map((item) => (<Link key={item.id} href={`/dashboard/content/${item.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><div><p className="font-medium text-slate-900 text-sm">{item.title}</p><p className="text-xs text-slate-500">{getContentTypeLabel(item.content_type)}</p></div><span className="text-sm font-semibold text-sky-600">{item.score}%</span></Link>))}</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Content</h2><div className="space-y-3 max-h-[400px] overflow-y-auto">{items.slice(0, 10).map((item) => (<Link key={item.id} href={`/dashboard/content/${item.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><div><p className="font-medium text-slate-900 text-sm">{item.title}</p><div className="flex items-center gap-2 mt-1"><Badge variant={getStatusVariant(item.status)}><span className="text-[10px]">{item.status}</span></Badge><span className="text-xs text-slate-400">{getContentTypeLabel(item.content_type)}</span></div></div><span className="text-xs text-slate-400">{formatDate(item.created_at)}</span></Link>))}</div></div>
          </div>
        </>
      )}
    </div>
  )
}
function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div> }