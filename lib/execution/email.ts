import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationSDK } from '@/lib/integrations/sdk'

export interface EmailSendResult {
  sent: number
  failed: number
  errors: string[]
  recipients: string[]
}

/**
 * Send real outreach emails via Gmail (and Outlook fallback).
 * Reads uncontacted leads from growth_leads and sends personalized emails.
 */
export async function sendOutreachEmails(supabase: SupabaseClient, userId: string, limit = 5): Promise<EmailSendResult> {
  const sdk = new IntegrationSDK(supabase, userId)
  const errors: string[] = []
  const recipients: string[] = []
  let sent = 0
  let failed = 0

  // Check which email providers are connected
  const [gmailStatus, outlookStatus, resendStatus] = await Promise.all([
    sdk.getProviderStatus('gmail'),
    sdk.getProviderStatus('outlook'),
    sdk.getProviderStatus('resend'),
  ])
  const emailProvider = gmailStatus.connected ? 'gmail' : outlookStatus.connected ? 'outlook' : resendStatus.connected ? 'resend' : null
  if (!emailProvider) return { sent: 0, failed: 0, errors: ['No email provider connected'], recipients: [] }

  // Load uncontacted leads
  const { data: leads } = await supabase
    .from('growth_leads')
    .select('id, name, email, interest, score')
    .eq('user_id', userId)
    .eq('contacted', false)
    .not('email', 'is', null)
    .limit(limit)

  for (const lead of (leads ?? []) as any[]) {
    if (!lead.email) continue

    const subject = `AI solutions for ${lead.name?.split(' ')[0] || 'your business'}`
    const body = `Hi ${lead.name || 'there'},\n\nI noticed your interest in ${lead.interest || 'AI automation'}. At INLIGHT, we build autonomous AI systems that help businesses scale.\n\nWould you be open to a quick chat?\n\nBest,\nThe INLIGHT Team`

    try {
      const result = await sdk.executeAction(emailProvider as any, 'send_email', {
        to: lead.email,
        subject,
        body,
      })

      if (result.success) {
        await supabase.from('growth_leads').update({ contacted: true }).eq('id', lead.id)
        sent++
        recipients.push(lead.email)
      } else {
        failed++
        errors.push(`${lead.email}: ${result.error}`)
      }
    } catch (e: any) {
      failed++
      errors.push(`${lead.email}: ${e.message}`)
    }
  }

  return { sent, failed, errors, recipients }
}
