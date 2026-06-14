import type { SupabaseClient } from '@supabase/supabase-js'

export type ValidationStatus = 'working' | 'warning' | 'broken' | 'skipped'

export interface ValidationResult {
  slug: string
  name: string
  category: string
  status: ValidationStatus
  statusCode?: number
  message: string
  details: Record<string, any>
  durationMs: number
}

export interface ValidationRun {
  id: string
  userId: string
  status: 'running' | 'completed' | 'failed'
  totalChecks: number
  passedChecks: number
  warningChecks: number
  failedChecks: number
  durationMs: number
  startedAt: string
  completedAt: string | null
}

export interface AuditReport {
  runId: string
  status: string
  totalChecks: number
  passedChecks: number
  warningChecks: number
  failedChecks: number
  durationMs: number
  results: ValidationResult[]
}

export abstract class BaseValidator {
  protected supabase: SupabaseClient
  protected userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  abstract get slug(): string
  abstract get name(): string
  abstract get category(): string

  abstract validate(): Promise<ValidationResult>

  protected async getCredentials(provider: string) {
    const { data } = await this.supabase
      .from('integration_credentials')
      .select('id, credentials, expires_at, is_expired')
      .eq('user_id', this.userId)
      .eq('provider', provider)
      .eq('is_expired', false)
      .order('created_at', { ascending: false })
      .limit(1)
    return data?.[0] || null
  }

  protected async getConnection(provider: string) {
    const { data } = await this.supabase
      .from('integration_connections')
      .select('id, status, config, total_requests, successful_requests, failed_requests')
      .eq('user_id', this.userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    return data?.[0] || null
  }
}
