import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: plans } = await supabase
      .from('development_memory')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['plan', 'pattern'])
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: lessons } = await supabase
      .from('development_memory')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['success_pattern', 'failure', 'fix'])
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ plans: plans || [], lessons: lessons || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
