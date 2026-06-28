export interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  redirectPath: string
}

function env(key: string): string {
  return process.env[key] || ''
}

export const OAUTH_CONFIG: Record<string, OAuthProviderConfig> = {
  gmail: {
    clientId: env('GOOGLE_CLIENT_ID'),
    clientSecret: env('GOOGLE_CLIENT_SECRET'),
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    redirectPath: '/api/integrations/oauth/callback',
  },
  linkedin: {
    clientId: env('LINKEDIN_CLIENT_ID'),
    clientSecret: env('LINKEDIN_CLIENT_SECRET'),
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['openid', 'profile', 'email', 'w_member_social'],
    redirectPath: '/api/integrations/oauth/callback',
  },
  calendly: {
    clientId: env('CALENDLY_CLIENT_ID'),
    clientSecret: env('CALENDLY_CLIENT_SECRET'),
    authUrl: 'https://auth.calendly.com/oauth/authorize',
    tokenUrl: 'https://auth.calendly.com/oauth/token',
    scopes: ['default'],
    redirectPath: '/api/integrations/oauth/callback',
  },
  facebook: {
    clientId: env('FACEBOOK_CLIENT_ID'),
    clientSecret: env('FACEBOOK_CLIENT_SECRET'),
    authUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'pages_manage_metadata', 'public_profile'],
    redirectPath: '/api/integrations/oauth/callback',
  },
  instagram: {
    clientId: env('FACEBOOK_CLIENT_ID'),
    clientSecret: env('FACEBOOK_CLIENT_SECRET'),
    authUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'instagram_manage_insights', 'public_profile'],
    redirectPath: '/api/integrations/oauth/callback',
  },
  youtube: {
    clientId: env('GOOGLE_CLIENT_ID'),
    clientSecret: env('GOOGLE_CLIENT_SECRET'),
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtubepartner',
    ],
    redirectPath: '/api/integrations/oauth/callback',
  },
  salesforce: {
    clientId: env('SALESFORCE_CLIENT_ID'),
    clientSecret: env('SALESFORCE_CLIENT_SECRET'),
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    scopes: ['api', 'refresh_token', 'offline_access'],
    redirectPath: '/api/integrations/oauth/callback',
  },
}

export function getOAuthConfig(provider: string): OAuthProviderConfig | null {
  return OAUTH_CONFIG[provider] || null
}

export function buildRedirectUri(config: OAuthProviderConfig): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  return `${baseUrl}${config.redirectPath}`
}
