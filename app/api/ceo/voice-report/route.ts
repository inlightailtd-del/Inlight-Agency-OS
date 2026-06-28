import { createClient } from '@/lib/supabase/server'
import { generateVoiceReport, getLatestVoiceReport, getVoiceReportStats } from '@/lib/ceo/voice-reports'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const reportType = body.report_type || 'daily_brief'
  const result = await generateVoiceReport(supabase, user.id, reportType)
  return Response.json({ success: true, report: result })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const [report, stats] = await Promise.all([
    getLatestVoiceReport(supabase, user.id),
    getVoiceReportStats(supabase, user.id),
  ])

  return Response.json({ report, stats })
}
