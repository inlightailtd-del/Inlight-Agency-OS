import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getMediaBuyerMetrics, getAdCampaigns, runFullMediaBuyingCycle, ensureMediaBuyerAgents } from '@/lib/media-buying/engine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function runMediaBuyerAction() {
  'use server'
  const supabase = await createClient()
  const { runFullMediaBuyingCycle, ensureMediaBuyerAgents } = await import('@/lib/media-buying/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureMediaBuyerAgents(supabase, user.id)
  await runFullMediaBuyingCycle(supabase, user.id)
  revalidatePath('/dashboard/media-buying')
  redirect('/dashboard/media-buying')
}

const platformColors: Record<string, string> = {
  facebook: 'bg-blue-100 text-blue-800', google: 'bg-green-100 text-green-800',
  linkedin: 'bg-sky-100 text-sky-800', tiktok: 'bg-purple-100 text-purple-800',
}

const statusColors: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-800', active: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800', completed: 'bg-indigo-100 text-indigo-800',
  archived: 'bg-rose-100 text-rose-800',
}

export default async function MediaBuyerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  await ensureMediaBuyerAgents(supabase, user.id)

  const [metrics, campaigns] = await Promise.all([
    getMediaBuyerMetrics(supabase, user.id),
    getAdCampaigns(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Media Buyer</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous paid media — campaigns, creatives, retargeting, and ROAS optimization.</p>
        </div>
        <form action={runMediaBuyerAction}>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Media Buyer Cycle</Button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Campaigns" value={metrics.totalCampaigns} />
        <StatCard title="Active" value={metrics.activeCampaigns} color="text-emerald-600" />
        <StatCard title="Total Spend" value={`$${metrics.totalSpend.toLocaleString()}`} color="text-amber-600" />
        <StatCard title="Total Conversions" value={metrics.totalConversions.toLocaleString()} color="text-indigo-600" />
        <StatCard title="Avg ROAS" value={`${metrics.avgRoas}x`} color={metrics.avgRoas >= 3 ? 'text-emerald-600' : metrics.avgRoas >= 1.5 ? 'text-amber-600' : 'text-rose-600'} />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Impressions" value={metrics.totalImpressions.toLocaleString()} color="text-sky-600" />
        <StatCard title="Clicks" value={metrics.totalClicks.toLocaleString()} color="text-blue-600" />
        <StatCard title="CTR" value={`${metrics.avgCtr}%`} color="text-indigo-600" />
        <StatCard title="CPA" value={`$${metrics.avgCpa.toFixed(2)}`} color={metrics.avgCpa <= 50 ? 'text-emerald-600' : metrics.avgCpa <= 100 ? 'text-amber-600' : 'text-rose-600'} />
      </div>

      {/* Platform Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(metrics.campaignsByPlatform).map(([platform, count]) => (
          <div key={platform} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-900 capitalize">{platform} Ads</p>
            <p className="text-2xl font-bold text-slate-700 mt-1">{count}</p>
            <p className="text-xs text-slate-400 mt-1">campaigns</p>
          </div>
        ))}
      </div>

      {/* Media Buyer Agents */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Media Buyer Team</h2>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3 p-6">
          {[
            { name: 'Media Director', role: 'Strategy & Budget' },
            { name: 'Facebook Ads', role: 'Meta Platforms' },
            { name: 'Google Ads', role: 'Search & Display' },
            { name: 'LinkedIn Ads', role: 'B2B Targeting' },
            { name: 'TikTok Ads', role: 'Viral Creative' },
            { name: 'Copywriter', role: 'A/B Testing' },
            { name: 'Analyst', role: 'ROAS & CPA' },
          ].map((agent) => (
            <div key={agent.name} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="font-medium text-xs text-slate-900 leading-tight">{agent.name}</p>
              <p className="text-[10px] text-slate-500 mt-1">{agent.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* A/B Creative Testing Summary */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Creative Variants</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.creativeVariants}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">A/B Tests Running</p>
            <p className="text-2xl font-bold text-indigo-600">{metrics.abTestsRunning}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Avg CPC</p>
            <p className="text-2xl font-bold text-slate-900">${metrics.avgCpc.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Ad Campaigns ({campaigns.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Campaign</th>
                <th className="text-left px-4 py-3">Platform</th>
                <th className="text-left px-4 py-3">Goal</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Daily Budget</th>
                <th className="text-left px-4 py-3">Spend</th>
                <th className="text-left px-4 py-3">Conversions</th>
                <th className="text-left px-4 py-3">ROAS</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {campaigns.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No campaigns yet. Run a Media Buyer cycle to start.</td></tr>
              ) : campaigns.map((c: any) => {
                const perf = c.performance || {}
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900 text-xs">{c.name}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] ${platformColors[c.platform] || 'bg-slate-100'}`}>{c.platform}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{c.goal?.replace(/_/g, ' ') || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] ${statusColors[c.status] || 'bg-slate-100'}`}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">${c.daily_budget?.toFixed(0) || 0}/day</td>
                    <td className="px-4 py-3 text-xs text-slate-700">${(perf.spend || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{perf.conversions || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs ${(c.roas || 0) >= 3 ? 'text-emerald-600' : (c.roas || 0) >= 1.5 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {(c.roas || 0).toFixed(1)}x
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(c.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
