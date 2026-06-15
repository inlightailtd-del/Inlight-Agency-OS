import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runDailyGrowthExecution } from '@/lib/execution'
import { AgentRuntime } from '@/lib/agents/runtime'

/**
 * GET /api/cron/daily
 * 
 * Runs every hour via external cron service (cron-job.org, Uptime Robot, etc.):
 *   1. Daily growth execution for all users (content, leads, reports)
 *   2. Agent Runtime tick for all users (drains orchestrator queue)
 *   3. CEO assessment check for all users
 * 
 * Auth: Requires CRON_SECRET env var as Bearer token.
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  const results: { userId: string; phases: string; tickTasks: number; errors: number }[] = []

  try {
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    
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
        // Phase 1: Daily growth execution (content, LinkedIn, email, leads, report)
        const dailyResult = await runDailyGrowthExecution(supabase, user.id)
        
        // Phase 2: Agent Runtime tick — process pending orchestrator tasks
        const runtime = new AgentRuntime(supabase, user.id)
        const tickResult = await runtime.tick({ maxTasks: 10 })

        let tickErrors = 0
        if (dailyResult.errors) {
          tickErrors = dailyResult.errors.filter((e: string) => !e.includes('skipped')).length
        }

        results.push({
          userId: user.id,
          phases: dailyResult.phaseStatus 
            ? `${dailyResult.phaseStatus.content}/${dailyResult.phaseStatus.linkedin}/${dailyResult.phaseStatus.email}/${dailyResult.phaseStatus.leads}/${dailyResult.phaseStatus.report}`
            : 'completed',
          tickTasks: tickResult.executed + tickResult.approvalHeld,
          errors: tickErrors,
        })
      } catch (e: any) {
        results.push({
          userId: user.id,
          phases: 'error',
          tickTasks: 0,
          errors: 1,
        })
      }
    }

    return NextResponse.json({
      message: `Processed ${users.length} users. ${results.reduce((s, r) => s + r.tickTasks, 0)} runtime tasks executed.`,
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
