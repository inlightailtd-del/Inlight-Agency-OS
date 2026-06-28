import { createClient } from '@/lib/supabase/server'
import { runMeetingSimulation, getLatestMeetingSimulation, getMeetingStats } from '@/lib/ceo/meeting-simulator'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const meetingType = body.meeting_type || 'board'
  const result = await runMeetingSimulation(supabase, user.id, meetingType)
  return Response.json({ success: true, simulation: result })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const [simulation, stats] = await Promise.all([
    getLatestMeetingSimulation(supabase, user.id),
    getMeetingStats(supabase, user.id),
  ])

  return Response.json({ simulation, stats })
}
