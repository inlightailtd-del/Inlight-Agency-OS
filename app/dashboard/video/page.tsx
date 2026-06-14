import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { getVideoMetrics, getVideoPipeline, runFullVideoCycle, createVideoCampaign, VIDEO_STAGES } from '@/lib/video/engine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function runVideoAction() {
  'use server'
  const supabase = await createClient()
  const { runFullVideoCycle, ensureVideoAgents } = await import('@/lib/video/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureVideoAgents(supabase, user.id)
  await runFullVideoCycle(supabase, user.id)
  revalidatePath('/dashboard/video')
  redirect('/dashboard/video')
}

async function createCampaignAction(fd: FormData) {
  'use server'
  const name = String(fd.get('name') || '')
  const desc = String(fd.get('description') || '')
  const goal = String(fd.get('goal') || '')
  const platforms = String(fd.get('platforms') || 'youtube,instagram,tiktok').split(',').map(s => s.trim()).filter(Boolean)
  const supabase = await createClient()
  const { createVideoCampaign, ensureVideoAgents } = await import('@/lib/video/engine')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  await ensureVideoAgents(supabase, user.id)
  await createVideoCampaign(supabase, user.id, name, desc, goal, platforms)
  revalidatePath('/dashboard/video')
  redirect('/dashboard/video')
}

const stageColors: Record<string, string> = {
  idea: 'bg-slate-100 border-slate-300', script: 'bg-blue-50 border-blue-300',
  voiceover: 'bg-amber-50 border-amber-300', assets: 'bg-orange-50 border-orange-300',
  editing: 'bg-purple-50 border-purple-300', thumbnail: 'bg-pink-50 border-pink-300',
  review: 'bg-indigo-50 border-indigo-300', scheduled: 'bg-cyan-50 border-cyan-300',
  published: 'bg-emerald-50 border-emerald-400',
}

export default async function VideoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  const [metrics, pipeline] = await Promise.all([
    getVideoMetrics(supabase, user.id),
    getVideoPipeline(supabase, user.id),
  ])

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Video Department</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous video production — idea to published across all platforms.</p>
        </div>
        <div className="flex gap-3">
          <details className="relative">
            <summary className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium cursor-pointer">+ Campaign</summary>
            <div className="absolute right-0 top-10 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-lg z-10">
              <form action={createCampaignAction} className="grid gap-3">
                <input name="name" placeholder="Campaign name" className="w-full rounded-lg border border-slate-200 p-2 text-sm" required />
                <input name="description" placeholder="Description" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                <input name="goal" placeholder="Goal" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                <input name="platforms" placeholder="Platforms (comma-separated)" defaultValue="youtube,instagram,tiktok" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">Create Campaign</Button>
              </form>
            </div>
          </details>
          <form action={runVideoAction}>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Run Video Cycle</Button>
          </form>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Videos" value={metrics.total} />
        <StatCard title="This Week" value={metrics.publishedThisWeek} color="text-emerald-600" />
        <StatCard title="This Month" value={metrics.publishedThisMonth} color="text-indigo-600" />
        <StatCard title="Active Campaigns" value={metrics.campaignsActive} color="text-purple-600" />
        <StatCard title="Avg Viral Score" value={metrics.avgViralScore} color={metrics.avgViralScore >= 50 ? 'text-rose-600' : 'text-slate-500'} />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Views" value={metrics.totalViews.toLocaleString()} color="text-sky-600" />
        <StatCard title="Total Likes" value={metrics.totalLikes.toLocaleString()} color="text-rose-600" />
        <StatCard title="Total Comments" value={metrics.totalComments.toLocaleString()} color="text-indigo-600" />
        <StatCard title="Total Shares" value={metrics.totalShares.toLocaleString()} color="text-emerald-600" />
      </div>

      {/* Video Team */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Video Team</h2>
        </div>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3 p-6">
          {['Director', 'Strategist', 'Reel Creator', 'Short Editor', 'Long Editor', 'Thumbnail', 'Script Writer', 'Voiceover', 'Distribution', 'Analytics'].map((name) => (
            <div key={name} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="font-medium text-[10px] text-slate-900 leading-tight">{name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="overflow-x-auto mb-6">
        <div className="grid grid-cols-9 gap-3 min-w-[1000px]">
          {VIDEO_STAGES.map((stage) => {
            const items = pipeline[stage] || []
            const bgColor = stageColors[stage] || 'bg-slate-50 border-slate-200'
            return (
              <div key={stage} className={`rounded-lg border ${bgColor} p-3`}>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">{stage} ({items.length})</p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {items.slice(0, 10).map((item: any) => (
                    <div key={item.id} className="rounded-md bg-white p-2 shadow-sm border border-slate-100">
                      <p className="text-xs font-medium text-slate-900 line-clamp-2">{item.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge className="text-[7px] px-1 py-0">{item.content_type || 'short'}</Badge>
                        {item.platform && <span className="text-[9px] text-slate-400">{item.platform}</span>}
                      </div>
                      {item.hook_text && <p className="text-[9px] text-slate-400 mt-1 line-clamp-1">Hook: {item.hook_text}</p>}
                      {item.assignee_name && <p className="text-[9px] text-slate-400 mt-1">{item.assignee_name}</p>}
                      {item.status === 'published' && (
                        <div className="flex gap-1 mt-1 text-[8px] text-slate-400">
                          <span>{item.views} views</span>
                          <span>{item.viral_score} viral</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length > 10 && <p className="text-xs text-slate-400 text-center">+{items.length - 10} more</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Viral Content Tracker */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Viral Content Tracker</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Video</th>
                <th className="text-left px-4 py-3">Platform</th>
                <th className="text-left px-4 py-3">Views</th>
                <th className="text-left px-4 py-3">Likes</th>
                <th className="text-left px-4 py-3">Comments</th>
                <th className="text-left px-4 py-3">Shares</th>
                <th className="text-left px-4 py-3">Viral Score</th>
                <th className="text-left px-4 py-3">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(pipeline.published || []).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No published videos yet.</td></tr>
              ) : (pipeline.published as any[]).slice(0, 15).map((video) => (
                <tr key={video.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900 text-xs">{video.title}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{video.platform || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{video.views?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{video.likes?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{video.comments?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{video.shares?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${(video.viral_score || 0) >= 70 ? 'bg-rose-100 text-rose-800' : (video.viral_score || 0) >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                      {video.viral_score || 0}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(video.published_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(metrics.byPlatform).map(([platform, count]) => (
          <div key={platform} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-900 capitalize">{platform}</p>
            <p className="text-2xl font-bold text-slate-700 mt-1">{count}</p>
            <p className="text-xs text-slate-400 mt-1">videos</p>
          </div>
        ))}
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
