import { createClient } from '@/lib/supabase/server'
import { runEveningBriefing, getLatestBriefing, getBriefingStats } from '@/lib/ceo/briefings'
import { enqueueJob } from '@/lib/queue/queue'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const result = await runEveningBriefing(supabase, user.id)
  return Response.json({ success: true, briefing: result })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const [briefing, stats] = await Promise.all([
    getLatestBriefing(supabase, user.id, 'evening'),
    getBriefingStats(supabase, user.id),
  ])

  return Response.json({ briefing, stats })
}
