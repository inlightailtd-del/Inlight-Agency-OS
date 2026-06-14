import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get the latest run with results
    const { data: runs } = await supabase
      .from('validation_runs')
      .select(`
        id, status, total_checks, passed_checks, warning_checks, failed_checks,
        duration_ms, started_at, completed_at,
        validation_results (
          id, slug, name, category, status, status_code, message, details, duration_ms, checked_at
        )
      `)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)

    if (!runs || runs.length === 0) {
      return NextResponse.json({ hasRun: false, latestRun: null })
    }

    return NextResponse.json({ hasRun: true, latestRun: runs[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
