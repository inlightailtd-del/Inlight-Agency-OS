import { createClient } from '@/lib/supabase/server'
import { runMorningBriefing, getLatestBriefing, getBriefingStats } from '@/lib/ceo/briefings'
import { enqueueJob } from '@/lib/queue/queue'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const runNow = true
  if (runNow) {
    const result = await runMorningBriefing(supabase, user.id)
    return Response.json({ success: true, briefing: result })
  }

  const jobId = await enqueueJob(supabase, user.id, 'ceo_morning_briefing', {}, { priority: 10 })
  return Response.json({ success: true, jobId })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const [briefing, stats] = await Promise.all([
    getLatestBriefing(supabase, user.id, 'morning'),
    getBriefingStats(supabase, user.id),
  ])

  return Response.json({ briefing, stats })
}
