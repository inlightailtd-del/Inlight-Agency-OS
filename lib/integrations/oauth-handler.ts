import { getOAuthConfig, buildRedirectUri } from './oauth-config'
import type { SupabaseClient } from '@supabase/supabase-js'

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  id_token?: string
}

export interface ExchangeResult {
  accessToken: string
  refreshToken: string | null
  expiresAt: string
  scope: string
  providerAccountId: string
}

/**
 * Generate the authorization URL to redirect the user to the OAuth provider.
 */
export function generateAuthUrl(provider: string, state: string): { url: string; pkceVerifier?: string } {
  const config = getOAuthConfig(provider)
  if (!config) throw new Error(`No OAuth config for provider: ${provider}`)

  const redirectUri = buildRedirectUri(config) + `?provider=${provider}`
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  return { url: `${config.authUrl}?${params.toString()}` }
}

/**
 * Exchange an authorization code for tokens.
 * Stores credentials in integration_credentials and creates a connection.
 */
export async function exchangeCode(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
  code: string
): Promise<ExchangeResult> {
  const config = getOAuthConfig(provider)
  if (!config) throw new Error(`No OAuth config for provider: ${provider}`)

  const redirectUri = buildRedirectUri(config) + `?provider=${provider}`
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Token exchange failed for ${provider}: ${response.status} ${err}`)
  }

  const tokens: TokenResponse = await response.json()
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()
  const providerAccountId = tokens.id_token || tokens.access_token.substring(0, 20)

  // Store credentials
  const { data: cred, error: credErr } = await supabase
    .from('integration_credentials')
    .insert([{
      user_id: userId,
      provider,
      auth_type: 'oauth',
      credentials: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        scope: tokens.scope || config.scopes.join(' '),
        token_type: tokens.token_type || 'Bearer',
        id_token: tokens.id_token || null,
      },
      scopes: config.scopes,
      expires_at: expiresAt,
      is_expired: false,
    }])
    .select('id')
    .single()

  if (credErr || !cred) throw new Error(`Failed to store credentials: ${credErr?.message}`)

  // Create connection
  const { error: connErr } = await supabase
    .from('integration_connections')
    .insert([{
      user_id: userId,
      provider,
      credential_id: cred.id,
      status: 'connected',
      config: { connectedAt: new Date().toISOString(), providerAccountId },
      rate_limit_remaining: 100,
      is_active: true,
    }])
    .single()

  if (connErr) throw new Error(`Failed to create connection: ${connErr.message}`)

  // Log
  await supabase.from('execution_logs').insert([{
    user_id: userId,
    command_id: null,
    action: `[Integration] Connected ${provider} via OAuth`,
    module: 'integrations',
    status: 'success',
    message: `OAuth token stored, connection created`,
  }])

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt,
    scope: tokens.scope || config.scopes.join(' '),
    providerAccountId,
  }
}

/**
 * Refresh an OAuth token using its refresh_token.
 */
export async function refreshAccessToken(
  supabase: SupabaseClient,
  credentialId: string,
  provider: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: string }> {
  const config = getOAuthConfig(provider)
  if (!config) throw new Error(`No OAuth config for provider: ${provider}`)

  // Load existing credentials to get the refresh_token
  const { data: existing } = await supabase
    .from('integration_credentials')
    .select('credentials')
    .eq('id', credentialId)
    .single()

  if (!existing) throw new Error(`No credentials found for id: ${credentialId}`)

  const currentCreds = existing.credentials as Record<string, any>
  const refreshToken = currentCreds.refresh_token
  if (!refreshToken) throw new Error(`No refresh_token available for ${provider} credential ${credentialId}`)

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Token refresh failed for ${provider}: ${response.status} ${errText}`)
  }

  const tokens: TokenResponse = await response.json()
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

  const updatedCredentials = {
    ...currentCreds,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || refreshToken, // some providers don't return a new refresh token
    updated_at: new Date().toISOString(),
  }

  // Update credentials in DB
  await supabase
    .from('integration_credentials')
    .update({
      credentials: updatedCredentials,
      expires_at: newExpiresAt,
      is_expired: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', credentialId)

  // Update connection stats
  await supabase
    .from('integration_connections')
    .update({
      status: 'connected',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('credential_id', credentialId)

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresAt: newExpiresAt,
  }
}

/**
 * Generate a random state parameter for CSRF protection.
 * Store it in the database for verification on callback.
 */
export async function generateState(
  supabase: SupabaseClient,
  userId: string,
  provider: string
): Promise<string> {
  const state = crypto.randomUUID()
  // Store in agent_memory as temporary state (auto-cleaned)
  await supabase.from('agent_memory').insert([{
    user_id: userId,
    agent_id: null,
    category: 'oauth_state',
    content: { type: 'oauth_state', state, provider, created_at: new Date().toISOString() },
    tags: ['oauth_state', provider, state],
  }])
  return state
}

/**
 * Verify a state parameter matches what was stored.
 */
export async function verifyState(
  supabase: SupabaseClient,
  provider: string,
  state: string
): Promise<boolean> {
  const { data: stored } = await supabase
    .from('agent_memory')
    .select('id')
    .eq('category', 'oauth_state')
    .contains('tags', ['oauth_state', provider, state])
    .limit(1)

  if (!stored || stored.length === 0) return false

  // Clean up used state
  await supabase.from('agent_memory').delete().in('id', stored.map((s: any) => s.id))
  return true
}
