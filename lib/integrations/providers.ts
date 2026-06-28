import { BaseProvider } from './provider'
import type { ActionResponse, SyncResult } from './types'
import { FacebookProvider, InstagramProvider, XProvider, YouTubeProvider, OutlookProvider, ClayProvider } from './social-providers'
import { RunwayProvider, VeoProvider, PikaProvider, KlingProvider } from './video-providers'
import { ElevenLabsProvider, WhisperProvider } from './voice-providers'
import { WhatsAppProvider } from './whatsapp-provider'
import { FacebookAdsProvider, GoogleAdsProvider, LinkedInAdsProvider, TikTokAdsProvider } from './ad-providers'
import { FigmaProvider, CanvaProvider } from './design-providers'
import { GitHubProvider, GitLabProvider } from './git-providers'
import { VercelProvider, CloudflareProvider } from './deploy-providers'
import {
  StripeProvider, PaddleProvider, ResendProvider, HubSpotProvider, CalendlyProvider,
  SalesforceProvider, SlackProvider, DiscordProvider,
  TelegramProvider, AirtableProvider, N8nProvider, MakeProvider,
} from './automation-providers'

// ─── Twilio ──────────────────────────────────────────────
export class TwilioProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'make_call': return { callSid: 'CA' + Date.now(), status: 'queued', to: params.to, duration: params.duration }
      case 'send_sms': return { messageSid: 'SM' + Date.now(), status: 'sent', to: params.to }
      case 'get_call_status': return { callSid: params.callSid, status: 'completed' }
      default: throw new Error(`Twilio: unknown action ${action}`)
    }
  }
}

// ─── LinkedIn (Real API) ──────────────────────────────────
export class LinkedInProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    if (action !== 'create_post') throw new Error(`LinkedIn: unknown action ${action}`)

    const token = this.credentials?.access_token
    if (!token) throw new Error('LinkedIn: no access_token in credentials')

    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!meRes.ok) throw new Error(`LinkedIn /userinfo failed: ${meRes.status} ${await meRes.text()}`)
    const me = await meRes.json()
    const authorUrn = `urn:li:person:${me.sub}`

    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: params.content || params.text || '' },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }

    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!postRes.ok) {
      const errText = await postRes.text()
      throw new Error(`LinkedIn post failed: ${postRes.status} ${errText}`)
    }

    const postResult = await postRes.json()
    return { postId: postResult.id || `li_${Date.now()}`, status: 'published', urn: authorUrn }
  }
}

// ─── Gmail (Real API) ─────────────────────────────────────
export class GmailProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const token = this.credentials?.access_token
    if (!token) throw new Error('Gmail: no access_token in credentials')

    switch (action) {
      case 'send_email': {
        const to = params.to
        const subject = params.subject || 'No subject'
        const body = params.body || params.message || ''
        if (!to) throw new Error('Gmail: missing recipient (to)')

        const message = [
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          body,
        ].join('\r\n')

        const encoded = Buffer.from(message).toString('base64url')

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: encoded }),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Gmail send failed: ${res.status} ${errText}`)
        }

        const data = await res.json()
        return { messageId: data.id || `msg_${Date.now()}`, to, subject, status: 'sent', threadId: data.threadId }
      }

      case 'get_messages': {
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Gmail list failed: ${res.status}`)
        const data = await res.json()
        return { messages: data.messages || [], total: data.resultSizeEstimate || 0 }
      }

      default:
        throw new Error(`Gmail: unknown action ${action}`)
    }
  }
}

// ─── Vapi ─────────────────────────────────────────────────
export class VapiProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'start_call': return { callId: 'vapi_' + Date.now(), status: 'initiated', to: params.phone }
      case 'end_call': return { callId: params.callId, status: 'ended', duration: params.duration || 0 }
      case 'get_transcript': return { callId: params.callId, transcript: [], status: 'completed' }
      default: throw new Error(`Vapi: unknown action ${action}`)
    }
  }
}

// ─── Bland AI ─────────────────────────────────────────────
export class BlandAIProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'start_call': return { callId: 'bland_' + Date.now(), status: 'queued', to: params.phone }
      case 'get_call_result': return { callId: params.callId, status: 'completed', summary: params.summary || 'Call completed successfully' }
      default: throw new Error(`BlandAI: unknown action ${action}`)
    }
  }
}

// ─── Apollo ───────────────────────────────────────────────
export class ApolloProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'enrich_company': return { domain: params.domain, employees: 50, industry: 'technology', revenue: '$10M+' }
      case 'search_leads': return { leads: [], total: params.limit || 25 }
      default: throw new Error(`Apollo: unknown action ${action}`)
    }
  }
}

// ─── Factory ──────────────────────────────────────────────
export function createProvider(supabase: any, userId: string, provider: string): BaseProvider {
  const map: Record<string, new (s: any, u: string, p: string) => BaseProvider> = {
    // Communication
    gmail: GmailProvider, outlook: OutlookProvider, resend: ResendProvider, slack: SlackProvider,
    discord: DiscordProvider, telegram: TelegramProvider, twilio: TwilioProvider,
    whatsapp: WhatsAppProvider,
    // Social
    linkedin: LinkedInProvider, facebook: FacebookProvider, instagram: InstagramProvider,
    x: XProvider, youtube: YouTubeProvider,
    // CRM & Sales
    hubspot: HubSpotProvider, salesforce: SalesforceProvider, apollo: ApolloProvider,
    calendly: CalendlyProvider, clay: ClayProvider,
    // Payments
    stripe: StripeProvider, paddle: PaddleProvider,
    // Data
    airtable: AirtableProvider,
    // AI & Voice
    vapi: VapiProvider, bland_ai: BlandAIProvider,
    elevenlabs: ElevenLabsProvider, whisper: WhisperProvider,
    run: RunwayProvider, veo: VeoProvider, pika: PikaProvider, kling: KlingProvider,
    // Ads
    facebook_ads: FacebookAdsProvider, google_ads: GoogleAdsProvider,
    linkedin_ads: LinkedInAdsProvider, tiktok_ads: TikTokAdsProvider,
    // Design
    figma: FigmaProvider, canva: CanvaProvider,
    // Dev & Deploy
    github: GitHubProvider, gitlab: GitLabProvider,
    vercel: VercelProvider, cloudflare: CloudflareProvider,
    // Automation
    n8n: N8nProvider, make: MakeProvider,
  }
  const Klass = map[provider]
  if (!Klass) throw new Error(`No provider implementation for: ${provider}`)
  return new Klass(supabase, userId, provider)
}
