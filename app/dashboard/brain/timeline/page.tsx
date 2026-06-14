import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import {
  fetchKnowledgeDocs,
  getCategoryLabel,
  getStatusVariant,
} from '@/lib/supabase/brain'

export default async function BrainTimelinePage() {
  const supabase = await createClient()
  const docs = await fetchKnowledgeDocs(supabase)

  // Sort by created_at ascending for timeline
  const timelineDocs = [...docs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Calculate timeline range from created_at dates
  const allDates = timelineDocs.map((d) => d.created_at)
  let minDate: Date, maxDate: Date
  if (allDates.length > 0) {
    const sorted = allDates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime())
    minDate = new Date(sorted[0].getFullYear(), sorted[0].getMonth(), 1)
    maxDate = new Date(sorted[sorted.length - 1].getFullYear(), sorted[sorted.length - 1].getMonth() + 2, 0)
  } else {
    minDate = new Date()
    maxDate = new Date(new Date().setMonth(new Date().getMonth() + 6))
  }

  const months: { label: string; key: string }[] = []
  const cursor = new Date(minDate)
  while (cursor <= maxDate) {
    months.push({ label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), key: `bm-${cursor.getFullYear()}-${cursor.getMonth()}` })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))

  // Group by category for sections
  const categoryGroups: Record<string, typeof timelineDocs> = {}
  timelineDocs.forEach((d) => {
    const cat = d.category
    if (!categoryGroups[cat]) categoryGroups[cat] = []
    categoryGroups[cat].push(d)
  })

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Knowledge Timeline</h1>
          <p className="text-sm text-slate-500 mt-1">Chronological view of knowledge base growth across categories.</p>
        </div>
        <Link href="/dashboard/brain"><Button variant="outline">Back to Brain</Button></Link>
      </div>

      {timelineDocs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No documents to display. Create documents to see the timeline.</p>
        </div>
      ) : (
        <>
          {/* Timeline Chart */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm mb-8">
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${months.length * 80}px` }}>
                <div className="flex border-b border-slate-200 bg-slate-50">
                  <div className="w-48 shrink-0 px-4 py-3 text-sm font-medium text-slate-600 border-r border-slate-200">Category</div>
                  {months.map((m) => (
                    <div key={m.key} className="flex-1 px-2 py-3 text-center text-xs font-medium text-slate-500 border-r border-slate-100">{m.label}</div>
                  ))}
                </div>

                {Object.entries(categoryGroups).map(([cat, catDocs]) => (
                  <div key={cat} className="border-b border-slate-100">
                    <div className="flex bg-slate-50/50">
                      <div className="w-48 shrink-0 px-4 py-2 border-r border-slate-200"><span className="text-sm font-semibold text-slate-800">{getCategoryLabel(cat)}</span><span className="ml-2 text-xs text-slate-400">({catDocs.length})</span></div>
                      <div className="flex-1 relative py-2">
                        {(() => {
                          const todayOffset = (new Date().getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
                          const todayPercent = (todayOffset / totalDays) * 100
                          if (todayPercent >= 0 && todayPercent <= 100) {
                            return <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: `${todayPercent}%` }}><span className="absolute top-0 left-1 text-[10px] text-red-500 whitespace-nowrap">Today</span></div>
                          }
                          return null
                        })()}
                      </div>
                    </div>
                    {catDocs.map((doc) => {
                      const createdDate = new Date(doc.created_at)
                      const dayOffset = (createdDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
                      const positionPercent = (dayOffset / totalDays) * 100
                      return (
                        <div key={doc.id} className="flex hover:bg-slate-50 transition-colors">
                          <div className="w-48 shrink-0 px-4 py-3 border-r border-slate-200">
                            <Link href={`/dashboard/brain/${doc.id}`} className="text-sm font-medium text-slate-900 hover:text-slate-700 hover:underline line-clamp-1">{doc.title}</Link>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant={getStatusVariant(doc.status)}><span className="text-[10px]">{doc.status}</span></Badge>
                              <span className="text-[10px] text-slate-400">v{doc.version}</span>
                            </div>
                          </div>
                          <div className="flex-1 relative py-3 px-1">
                            <div className="absolute inset-0 flex">{months.map((m) => (<div key={m.key} className="flex-1 border-r border-slate-50" />))}</div>
                            <div className="absolute top-1/2 -translate-y-1/2 flex items-center" style={{ left: `${positionPercent}%` }}>
                              <div className="w-3 h-3 rounded-full bg-sky-500 border-2 border-sky-300" />
                              <span className="ml-1.5 text-xs text-slate-600 whitespace-nowrap">{formatDate(doc.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Growth Stats */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Document Growth by Month</h2>
              <div className="space-y-3">
                {(() => {
                  const monthlyCounts: Record<string, number> = {}
                  timelineDocs.forEach((d) => {
                    const month = d.created_at.substring(0, 7)
                    monthlyCounts[month] = (monthlyCounts[month] || 0) + 1
                  })
                  const sortedMonths = Object.keys(monthlyCounts).sort()
                  const maxCount = Math.max(...Object.values(monthlyCounts), 1)
                  return sortedMonths.map((month) => (
                    <div key={month}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{month}</span>
                        <span className="font-semibold text-slate-900">{monthlyCounts[month]}</span>
                      </div>
                      <div className="h-5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((monthlyCounts[month] / maxCount) * 100)}%` }} />
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Latest Documents</h2>
              <div className="space-y-3">
                {timelineDocs.slice(-5).reverse().map((doc) => (
                  <Link key={doc.id} href={`/dashboard/brain/${doc.id}`} className="flex items-start justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                    <div><p className="font-medium text-slate-900 text-sm">{doc.title}</p><div className="flex items-center gap-2 mt-1"><Badge variant="default">{getCategoryLabel(doc.category)}</Badge></div></div>
                    <span className="text-xs text-slate-400">{formatDate(doc.created_at)}</span>
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