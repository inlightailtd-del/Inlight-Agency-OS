import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { fetchCommands, commandStatuses, commandCategories, getStatusVariant, getCategoryLabel } from '@/lib/supabase/command-center'

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

export default async function CommandHistoryPage({ searchParams }: { searchParams?: { query?: string | string[]; status?: string | string[]; category?: string | string[] } }) {
  const q = G(searchParams?.query); const stat = G(searchParams?.status); const cat = G(searchParams?.category)
  const supabase = await createClient()
  const commands = await fetchCommands(supabase, q, stat)

  const filterUrl = (p: Record<string, string>) => {
    const sp = new URLSearchParams()
    const all = { query: q, status: stat, category: cat, ...p }
    Object.entries(all).forEach(([k, v]) => { if (v) sp.set(k, v) })
    return `/dashboard/command-center/history?${sp.toString()}`
  }

  const filteredByCat = cat && cat !== 'all' ? commands.filter((c) => c.category === cat) : commands

  const statusFilters: { name: string; key: string; count: number }[] = [
    { name: 'All', key: 'all', count: commands.length },
    ...commandStatuses.map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), key: s, count: commands.filter((c) => c.status === s).length })),
  ]
  const catFilters: { name: string; key: string; count: number }[] = [
    { name: 'All', key: 'all', count: commands.length },
    ...commandCategories.map((c) => ({ name: getCategoryLabel(c), key: c, count: commands.filter((cmd) => cmd.category === c).length })),
  ]

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Command History</h1><p className="text-sm text-slate-500 mt-1">Browse all executed commands and their results.</p></div>
        <Link href="/dashboard/command-center"><Button variant="outline">Back</Button></Link>
      </div>

      <div className="grid gap-4 mb-6">
        <form method="get" className="flex gap-3"><div className="flex-1"><Input name="query" placeholder="Search commands..." defaultValue={q} /></div><Button type="submit" variant="secondary">Search</Button></form>
        <div className="grid gap-4 md:grid-cols-2">
          <FilterBox title="Status" filters={statusFilters} activeKey={stat || 'all'} filterUrl={filterUrl} param="status" />
          <FilterBox title="Categories" filters={catFilters} activeKey={cat || 'all'} filterUrl={filterUrl} param="category" />
        </div>
      </div>

      {filteredByCat.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm"><p className="text-slate-500">No commands found.</p></div>
      ) : (
        <div className="space-y-3">
          {filteredByCat.map((cmd) => (
            <div key={cmd.id} className={`rounded-lg border p-4 ${cmd.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : cmd.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{cmd.command}</p>
                  {cmd.response && <p className="text-sm text-slate-500 mt-1">{cmd.response}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={getStatusVariant(cmd.status)}>{cmd.status}</Badge>
                    {cmd.category && <Badge variant="default">{getCategoryLabel(cmd.category)}</Badge>}
                    {cmd.execution_time_ms && <span className="text-xs text-slate-400">{cmd.execution_time_ms}ms</span>}
                  </div>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(cmd.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterBox({ title, filters, activeKey, filterUrl, param }: { title: string; filters: { name: string; key: string; count: number }[]; activeKey: string; filterUrl: (p: Record<string, string>) => string; param: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900 mb-3">{title}</p>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => { const active = activeKey === f.key; return <Link key={f.key} href={filterUrl({ [param]: f.key === 'all' ? '' : f.key })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{f.name} ({f.count})</Link> })}
      </div>
    </div>
  )
}