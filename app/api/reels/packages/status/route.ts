import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: packages } = await supabase
      .from('reel_packages')
      .select('id, title, duration_seconds, hook, hook_type, hook_score, trend_keyword, status, predicted_performance, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: full } = await supabase
      .from('reel_packages')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)

    return NextResponse.json({
      packages: packages || [],
      latestPackage: full?.[0] || null,
      summary: {
        total: packages?.length || 0,
        draft: packages?.filter((p: any) => p.status === 'draft').length || 0,
        published: packages?.filter((p: any) => p.status === 'published').length || 0,
        avgScore: packages?.length ? Math.round(packages.reduce((s: number, p: any) => s + (p.hook_score || 0), 0) / packages.length) : 0,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
