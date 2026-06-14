import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get the latest completed run
    const { data: runs } = await supabase
      .from('validation_runs')
      .select('id, status, total_checks, passed_checks, warning_checks, failed_checks, duration_ms, started_at, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)

    if (!runs || runs.length === 0) {
      return NextResponse.json({ hasRun: false, run: null })
    }

    // Get all results for this run
    const { data: results } = await supabase
      .from('validation_results')
      .select('*')
      .eq('run_id', runs[0].id)
      .order('checked_at', { ascending: true })

    return NextResponse.json({
      hasRun: true,
      run: runs[0],
      results: results || [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
