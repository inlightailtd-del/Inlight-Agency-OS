import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  fetchKnowledgeDocs,
  knowledgeCategories,
  knowledgeDepartments,
  knowledgeStatuses,
  getCategoryLabel,
  getDepartmentLabel,
  getStatusVariant,
} from '@/lib/supabase/brain'

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

export default async function BrainPage({ searchParams }: { searchParams?: { query?: string | string[]; category?: string | string[]; department?: string | string[]; status?: string | string[] } }) {
  const q = G(searchParams?.query)
  const cat = G(searchParams?.category)
  const dept = G(searchParams?.department)
  const stat = G(searchParams?.status)
  const supabase = await createClient()
  const docs = await fetchKnowledgeDocs(supabase, q, cat, dept, stat)

  const filterUrl = (params: Record<string, string>) => {
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v) })
    const all = { query: q, category: cat, department: dept, status: stat, ...params }
    Object.entries(all).forEach(([k, v]) => { if (v) sp.set(k, v) })
    return `/dashboard/brain?${sp.toString()}`
  }

  const totalDocs = docs.length
  const publishedCount = docs.filter((d) => d.status === 'published').length
  const draftCount = docs.filter((d) => d.status === 'draft').length
  const byCategory = knowledgeCategories.map((c) => ({ name: getCategoryLabel(c), key: c, count: docs.filter((d) => d.category === c).length }))
  const byDepartment = knowledgeDepartments.map((d) => ({ name: getDepartmentLabel(d), key: d, count: docs.filter((doc) => doc.department === d).length }))

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Company Brain</h1>
          <p className="text-sm text-slate-500 mt-1">Central knowledge repository for SOPs, wiki, policies, guides, and templates.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/brain/dashboard"><Button variant="outline">Analytics</Button></Link>
          <Link href="/dashboard/brain/timeline"><Button variant="outline">Timeline</Button></Link>
          <Link href="/dashboard/brain/new"><Button>New Document</Button></Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Documents" value={totalDocs} />
        <KPI title="Published" value={publishedCount} color="text-emerald-600" />
        <KPI title="Drafts" value={draftCount} color="text-amber-600" />
        <KPI title="Archived" value={docs.filter((d) => d.status === 'archived').length} />
      </div>

      {/* Search + Filters */}
      <div className="grid gap-4 mb-6">
        <form method="get" className="flex gap-3">
          <div className="flex-1"><Input name="query" placeholder="Search by title or content..." defaultValue={q} /></div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900 mb-3">Categories</p>
            <div className="flex flex-wrap gap-2">
              {[{ name: 'All', key: 'all' }, ...byCategory.map((c) => ({ name: `${c.name} (${c.count})`, key: c.key }))].map((item) => {
                const active = (cat || 'all') === item.key
                return <Link key={item.key} href={filterUrl({ category: item.key === 'all' ? '' : item.key })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{item.name}</Link>
              })}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900 mb-3">Departments</p>
            <div className="flex flex-wrap gap-2">
              {[{ name: 'All', key: 'all' }, ...byDepartment.map((d) => ({ name: `${d.name} (${d.count})`, key: d.key }))].map((item) => {
                const active = (dept || 'all') === item.key
                return <Link key={item.key} href={filterUrl({ department: item.key === 'all' ? '' : item.key })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{item.name}</Link>
              })}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900 mb-3">Status</p>
            <div className="flex flex-wrap gap-2">
              {['all', ...knowledgeStatuses].map((s) => {
                const active = (stat || 'all') === s
                const label = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
                const count = s === 'all' ? docs.length : docs.filter((d) => d.status === s).length
                return <Link key={s} href={filterUrl({ status: s === 'all' ? '' : s })} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{label} ({count})</Link>
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Docs Grid */}
      {docs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No documents found. Start building your company knowledge base.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <Link key={doc.id} href={`/dashboard/brain/${doc.id}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-2 mb-3">
                <Badge variant={getStatusVariant(doc.status)}>{doc.status}</Badge>
                <span className="text-xs text-slate-400">v{doc.version}</span>
              </div>
              <h3 className="font-semibold text-slate-900 line-clamp-2 mb-2">{doc.title}</h3>
              {doc.content && <p className="text-sm text-slate-500 line-clamp-3 mb-3">{doc.content}</p>}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <Badge variant="default">{getCategoryLabel(doc.category)}</Badge>
                {doc.department && <Badge variant="default">{getDepartmentLabel(doc.department)}</Badge>}
                {doc.tags && doc.tags.length > 0 && doc.tags.map((t) => <span key={t} className="text-slate-400">#{t}</span>)}
              </div>
              <p className="text-xs text-slate-400 mt-3">Updated {formatDate(doc.updated_at ?? doc.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}