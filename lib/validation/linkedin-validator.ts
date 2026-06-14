import { BaseValidator, type ValidationResult } from './types'

export class LinkedInApiValidator extends BaseValidator {
  get slug() { return 'linkedin-api' }
  get name() { return 'LinkedIn API' }
  get category() { return 'integration' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    const cred = await this.getCredentials('linkedin')
    const conn = await this.getConnection('linkedin')

    if (!cred) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: 'No LinkedIn OAuth credentials found',
        details: { hasCredentials: false, hasConnection: !!conn }, durationMs: Date.now() - start,
      }
    }

    const token = (cred.credentials as any)?.access_token
    if (!token) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: 'LinkedIn credentials exist but no access_token',
        details: { credentialId: cred.id, hasToken: false }, durationMs: Date.now() - start,
      }
    }

    // Real LinkedIn API call — userinfo endpoint (openid)
    try {
      const res = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()

      if (!res.ok) {
        return {
          slug: this.slug, name: this.name, category: this.category,
          status: 'broken', message: `LinkedIn API returned ${res.status}: ${body.error_description || body.message || 'unknown'}`,
          details: { statusCode: res.status, error: body, credentialId: cred.id },
          durationMs: Date.now() - start,
        }
      }

      // Get published posts from our DB as proof of past publishing
      const { data: posts, count } = await this.supabase
        .from('content_requests')
        .select('id, title, platform_post_id, published_at', { count: 'exact', head: false })
        .eq('user_id', this.userId)
        .eq('platform', 'linkedin')
        .eq('status', 'published')
        .order('published_at', { ascending: false })

      const publishedPosts = (posts || []).map(p => ({
        id: p.id,
        title: p.title,
        platformPostId: p.platform_post_id?.substring(0, 60),
        publishedAt: p.published_at,
      }))

      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'working',
        message: `LinkedIn API working — authenticated as ${body.name || body.sub}${(publishedPosts.length > 0) ? `, ${publishedPosts.length} published posts verified` : ''}`,
        details: {
          name: body.name,
          sub: body.sub,
          email: body.email,
          picture: body.picture,
          locale: body.locale,
          publishedPosts,
          totalPublishedPosts: count || 0,
          credentialId: cred.id,
          connectionId: conn?.id,
          connectionStatus: conn?.status,
        },
        durationMs: Date.now() - start,
      }
    } catch (e: any) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: `LinkedIn API request failed: ${e.message}`,
        details: { error: e.message }, durationMs: Date.now() - start,
      }
    }
  }
}

export class LinkedInCredentialsValidator extends BaseValidator {
  get slug() { return 'linkedin-credentials' }
  get name() { return 'LinkedIn Credentials' }
  get category() { return 'integration' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    const cred = await this.getCredentials('linkedin')
    const conn = await this.getConnection('linkedin')

    if (!cred) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: 'No LinkedIn OAuth credentials stored',
        details: { provider: 'linkedin', hasCredentials: false }, durationMs: Date.now() - start,
      }
    }

    const stored = cred.credentials as Record<string, any>
    const issues: string[] = []
    if (!stored.access_token) issues.push('missing access_token')

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: issues.length > 0 ? 'warning' : 'working',
      message: issues.length > 0
        ? `LinkedIn credentials have issues: ${issues.join(', ')}`
        : `LinkedIn credentials present and valid`,
      details: {
        credentialId: cred.id,
        hasAccessToken: !!stored.access_token,
        hasRefreshToken: !!stored.refresh_token,
        isExpired: cred.is_expired,
        expiresAt: cred.expires_at,
        issues,
        connectionId: conn?.id,
        connectionStatus: conn?.status,
      },
      durationMs: Date.now() - start,
    }
  }
}
