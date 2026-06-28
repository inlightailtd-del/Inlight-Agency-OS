import { createClient } from '@/lib/supabase/server'
import { runAutoBudgetSuggestions } from '@/lib/ceo/briefings'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const result = await runAutoBudgetSuggestions(supabase, user.id)
  return Response.json({ success: true, suggestions: result })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', user.id)
    .eq('category', 'ceo_budget_suggestions')
    .order('created_at', { ascending: false })
    .limit(1)

  return Response.json({ suggestions: (data as any[])?.[0]?.content?.suggestions ?? [] })
}
