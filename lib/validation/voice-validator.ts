import { BaseValidator, type ValidationResult } from './types'

const VOICE_PROVIDERS = ['twilio', 'vapi', 'bland_ai', 'retell_ai', 'elevenlabs']

export class VoiceValidator extends BaseValidator {
  get slug() { return 'voice-credentials' }
  get name() { return 'Voice Credentials' }
  get category() { return 'integration' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    const providerStatuses: Record<string, any> = {}

    for (const provider of VOICE_PROVIDERS) {
      const { data: creds } = await this.supabase
        .from('integration_credentials')
        .select('id, auth_type', { count: 'exact', head: false })
        .eq('user_id', this.userId)
        .eq('provider', provider)
        .eq('is_expired', false)
        .limit(1)

      const { data: conns } = await this.supabase
        .from('integration_connections')
        .select('id, status', { count: 'exact', head: false })
        .eq('user_id', this.userId)
        .eq('provider', provider)
        .eq('is_active', true)
        .limit(1)

      const cred = creds?.[0] || null
      const conn = conns?.[0] || null
      providerStatuses[provider] = {
        hasCredentials: !!cred,
        hasConnection: !!conn,
        connectionStatus: conn?.status || null,
      }
    }

    const connectedProviders = Object.entries(providerStatuses)
      .filter(([_, s]) => s.hasCredentials || (s as any).hasConnection)
      .map(([p, _]) => p)

    const totalConnected = connectedProviders.length

    if (totalConnected === 0) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'skipped', message: 'No voice/calling providers connected (Twilio, Vapi, Bland AI, etc.)',
        details: { providerStatuses, connectedProviders: [] }, durationMs: Date.now() - start,
      }
    }

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: 'working',
      message: `${totalConnected} voice provider${totalConnected > 1 ? 's' : ''} connected: ${connectedProviders.join(', ')}`,
      details: { providerStatuses, connectedProviders },
      durationMs: Date.now() - start,
    }
  }
}
