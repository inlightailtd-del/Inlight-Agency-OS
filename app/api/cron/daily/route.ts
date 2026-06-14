import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runDailyGrowthExecution } from '@/lib/execution'

/**
 * GET /api/cron/daily
 * 
 * Trigger the daily growth execution for all users.
 * Call from an external cron service (cron-job.org, Uptime Robot, etc.) every hour.
 * 
 * The execution is provider-aware — phases that depend on unconnected providers
 * (Gmail, LinkedIn) are skipped with clear log messages.
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  const results: { userId: string; status: string; phases: string; errors: number }[] = []

  try {
    // Auth check — use service role for cron access
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    
    // Get all active users
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .limit(50)

    if (!users || users.length === 0) {
      return NextResponse.json({
        message: 'No users found',
        durationMs: Date.now() - startTime,
        results: [],
      })
    }

    for (const user of users) {
      try {
        const result = await runDailyGrowthExecution(supabase, user.id)
        results.push({
          userId: user.id,
          status: result.errors.length > 0 ? 'completed_with_errors' : 'completed',
          phases: `${result.phaseStatus.content}/${result.phaseStatus.linkedin}/${result.phaseStatus.email}/${result.phaseStatus.leads}/${result.phaseStatus.report}`,
          errors: result.errors.filter(e => !e.includes('skipped')).length,
        })
      } catch (e: any) {
        results.push({
          userId: user.id,
          status: 'failed',
          phases: 'error',
          errors: 1,
        })
      }
    }

    return NextResponse.json({
      message: `Processed ${users.length} users`,
      durationMs: Date.now() - startTime,
      results,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, durationMs: Date.now() - startTime },
      { status: 500 }
    )
  }
}
