import { BaseValidator, type ValidationResult } from './types'

export class GmailApiValidator extends BaseValidator {
  get slug() { return 'gmail-api' }
  get name() { return 'Gmail API' }
  get category() { return 'integration' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    const cred = await this.getCredentials('gmail')
    const conn = await this.getConnection('gmail')

    if (!cred) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: 'No Gmail OAuth credentials found',
        details: { hasCredentials: false, hasConnection: !!conn }, durationMs: Date.now() - start,
      }
    }

    const token = (cred.credentials as any)?.access_token
    if (!token) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: 'Gmail credentials exist but no access_token',
        details: { credentialId: cred.id, hasToken: false }, durationMs: Date.now() - start,
      }
    }

    // Real Gmail API call — get profile
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()

      if (!res.ok) {
        return {
          slug: this.slug, name: this.name, category: this.category,
          status: 'broken', message: `Gmail API returned ${res.status}: ${body.error?.message || 'unknown error'}`,
          details: { statusCode: res.status, error: body.error, credentialId: cred.id },
          durationMs: Date.now() - start,
        }
      }

      // Now try listing messages to confirm read works
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const listBody = await listRes.json()

      // Try sending a test — use a simple label get instead to avoid sending real emails
      const labelRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const labelBody = await labelRes.json()

      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'working',
        message: `Gmail API working — ${body.emailAddress}, ${body.messagesTotal || '?'} messages`,
        details: {
          email: body.emailAddress,
          messagesTotal: body.messagesTotal,
          messagesInInbox: body.messagesInInbox || 0,
          canListMessages: listRes.ok,
          labelsCount: labelBody.labels?.length || 0,
          credentialId: cred.id,
          connectionId: conn?.id,
          connectionStatus: conn?.status,
          connectionStats: conn ? { total: conn.total_requests, success: conn.successful_requests, failed: conn.failed_requests } : null,
        },
        durationMs: Date.now() - start,
      }
    } catch (e: any) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: `Gmail API request failed: ${e.message}`,
        details: { error: e.message }, durationMs: Date.now() - start,
      }
    }
  }
}

export class GmailCredentialsValidator extends BaseValidator {
  get slug() { return 'gmail-credentials' }
  get name() { return 'Gmail Credentials' }
  get category() { return 'integration' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    const cred = await this.getCredentials('gmail')
    const conn = await this.getConnection('gmail')

    if (!cred) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: 'No Gmail OAuth credentials stored',
        details: { provider: 'gmail', hasCredentials: false }, durationMs: Date.now() - start,
      }
    }

    const stored = cred.credentials as Record<string, any>
    const issues: string[] = []
    if (!stored.access_token) issues.push('missing access_token')
    if (!stored.refresh_token) issues.push('missing refresh_token')
    if (cred.is_expired) issues.push('credential marked expired')
    if (cred.expires_at && new Date(cred.expires_at) < new Date()) issues.push('token expired at ' + cred.expires_at)

    const hasIssues = issues.length > 0

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: hasIssues ? 'warning' : 'working',
      message: hasIssues
        ? `Gmail credentials have issues: ${issues.join(', ')}`
        : `Gmail credentials valid — expires ${new Date(cred.expires_at!).toLocaleString()}`,
      details: {
        credentialId: cred.id,
        hasAccessToken: !!stored.access_token,
        hasRefreshToken: !!stored.refresh_token,
        expiresAt: cred.expires_at,
        isExpired: cred.is_expired,
        issues,
        connectionId: conn?.id,
        connectionStatus: conn?.status,
      },
      durationMs: Date.now() - start,
    }
  }
}
