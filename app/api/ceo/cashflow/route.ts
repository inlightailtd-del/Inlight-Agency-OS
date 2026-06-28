import { createClient } from '@/lib/supabase/server'
import { runCashflowPrediction } from '@/lib/ceo/briefings'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const result = await runCashflowPrediction(supabase, user.id, body.months || 6)
  return Response.json({ success: true, prediction: result })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', user.id)
    .eq('category', 'ceo_cashflow_prediction')
    .order('created_at', { ascending: false })
    .limit(5)

  return Response.json({ predictions: data ?? [] })
}
