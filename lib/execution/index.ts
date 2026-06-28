import type { SupabaseClient } from '@supabase/supabase-js'
import { generateDailyContent, generateLeads } from '@/lib/growth/engine'
import { publishApprovedContent } from './social'
import { sendOutreachEmails } from './email'
import { trackDailyKPIs } from './kpi'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { IntegrationSDK } from '@/lib/integrations/sdk'

export interface DailyExecutionResult {
  contentGenerated: number
  linkedinPublished: number
  facebookPublished: number
  instagramPublished: number
  xPublished: number
  youtubePublished: number
  emailsSent: number
  emailsFailed: number
  leadsGenerated: number
  leadsContactedTotal: number
  meetingsBooked: number
  errors: string[]
  reportSummary: string
  phaseStatus: {
    content: 'skipped' | 'ran'
    linkedin: 'skipped' | 'ran'
    email: 'skipped' | 'ran'
    leads: 'skipped' | 'ran'
    kpi: 'skipped' | 'ran'
    report: 'skipped' | 'ran'
  }
}

/**
 * runDailyGrowthExecution — the single entry point for production execution.
 * Provider-aware: checks connection status before running each phase.
 *
 * Flow:
 *  1. Generate content with Brand Manager AI (runs regardless)
 *  2. Publish to LinkedIn (only if OAuth connected)
 *  3. Send outreach emails via Gmail (only if OAuth connected)
 *  4. Generate leads via AI
 *  5. Track real KPIs from the database
 *  6. Generate CEO daily report
 */
export async function runDailyGrowthExecution(supabase: SupabaseClient, userId: string): Promise<DailyExecutionResult> {
  const errors: string[] = []
  const phaseStatus: {
    content: 'skipped' | 'ran'
    linkedin: 'skipped' | 'ran'
    email: 'skipped' | 'ran'
    leads: 'skipped' | 'ran'
    kpi: 'skipped' | 'ran'
    report: 'skipped' | 'ran'
  } = {
    content: 'skipped',
    linkedin: 'skipped',
    email: 'skipped',
    leads: 'skipped',
    kpi: 'ran',
    report: 'skipped',
  }

  // Check provider connections upfront
  const sdk = new IntegrationSDK(supabase, userId)
  const [gmailConnected, linkedinConnected, facebookConnected, instagramConnected] = await Promise.all([
    sdk.getProviderStatus('gmail').then(s => s.connected).catch(() => false),
    sdk.getProviderStatus('linkedin').then(s => s.connected).catch(() => false),
    sdk.getProviderStatus('facebook').then(s => s.connected).catch(() => false),
    sdk.getProviderStatus('instagram').then(s => s.connected).catch(() => false),
  ])

  // ── Phase 1: Content Generation (always runs) ───────
  let contentGenerated = 0
  try {
    contentGenerated = await generateDailyContent(supabase, userId)
    phaseStatus.content = 'ran'
  } catch (e: any) {
    errors.push(`Content generation: ${e.message}`)
  }

  // ── Phase 2: Social Publishing (if any social provider connected) ─
  let linkedinPublished = 0
  let facebookPublished = 0
  let instagramPublished = 0
  let xPublished = 0
  let youtubePublished = 0
  if (linkedinConnected || facebookConnected || instagramConnected) {
    try {
      const pubResult = await publishApprovedContent(supabase, userId)
      linkedinPublished = pubResult.linkedin
      facebookPublished = pubResult.facebook
      instagramPublished = pubResult.instagram
      xPublished = pubResult.x
      youtubePublished = pubResult.youtube
      errors.push(...pubResult.errors.map((e: string) => `Publishing: ${e}`))
      phaseStatus.linkedin = 'ran'
    } catch (e: any) {
      errors.push(`Publishing: ${e.message}`)
    }
  } else {
    errors.push('Publishing: no social providers connected — skipped')
  }

  // ── Phase 3: Email Outreach (only if Gmail connected) ─
  let emailsSent = 0
  let emailsFailed = 0
  if (gmailConnected) {
    try {
      const emailResult = await sendOutreachEmails(supabase, userId, 5)
      emailsSent = emailResult.sent
      emailsFailed = emailResult.failed
      errors.push(...emailResult.errors.map((e: string) => `Email: ${e}`))
      phaseStatus.email = 'ran'
    } catch (e: any) {
      errors.push(`Email outreach: ${e.message}`)
    }
  } else {
    errors.push('Email: Gmail not connected — skipped')
  }

  // ── Phase 4: Lead Generation (always runs) ─────────
  let leadsGenerated = 0
  try {
    leadsGenerated = await generateLeads(supabase, userId)
    phaseStatus.leads = 'ran'
  } catch (e: any) {
    errors.push(`Lead generation: ${e.message}`)
  }

  // ── Phase 5: Real KPIs ─────────────────────────────
  let meetingsBooked = 0
  let leadsContactedTotal = 0
  let kpiData: Awaited<ReturnType<typeof trackDailyKPIs>> | null = null
  try {
    kpiData = await trackDailyKPIs(supabase, userId)
    meetingsBooked = kpiData.meetingsBooked
    leadsContactedTotal = kpiData.leadsContacted
  } catch (e: any) {
    errors.push(`KPI tracking: ${e.message}`)
  }

  // ── Phase 6: CEO Daily Report ──────────────────────
  let reportSummary = ''
  try {
    const systemPrompt = 'You are the CEO of INLIGHT AI Agency OS. Write a concise daily executive report.'
    const data = kpiData ?? await trackDailyKPIs(supabase, userId)
    const result = await executeAgentTask(supabase, userId, null,
      `Today's production metrics:
- Posts published: ${data.postsPublished} (LinkedIn: ${data.linkedinPosts})
- Emails sent: ${data.emailsSent}
- Leads generated: ${data.leadsGenerated}
- Leads contacted: ${data.leadsContacted}
- Meetings booked: ${data.meetingsBooked}
- LinkedIn connected: ${linkedinConnected}
- Gmail connected: ${gmailConnected}
${errors.length > 0 ? `\nErrors encountered: ${errors.slice(0, 5).join('; ')}` : ''}

Write a brief executive report with key highlights and recommended next actions.`,
      { systemPrompt }
    )
    reportSummary = result.response || 'Report generated.'
    phaseStatus.report = 'ran'

    await storeMemory(supabase, userId, {
      category: 'ceo_brief', tags: ['daily_report', data.date],
      content: { type: 'production_daily_report', date: data.date, kpi: data, report: reportSummary, errors: errors.slice(0, 10), generatedAt: new Date().toISOString() },
    })
  } catch (e: any) {
    errors.push(`CEO report: ${e.message}`)
  }

  // Log with provider-aware context
  const totalPublished = linkedinPublished + facebookPublished + instagramPublished + xPublished + youtubePublished
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Production] Daily execution completed', module: 'growth',
    status: errors.filter(e => !e.includes('skipped')).length > 0 ? 'failed' : 'success',
    message: `Content: ${contentGenerated}, LinkedIn: ${linkedinPublished}${linkedinConnected ? '' : ' (not connected)'}, Emails: ${emailsSent}${gmailConnected ? '' : ' (not connected)'}, Leads: ${leadsGenerated}`,
  }])

  return {
    contentGenerated, linkedinPublished, facebookPublished, instagramPublished, xPublished, youtubePublished,
    emailsSent, emailsFailed, leadsGenerated, leadsContactedTotal, meetingsBooked, errors, reportSummary,
    phaseStatus,
  }
}
