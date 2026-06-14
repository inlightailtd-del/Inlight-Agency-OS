import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [trends, hooks, scripts, videos, analytics, config] = await Promise.all([
      supabase.from('reels_trends').select('id, keyword, score, velocity, momentum, source').eq('user_id', user.id).order('score', { ascending: false }).limit(10).then(r => r.data || []),
      supabase.from('reels_hooks').select('id, hook_text, hook_type, score, win_rate').eq('user_id', user.id).order('score', { ascending: false }).limit(10).then(r => r.data || []),
      supabase.from('reels_scripts').select('id, title, topic, duration_seconds, status, hook_score').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10).then(r => r.data || []),
      supabase.from('reels_videos').select('id, title, duration_seconds, status, platform_status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10).then(r => r.data || []),
      supabase.from('reels_analytics').select('id, platform, views, likes, comments, shares, engagement_rate, snapshot_date').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('reels_factory_config').select('*').eq('user_id', user.id).limit(1).then(r => r.data?.[0] || null),
    ])

    // Compute totals
    const totalViews = analytics.reduce((s: number, a: any) => s + (a.views || 0), 0)
    const totalEngagement = analytics.reduce((s: number, a: any) => s + (a.likes || 0) + (a.comments || 0) + (a.shares || 0), 0)

    return NextResponse.json({
      trends: { count: trends.length, items: trends },
      hooks: { count: hooks.length, items: hooks },
      scripts: { count: scripts.length, items: scripts },
      videos: { count: videos.length, items: videos },
      analytics: { count: analytics.length, items: analytics },
      config,
      summary: {
        totalTrends: trends.length,
        totalHooks: hooks.length,
        totalScripts: scripts.length,
        totalVideos: videos.length,
        totalAnalytics: analytics.length,
        totalViews,
        totalEngagement,
        publishedVideos: videos.filter((v: any) => v.status === 'published').length,
        readyVideos: videos.filter((v: any) => v.status === 'ready').length,
        renderingVideos: videos.filter((v: any) => v.status === 'rendering').length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
