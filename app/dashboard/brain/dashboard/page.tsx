import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  fetchKnowledgeDocs,
  knowledgeCategories,
  knowledgeDepartments,
  knowledgeStatuses,
  getCategoryLabel,
  getDepartmentLabel,
} from '@/lib/supabase/brain'

export default async function BrainDashboardPage() {
  const supabase = await createClient()
  const docs = await fetchKnowledgeDocs(supabase)

  const totalDocs = docs.length
  const publishedCount = docs.filter((d) => d.status === 'published').length
  const draftCount = docs.filter((d) => d.status === 'draft').length
  const archivedCount = docs.filter((d) => d.status === 'archived').length

  // Category distribution
  const catDist = knowledgeCategories.map((c) => ({
    name: getCategoryLabel(c), key: c,
    count: docs.filter((d) => d.category === c).length,
  }))

  // Department distribution
  const deptDist = knowledgeDepartments.map((d) => ({
    name: getDepartmentLabel(d), key: d,
    count: docs.filter((doc) => doc.department === d).length,
  }))

  // Recent docs
  const recentDocs = [...docs].sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()).slice(0, 8)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Company Brain Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of knowledge base health, category distribution, and recent activity.</p>
        </div>
        <Link href="/dashboard/brain"><Button variant="outline">Back to Brain</Button></Link>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No documents yet. Start building your knowledge base.</p>
          <Link href="/dashboard/brain/new" className="mt-4 inline-block"><Button variant="outline">Create document</Button></Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPI title="Total Documents" value={totalDocs} />
            <KPI title="Published" value={publishedCount} color="text-emerald-600" />
            <KPI title="Drafts" value={draftCount} color="text-amber-600" />
            <KPI title="Archived" value={archivedCount} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI title="SOPs" value={docs.filter((d) => d.category === 'sop').length} color="text-sky-600" />
            <KPI title="Wiki" value={docs.filter((d) => d.category === 'wiki').length} color="text-indigo-600" />
            <KPI title="Guides" value={docs.filter((d) => d.category === 'guide').length} color="text-purple-600" />
            <KPI title="Templates" value={docs.filter((d) => d.category === 'template').length} color="text-orange-600" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* Category Distribution */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Category Distribution</h2>
              <div className="space-y-4">
                {catDist.map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.name}</span>
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </div>
                    <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full bg-sky-500 transition-all duration-500`}
                        style={{ width: `${totalDocs > 0 ? Math.round((item.count / totalDocs) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Distribution */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Department Distribution</h2>
              <div className="space-y-4">
                {deptDist.filter((d) => d.count > 0).map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.name}</span>
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </div>
                    <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${totalDocs > 0 ? Math.round((item.count / totalDocs) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Document Status</h2>
              <div className="space-y-4">
                {knowledgeStatuses.map((status) => {
                  const count = docs.filter((d) => d.status === status).length
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        <span className="font-semibold text-slate-900">{count}</span>
                      </div>
                      <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${
                          status === 'published' ? 'bg-emerald-500' : status === 'draft' ? 'bg-amber-500' : 'bg-slate-400'
                        } transition-all duration-500`}
                          style={{ width: `${totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Updates</h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {recentDocs.map((doc) => (
                  <Link key={doc.id} href={`/dashboard/brain/${doc.id}`} className="flex items-start justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="default">{getCategoryLabel(doc.category)}</Badge>
                        <span className="text-xs text-slate-400">v{doc.version}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{formatDate(doc.updated_at ?? doc.created_at)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
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