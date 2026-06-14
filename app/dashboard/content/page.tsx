import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { fetchContentRequests, contentTypes, contentStatuses, getContentTypeLabel, getStatusVariant, getPlatformLabel } from '@/lib/supabase/content'

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

export default async function ContentPage({ searchParams }: { searchParams?: { query?: string | string[]; status?: string | string[]; type?: string | string[] } }) {
  const q = G(searchParams?.query); const stat = G(searchParams?.status); const typ = G(searchParams?.type)
  const supabase = await createClient()
  const items = await fetchContentRequests(supabase, q, stat, typ)

  const filterUrl = (p: Record<string, string>) => { const sp = new URLSearchParams(); Object.entries({ query: q, status: stat, type: typ, ...p }).forEach(([k, v]) => { if (v) sp.set(k, v) }); return `/dashboard/content?${sp.toString()}` }

  const typeFilters = [{ name: 'All', key: 'all' }, ...contentTypes.map((t) => ({ name: getContentTypeLabel(t), key: t }))]
  const statusFilters = [{ name: 'All', key: 'all' }, ...contentStatuses.map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), key: s }))]

  const publishedItems = items.filter(i => i.status === 'published' && i.media_url)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Content Engine</h1><p className="text-sm text-slate-500 mt-1">Generate, manage, and track AI-powered content for blogs, social media, ads, and more.</p></div>
        <div className="flex gap-3">
          <Link href="/dashboard/content/dashboard"><Button variant="outline">Analytics</Button></Link>
          <Link href="/dashboard/content/history"><Button variant="outline">History</Button></Link>
          <Link href="/dashboard/content/new"><Button>New Request</Button></Link>
        </div>
      </div>

      {/* Published Image Posts Grid */}
      {publishedItems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Published Posts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedItems.map((item) => (
              <Link key={item.id} href={`/dashboard/content/${item.id}`} className="group rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden">
                {/* Image */}
                <div className="aspect-[1.91/1] bg-slate-100 relative overflow-hidden">
                  {item.media_url ? (
                    <img src={item.media_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl">📷</div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant={getStatusVariant(item.status)} className="text-[10px]">{item.status}</Badge>
                  </div>
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="font-semibold text-sm text-slate-900 line-clamp-1">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                    <Badge variant="default" className="text-[10px]">{getContentTypeLabel(item.content_type)}</Badge>
                    {item.platform && <span>{getPlatformLabel(item.platform)}</span>}
                    {(item.image_count ?? 0) > 0 && <span>{item.image_count} img</span>}
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                  {(item.score ?? 0) > 0 && (
                    <div className="mt-1.5"><span className="text-xs font-semibold text-sky-600">{item.score}%</span></div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KPI title="Total" value={items.length} />
        <KPI title="Published" value={publishedItems.length} color="text-emerald-600" />
        <KPI title="Completed" value={items.filter((i) => i.status === 'completed').length} color="text-emerald-600" />
        <KPI title="In Queue" value={items.filter((i) => i.status === 'queued' || i.status === 'generating').length} color="text-amber-600" />
        <KPI title="Drafts" value={items.filter((i) => i.status === 'draft').length} />
      </div>

      {/* Filters */}
      <div className="grid gap-4 mb-6">
        <form method="get" className="flex gap-3"><div className="flex-1"><Input name="query" placeholder="Search content..." defaultValue={q} /></div><Button type="submit" variant="secondary">Search</Button></form>
        <div className="grid gap-4 md:grid-cols-2">
          <FilterBox title="Type" filters={typeFilters} activeKey={typ||'all'} filterUrl={filterUrl} param="type" />
          <FilterBox title="Status" filters={statusFilters} activeKey={stat||'all'} filterUrl={filterUrl} param="status" />
        </div>
      </div>

      {/* All items list */}
      {items.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No content requests yet.</p></div> : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/dashboard/content/${item.id}`} className={`flex items-start justify-between rounded-lg border p-4 hover:bg-slate-50 transition-colors ${item.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : item.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{item.title}</p><Badge variant={getStatusVariant(item.status)}>{item.status}</Badge></div>
                {item.description && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{item.description}</p>}
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                  <Badge variant="default">{getContentTypeLabel(item.content_type)}</Badge>
                  {item.platform && <span>{getPlatformLabel(item.platform)}</span>}
                  {(item.image_count ?? 0) > 0 && <span>{item.image_count} image(s)</span>}
                  {item.word_count && <span>{item.word_count} words</span>}
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
              {(item.score ?? 0) > 0 && <span className="text-sm font-semibold text-sky-600 shrink-0">{item.score}%</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterBox({ title, filters, activeKey, filterUrl, param }: { title: string; filters: any[]; activeKey: string; filterUrl: Function; param: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-slate-900 mb-3">{title}</p><div className="flex flex-wrap gap-2">{filters.map((f: any) => { const active = activeKey === f.key; return <Link key={f.key} href={filterUrl({ [param]: f.key === 'all' ? '' : f.key })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{f.name}</Link> })}</div></div>
}
function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div>
}
