import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueJob } from '@/lib/queue/queue'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const jobType = body.jobType || 'reels_full_cycle'
    const topic = body.topic

    const validTypes = [
      'reels_full_cycle', 'reels_trend_scan', 'reels_competitor_scan',
      'reels_generation', 'reels_video_render', 'reels_publish',
      'reels_analytics_sync', 'reels_strategy_update',
    ]

    if (!validTypes.includes(jobType)) {
      return NextResponse.json({ error: `Invalid job type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    const jobId = await enqueueJob(supabase, user.id, jobType, { topic }, {
      priority: body.priority ?? 0,
      scheduledAt: body.scheduledAt,
    })

    return NextResponse.json({ success: true, jobId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
