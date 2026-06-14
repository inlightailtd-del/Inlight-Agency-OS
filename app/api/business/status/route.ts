import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: logs } = await supabase
      .from('execution_logs')
      .select('id, action, status, message, created_at')
      .filter('action', 'ilike', '%BusinessGrowth%')
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: offers } = await supabase
      .from('agent_memory')
      .select('content, created_at')
      .filter('category', 'ilike', 'business_offers')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: opportunities } = await supabase
      .from('agent_memory')
      .select('content, created_at')
      .filter('category', 'ilike', 'business_opportunities')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({ logs: logs || [], offers: offers || [], opportunities: opportunities || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
