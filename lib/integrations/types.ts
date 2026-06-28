export type ProviderName =
  | 'gmail' | 'outlook' | 'resend' | 'linkedin' | 'apollo' | 'clay' | 'instantly' | 'smartlead'
  | 'calendly' | 'hubspot' | 'stripe' | 'paddle' | 'twilio' | 'vapi' | 'bland_ai' | 'retell_ai'
  | 'elevenlabs' | 'openai_realtime' | 'facebook' | 'instagram' | 'x' | 'youtube'
  | 'runway' | 'veo' | 'pika' | 'kling' | 'whisper'
  | 'facebook_ads' | 'google_ads' | 'linkedin_ads' | 'tiktok_ads'
  | 'github' | 'gitlab' | 'vercel' | 'cloudflare'
  | 'figma' | 'canva'
  | 'whatsapp'
  | 'salesforce' | 'slack' | 'discord' | 'telegram' | 'airtable'
  | 'n8n' | 'make'

export type AuthType = 'oauth' | 'api_key' | 'both'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired'

export interface ProviderDefinition {
  provider: ProviderName
  name: string
  description: string
  category: string
  authType: AuthType
  supportsOAuth: boolean
  supportsApiKey: boolean
  baseUrl: string
  rateLimitWindow: number
  rateLimitMax: number
}

export interface ConnectionConfig {
  id: string
  provider: ProviderName
  credentialId: string
  status: ConnectionStatus
  config: Record<string, any>
  rateLimitRemaining: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  lastConnectedAt: string | null
  lastError: string | null
  isActive: boolean
}

export interface CredentialStore {
  id: string
  provider: ProviderName
  authType: AuthType
  credentials: Record<string, any>
  scopes: string[]
  expiresAt: string | null
  isExpired: boolean
}

export interface ActionResponse {
  success: boolean
  data?: any
  error?: string
  statusCode?: number
  durationMs: number
}

export interface HealthStatus {
  connected: boolean
  rateLimited: boolean
  rateLimitRemaining: number
  rateLimitResetAt: string | null
  lastCheckedAt: string
  error: string | null
  latencyMs: number
}

export interface SyncResult {
  synced: number
  failed: number
  errors: string[]
  durationMs: number
}
