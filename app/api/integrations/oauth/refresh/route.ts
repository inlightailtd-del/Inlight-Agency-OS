import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/integrations/oauth-handler'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { credentialId, provider } = body

    if (!credentialId || !provider) {
      return NextResponse.json({ error: 'credentialId and provider are required' }, { status: 400 })
    }

    // Verify the credential belongs to this user
    const { data: cred } = await supabase
      .from('integration_credentials')
      .select('id')
      .eq('id', credentialId)
      .eq('user_id', user.id)
      .single()

    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    const result = await refreshAccessToken(supabase, credentialId, provider)

    return NextResponse.json({
      success: true,
      accessToken: result.accessToken.substring(0, 10) + '...',
      expiresAt: result.expiresAt,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
