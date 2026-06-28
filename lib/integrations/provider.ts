import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProviderName, ConnectionStatus, ActionResponse, HealthStatus, SyncResult } from './types'
import { refreshAccessToken } from './oauth-handler'

export const RATE_LIMITS: Record<string, { windowSec: number; max: number }> = {
  gmail: { windowSec: 60, max: 100 }, outlook: { windowSec: 60, max: 100 },
  linkedin: { windowSec: 60, max: 100 }, apollo: { windowSec: 60, max: 50 },
  clay: { windowSec: 60, max: 30 }, instantly: { windowSec: 60, max: 60 },
  smartlead: { windowSec: 60, max: 60 }, calendly: { windowSec: 60, max: 50 },
  hubspot: { windowSec: 60, max: 100 }, stripe: { windowSec: 60, max: 100 },
  twilio: { windowSec: 60, max: 100 }, vapi: { windowSec: 60, max: 60 },
  bland_ai: { windowSec: 60, max: 60 }, retell_ai: { windowSec: 60, max: 60 },
  elevenlabs: { windowSec: 60, max: 30 }, openai_realtime: { windowSec: 60, max: 100 },
  facebook: { windowSec: 60, max: 100 }, instagram: { windowSec: 60, max: 100 },
  x: { windowSec: 60, max: 100 }, youtube: { windowSec: 60, max: 100 },
  runway: { windowSec: 60, max: 10 }, veo: { windowSec: 60, max: 10 },
  pika: { windowSec: 60, max: 10 }, kling: { windowSec: 60, max: 10 },
  whisper: { windowSec: 60, max: 50 },
  whatsapp: { windowSec: 60, max: 250 },
  facebook_ads: { windowSec: 60, max: 30 }, google_ads: { windowSec: 60, max: 50 },
  linkedin_ads: { windowSec: 60, max: 30 }, tiktok_ads: { windowSec: 60, max: 40 },
  github: { windowSec: 60, max: 60 }, gitlab: { windowSec: 60, max: 60 },
  vercel: { windowSec: 60, max: 30 }, cloudflare: { windowSec: 60, max: 30 },
  figma: { windowSec: 60, max: 30 }, canva: { windowSec: 60, max: 30 },
  salesforce: { windowSec: 60, max: 100 }, slack: { windowSec: 60, max: 100 },
  discord: { windowSec: 60, max: 50 }, telegram: { windowSec: 60, max: 30 },
  airtable: { windowSec: 60, max: 10 }, n8n: { windowSec: 60, max: 60 },
  make: { windowSec: 60, max: 30 },
}

export class BaseProvider {
  protected supabase: SupabaseClient
  protected userId: string
  protected provider: string
  protected credentials: Record<string, any> = {}

  constructor(supabase: SupabaseClient, userId: string, provider: string) {
    this.supabase = supabase
    this.userId = userId
    this.provider = provider
  }

  protected credentialId: string | null = null

  async loadCredentials(): Promise<boolean> {
    const { data } = await this.supabase
      .from('integration_credentials')
      .select('id, credentials, expires_at')
      .eq('user_id', this.userId)
      .eq('provider', this.provider)
      .eq('is_expired', false)
      .order('created_at', { ascending: false })
      .limit(1)
    const rows = (data ?? []) as any[]
    if (rows.length === 0) return false
    this.credentialId = rows[0].id
    this.credentials = rows[0].credentials || {}
    if (rows[0].expires_at && new Date(rows[0].expires_at) < new Date()) {
      // Token expired — try to refresh
      return this.refreshCredentials()
    }
    return true
  }

  async refreshCredentials(): Promise<boolean> {
    if (!this.credentialId) return false
    try {
      const refreshed = await refreshAccessToken(this.supabase, this.credentialId, this.provider)
      this.credentials.access_token = refreshed.accessToken
      if (refreshed.refreshToken) this.credentials.refresh_token = refreshed.refreshToken
      return true
    } catch (e) {
      // Refresh failed — mark expired
      try {
        await this.supabase.from('integration_credentials').update({ is_expired: true }).eq('id', this.credentialId)
        await this.supabase.from('integration_connections').update({ status: 'expired', last_error: `Token refresh failed: ${e}` }).eq('credential_id', this.credentialId)
      } catch {}
      return false
    }
  }

  async getConnection(): Promise<{ id: string; config: Record<string, any>; rate_limit_remaining: number } | null> {
    const { data } = await this.supabase
      .from('integration_connections')
      .select('id, config, rate_limit_remaining')
      .eq('user_id', this.userId)
      .eq('provider', this.provider)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    const rows = (data ?? []) as any[]
    return rows.length > 0 ? { id: rows[0].id, config: (rows[0].config || {}) as Record<string, any>, rate_limit_remaining: rows[0].rate_limit_remaining || 0 } : null
  }

  protected async logHealth(status: string, statusCode: number | null, message: string, durationMs: number, metadata?: Record<string, any>) {
    try {
      const conn = await this.getConnection()
      await this.supabase.from('integration_health_logs').insert([{
        user_id: this.userId, connection_id: conn?.id || null, provider: this.provider,
        event: 'action', status, status_code: statusCode, message, duration_ms: durationMs, metadata: metadata || {},
      }])
    } catch { /* best effort */ }
  }

  protected async updateConnectionStats(success: boolean) {
    try {
      const conn = await this.getConnection()
      if (!conn) return
      const { data: cur } = await this.supabase.from('integration_connections').select('total_requests, successful_requests, failed_requests').eq('id', conn.id).single()
      const current = (cur ?? { total_requests: 0, successful_requests: 0, failed_requests: 0 }) as any
      const patch: Record<string, any> = { updated_at: new Date().toISOString() }
      patch.total_requests = (current.total_requests || 0) + 1
      if (success) {
        patch.successful_requests = (current.successful_requests || 0) + 1
        patch.last_connected_at = new Date().toISOString()
      } else {
        patch.failed_requests = (current.failed_requests || 0) + 1
      }
      await this.supabase.from('integration_connections').update(patch).eq('id', conn.id)
    } catch { /* best effort */ }
  }

  async validateConnection(): Promise<boolean> {
    const hasCreds = await this.loadCredentials()
    if (!hasCreds) return false
    return Object.keys(this.credentials).length > 0
  }

  async checkHealth(): Promise<HealthStatus> {
    const start = Date.now()
    const conn = await this.getConnection()
    try {
      const valid = await this.validateConnection()
      return {
        connected: valid,
        rateLimited: false,
        rateLimitRemaining: conn?.rate_limit_remaining || 0,
        rateLimitResetAt: null,
        lastCheckedAt: new Date().toISOString(),
        error: valid ? null : 'No valid credentials',
        latencyMs: Date.now() - start,
      }
    } catch (e: any) {
      return { connected: false, rateLimited: false, rateLimitRemaining: 0, rateLimitResetAt: null, lastCheckedAt: new Date().toISOString(), error: e.message, latencyMs: Date.now() - start }
    }
  }

  async executeAction(action: string, params: Record<string, any>): Promise<ActionResponse> {
    const start = Date.now()
    try {
      const valid = await this.loadCredentials()
      if (!valid) return { success: false, error: 'No valid credentials', durationMs: Date.now() - start }
      const result = await this.handleAction(action, params)
      await this.logHealth('success', 200, `${action} completed`, Date.now() - start)
      await this.updateConnectionStats(true)
      return { success: true, data: result, durationMs: Date.now() - start }
    } catch (e: any) {
      await this.logHealth('error', 500, e.message, Date.now() - start)
      await this.updateConnectionStats(false)
      return { success: false, error: e.message, durationMs: Date.now() - start }
    }
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    throw new Error(`Action "${action}" not implemented for ${this.provider}`)
  }

  async syncData(params: Record<string, any>): Promise<SyncResult> {
    return { synced: 0, failed: 0, errors: [], durationMs: 0 }
  }
}
