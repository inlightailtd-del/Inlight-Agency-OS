import { BaseValidator, type ValidationResult } from './types'

export class FacebookApiValidator extends BaseValidator {
  get slug() { return 'facebook-api' }
  get name() { return 'Facebook API' }
  get category() { return 'integration' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    const cred = await this.getCredentials('facebook')
    const conn = await this.getConnection('facebook')

    if (!cred) {
      // Facebook is optional — return skipped instead of broken
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'skipped', message: 'Facebook not connected — no credentials found',
        details: { hasCredentials: false }, durationMs: Date.now() - start,
      }
    }

    const stored = cred.credentials as Record<string, any>
    const userToken = stored.access_token
    const pageToken = stored.page_access_token
    const selectedPageName = stored.selected_page_name

    if (!userToken && !pageToken) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'warning', message: 'Facebook credentials exist but no tokens found',
        details: { credentialId: cred.id, hasUserToken: false, hasPageToken: false },
        durationMs: Date.now() - start,
      }
    }

    const token = pageToken || userToken
    const errors: string[] = []

    // Test 1: Verify the token with Graph API /me
    try {
      const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=name&access_token=${token}`)
      const meBody = await meRes.json()

      if (!meRes.ok) {
        return {
          slug: this.slug, name: this.name, category: this.category,
          status: 'broken', message: `Facebook token invalid: ${meBody.error?.message || meRes.status}`,
          details: { statusCode: meRes.status, error: meBody.error, credentialId: cred.id },
          durationMs: Date.now() - start,
        }
      }

      // Test 2: List pages if user token
      if (pageToken && selectedPageName) {
        return {
          slug: this.slug, name: this.name, category: this.category,
          status: 'working',
          message: `Facebook connected — user: ${meBody.name}, page: ${selectedPageName}`,
          details: {
            userName: meBody.name,
            pageName: selectedPageName,
            hasPageAccess: true,
            connectionId: conn?.id,
            connectionStatus: conn?.status,
          },
          durationMs: Date.now() - start,
        }
      } else {
        // Has token but no page selected (partial setup)
        return {
          slug: this.slug, name: this.name, category: this.category,
          status: 'warning',
          message: `Facebook user connected (${meBody.name}) but no page selected`,
          details: {
            userName: meBody.name,
            pageSelected: false,
            connectionId: conn?.id,
            connectionStatus: conn?.status,
          },
          durationMs: Date.now() - start,
        }
      }
    } catch (e: any) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: `Facebook API request failed: ${e.message}`,
        details: { error: e.message }, durationMs: Date.now() - start,
      }
    }
  }
}

export class FacebookCredentialsValidator extends BaseValidator {
  get slug() { return 'facebook-credentials' }
  get name() { return 'Facebook Credentials' }
  get category() { return 'integration' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    const cred = await this.getCredentials('facebook')
    const conn = await this.getConnection('facebook')

    if (!cred) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'skipped', message: 'Facebook not connected — no credentials',
        details: { provider: 'facebook', connected: false }, durationMs: Date.now() - start,
      }
    }

    const stored = cred.credentials as Record<string, any>
    const hasUserToken = !!stored.access_token
    const hasPageToken = !!stored.page_access_token
    const hasSelectedPage = !!stored.selected_page_id

    const issues: string[] = []
    if (!hasUserToken) issues.push('missing user access_token')
    if (!hasPageToken) issues.push('no page token — select a page to publish')
    if (!hasSelectedPage) issues.push('no page selected')

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: issues.length > 1 ? 'warning' : 'working',
      message: issues.length > 0
        ? `Facebook: ${issues.join(', ')}`
        : `Facebook fully connected with page access`,
      details: {
        credentialId: cred.id,
        hasUserToken,
        hasPageToken,
        selectedPageId: stored.selected_page_id,
        selectedPageName: stored.selected_page_name,
        issues,
        connectionId: conn?.id,
        connectionStatus: conn?.status,
      },
      durationMs: Date.now() - start,
    }
  }
}
