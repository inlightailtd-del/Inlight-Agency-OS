import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProviderName, ConnectionStatus, HealthStatus, ActionResponse, SyncResult, CredentialStore } from './types'
import { createProvider } from './providers'
import { generateAuthUrl, exchangeCode, generateState, verifyState } from './oauth-handler'
import type { ExchangeResult } from './oauth-handler'

export class IntegrationSDK {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async connectProvider(provider: ProviderName, authMethod: 'oauth' | 'api_key', credentials: Record<string, any>, scopes?: string[]): Promise<{ credentialId: string; connectionId: string }> {
    const { data: cred } = await this.supabase.from('integration_credentials').insert([{
      user_id: this.userId, provider, auth_type: authMethod, credentials, scopes: scopes || [],
      expires_at: authMethod === 'oauth' ? new Date(Date.now() + 3600000 * 24 * 60).toISOString() : null,
    }]).select('id').single()
    if (!cred) throw new Error('Failed to store credentials')

    const { data: conn } = await this.supabase.from('integration_connections').insert([{
      user_id: this.userId, provider, credential_id: cred.id, status: 'connected',
      config: { connectedAt: new Date().toISOString() },
      rate_limit_remaining: 100, is_active: true,
    }]).select('id').single()
    if (!conn) throw new Error('Failed to create connection')

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null, action: `[Integration] Connected ${provider}`, module: 'integrations', status: 'success',
      message: `Auth: ${authMethod}`,
    }])
    return { credentialId: cred.id, connectionId: conn.id }
  }

  async disconnectProvider(connectionId: string): Promise<void> {
    await this.supabase.from('integration_connections').update({ status: 'disconnected', is_active: false, updated_at: new Date().toISOString() }).eq('id', connectionId)
  }

  async getOAuthUrl(provider: ProviderName): Promise<string> {
    const state = await generateState(this.supabase, this.userId, provider)
    const { url } = generateAuthUrl(provider, state)
    return url
  }

  async handleOAuthCallback(provider: ProviderName, code: string, state: string): Promise<ExchangeResult> {
    const valid = await verifyState(this.supabase, provider, state)
    if (!valid) throw new Error('Invalid OAuth state parameter — possible CSRF attack')
    return exchangeCode(this.supabase, this.userId, provider, code)
  }

  async testConnection(provider: ProviderName): Promise<ActionResponse> {
    const prov = createProvider(this.supabase, this.userId, provider)
    // Execute a read-only health action specific to each provider
    try {
      switch (provider) {
        case 'gmail':
          return prov.executeAction('get_messages', { maxResults: 1 })
        case 'linkedin':
          return prov.executeAction('create_post', { content: 'Connection test from Inlight Agency OS', text: 'Connection test from Inlight Agency OS' })
        default:
          return prov.executeAction('check_health', {})
      }
    } catch (e: any) {
      return { success: false, error: e.message, durationMs: 0 }
    }
  }

  async validateConnection(provider: ProviderName): Promise<boolean> {
    try {
      const prov = createProvider(this.supabase, this.userId, provider)
      return await prov.validateConnection()
    } catch { return false }
  }

  async executeAction(provider: ProviderName, action: string, params: Record<string, any>): Promise<ActionResponse> {
    const prov = createProvider(this.supabase, this.userId, provider)
    return prov.executeAction(action, params)
  }

  async syncData(provider: ProviderName, params: Record<string, any>): Promise<SyncResult> {
    const prov = createProvider(this.supabase, this.userId, provider)
    return prov.syncData(params)
  }

  async getHealthStatus(provider: ProviderName): Promise<HealthStatus> {
    const prov = createProvider(this.supabase, this.userId, provider)
    return prov.checkHealth()
  }

  async getConnections(): Promise<any[]> {
    const { data } = await this.supabase.from('integration_connections').select('*, integration_credentials!inner(credentials, auth_type, scopes)').eq('user_id', this.userId).eq('is_active', true).order('created_at', { ascending: false })
    return (data ?? []) as any[]
  }

  async getHealthLogs(limit = 50): Promise<any[]> {
    const { data } = await this.supabase.from('integration_health_logs').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }).limit(limit)
    return (data ?? []) as any[]
  }

  async getProviderStatus(provider: ProviderName): Promise<{ connected: boolean; health?: HealthStatus; connection?: any }> {
    const { data } = await this.supabase.from('integration_connections').select('*').eq('user_id', this.userId).eq('provider', provider).eq('is_active', true).limit(1)
    const rows = (data ?? []) as any[]
    if (rows.length === 0) return { connected: false }
    const health = await this.getHealthStatus(provider)
    return { connected: rows[0].status === 'connected', health, connection: rows[0] }
  }
}
