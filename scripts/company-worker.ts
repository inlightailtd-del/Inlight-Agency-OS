import { createClient } from '@supabase/supabase-js'
import { AutonomousCompany } from '@/lib/company/orchestrator'
import { NightShiftDaemon } from '@/lib/night-shift/daemon'
import type { DaemonConfig } from '@/lib/night-shift/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const USER_ID = process.env.COMPANY_USER_ID || ''

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !USER_ID) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COMPANY_USER_ID')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const config: Partial<DaemonConfig> = {
    loopIntervalMs: parseInt(process.env.COMPANY_LOOP_INTERVAL_MS || '3600000', 10),
    healthCheckIntervalMs: 300000,
    maxConsecutiveErrors: 5,
    autoRollbackEnabled: true,
  }

  const daemon = new NightShiftDaemon(supabase, USER_ID, config)
  const company = new AutonomousCompany(supabase, USER_ID)

  company.onPendingApproval(async (items) => {
    console.log(`[APPROVAL] ${items.length} items pending approval:`)
    for (const item of items) {
      console.log(`  - [${item.impact}] ${item.agent}: ${item.description}`)
    }
  })

  daemon.onLoop(async () => {
    const state = company.getState()
    if (state.status !== 'running') return

    console.log(`[Company] Starting cycle ${state.totalCycles + 1}...`)
    const startTime = Date.now()

    const result = await company.runFullCycle()

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    const completed = result.phases.filter(p => p.status === 'completed').length
    const failed = result.phases.filter(p => p.status === 'failed').length

    console.log(`[Company] Cycle ${state.totalCycles} complete: ${completed} ok, ${failed} fail, ${result.pendingApprovals.length} approvals needed (${duration}s)`)

    if (result.errors.length > 0) {
      console.log(`[Company] Errors: ${result.errors.slice(0, 5).join('; ')}`)
    }

    if (state.totalCycles % 6 === 0) {
      console.log('[Company] Generating daily report...')
      const report = await company.generateReport()
      console.log(`[Company] Report: ${report.ceoSummary.slice(0, 200)}`)
    }
  })

  await company.start()
  await daemon.start()

  console.log(`[Company] Autonomous company running 24/7 (interval: ${config.loopIntervalMs}ms)`)
  console.log(`[Company] Monitoring approvals via company.onPendingApproval callback`)
  console.log(`[Company] Press Ctrl+C to stop`)

  process.on('SIGINT', async () => {
    console.log('\n[Company] Shutting down...')
    await daemon.stop()
    await company.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n[Company] Shutting down...')
    await daemon.stop()
    await company.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[Company] Fatal error:', err)
  process.exit(1)
})
