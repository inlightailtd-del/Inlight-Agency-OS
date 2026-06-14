import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [ideas, calendar, analytics, weeklyPlan] = await Promise.all([
      supabase.from('content_factory_ideas').select('id, title, content_type, platform, status, score, source, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('content_factory_calendar').select('id, week_start, day_of_week, platform, content_type, title, status').eq('user_id', user.id).order('week_start', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('content_factory_analytics').select('id, platform, views, likes, engagement_rate, snapshot_date').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('content_factory_weekly_plans').select('*').eq('user_id', user.id).order('week_start', { ascending: false }).limit(1).then(r => r.data?.[0] || null),
    ])

    const totalViews = analytics.reduce((s: number, a: any) => s + (a.views || 0), 0)
    const totalEngagement = analytics.reduce((s: number, a: any) => s + (a.likes || 0), 0)

    return NextResponse.json({
      ideas: { total: ideas.length, items: ideas },
      calendar: { total: calendar.length, items: calendar },
      analytics: { total: analytics.length, items: analytics },
      weeklyPlan,
      summary: {
        totalIdeas: ideas.length,
        publishedIdeas: ideas.filter((i: any) => i.status === 'published').length,
        draftIdeas: ideas.filter((i: any) => i.status === 'draft').length,
        scheduledPosts: calendar.filter((c: any) => c.status === 'scheduled').length,
        totalViews,
        totalEngagement,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
