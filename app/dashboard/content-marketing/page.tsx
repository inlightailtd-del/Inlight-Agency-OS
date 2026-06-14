import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getContentMetricsData, getContentPipeline, runFullContentCycle, planCampaign } from '@/lib/content-marketing/engine'
import { getContentTypeLabel, getPlatformLabel } from '@/lib/supabase/content'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function runContentAction() {
  'use server'
  const supabase = await createClient()
  const { runFullContentCycle, ensureContentAgents } = await import('@/lib/content-marketing/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureContentAgents(supabase, user.id)
  await runFullContentCycle(supabase, user.id)
  revalidatePath('/dashboard/content-marketing')
  redirect('/dashboard/content-marketing')
}

async function createCampaignAction(fd: FormData) {
  'use server'
  const name = String(fd.get('name') || '')
  const desc = String(fd.get('description') || '')
  const goal = String(fd.get('goal') || '')
  const supabase = await createClient()
  const { planCampaign, ensureContentAgents } = await import('@/lib/content-marketing/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureContentAgents(supabase, user.id)
  await planCampaign(supabase, user.id, name, desc, goal)
  revalidatePath('/dashboard/content-marketing')
  redirect('/dashboard/content-marketing')
}

const stageOrder = ['idea', 'planned', 'draft', 'approved', 'generated', 'scheduled', 'published']
const stageColors: Record<string, string> = {
  idea: 'bg-slate-100 border-slate-300', planned: 'bg-blue-50 border-blue-300',
  draft: 'bg-amber-50 border-amber-300', approved: 'bg-indigo-50 border-indigo-300',
  generated: 'bg-green-50 border-green-300', scheduled: 'bg-purple-50 border-purple-300',
  published: 'bg-emerald-50 border-emerald-400',
}

export default async function ContentMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [metrics, pipeline] = await Promise.all([
    getContentMetricsData(supabase, user.id),
    getContentPipeline(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Content Marketing</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous content department — ideas to published across all platforms.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/content"><Button variant="outline">Content Engine</Button></Link>
          <form action={runContentAction}>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Run Content Cycle</Button>
          </form>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Content" value={metrics.total} />
        <StatCard title="This Week" value={metrics.postsThisWeek} color="text-emerald-600" />
        <StatCard title="This Month" value={metrics.postsThisMonth} color="text-indigo-600" />
        <StatCard title="Active Campaigns" value={metrics.campaignsActive} color="text-purple-600" />
        <StatCard title="Engagement" value={metrics.totalEngagement.toLocaleString()} color="text-cyan-600" />
      </div>

      {/* Content Agents */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Content Team</h2>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-9 gap-3 p-6">
          {[
            'Marketing Director', 'Content Strategist', 'Copywriter', 'Blog Writer',
            'SEO Specialist', 'Reel Script Writer', 'Carousel Creator', 'Social Media Manager', 'Analytics',
          ].map((name) => (
            <div key={name} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="font-medium text-[11px] text-slate-900">{name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="grid grid-cols-7 gap-3 mb-6 min-h-[400px]">
        {stageOrder.map((stage) => {
          const items = pipeline[stage as keyof typeof pipeline] || []
          const bgColor = stageColors[stage] || 'bg-slate-50 border-slate-200'
          return (
            <div key={stage} className={`rounded-lg border ${bgColor} p-3`}>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">{stage} ({items.length})</p>
              <div className="space-y-2">
                {items.slice(0, 8).map((item: any) => (
                  <div key={item.id} className="rounded-md bg-white p-2 shadow-sm border border-slate-100">
                    <p className="text-xs font-medium text-slate-900 line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge className="text-[7px] px-1 py-0">{getContentTypeLabel(item.content_type)}</Badge>
                      {item.platform && <span className="text-[9px] text-slate-400">{getPlatformLabel(item.platform)}</span>}
                    </div>
                    {item.assignee_name && <p className="text-[9px] text-slate-400 mt-1">{item.assignee_name}</p>}
                  </div>
                ))}
                {items.length > 8 && <p className="text-xs text-slate-400 text-center">+{items.length - 8} more</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Campaigns */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Campaigns</h2>
          <details className="relative">
            <summary className="text-sm text-indigo-600 cursor-pointer">+ New Campaign</summary>
            <div className="absolute right-0 top-8 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-lg z-10">
              <form action={createCampaignAction} className="grid gap-3">
                <div><input name="name" placeholder="Campaign name" className="w-full rounded-lg border border-slate-200 p-2 text-sm" required /></div>
                <div><input name="description" placeholder="Description" className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                <div><input name="goal" placeholder="Goal (e.g., Q2 brand awareness)" className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">Create Campaign</Button>
              </form>
            </div>
          </details>
        </div>
      </div>

      {/* Content by Type Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Content By Type</h2>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(metrics.byType).map(([type, count]) => (
            <div key={type} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">{getContentTypeLabel(type)}</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
