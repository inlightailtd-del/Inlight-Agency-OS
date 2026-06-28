import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IntegrationSDK } from '@/lib/integrations/sdk'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider')

    const validProviders = ['gmail', 'linkedin', 'facebook', 'calendly', 'youtube']
    if (!provider || !validProviders.includes(provider)) {
      return NextResponse.json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` }, { status: 400 })
    }

    const sdk = new IntegrationSDK(supabase, user.id)
    const authUrl = await sdk.getOAuthUrl(provider as any)

    // Redirect the user to the OAuth provider's consent screen
    return NextResponse.redirect(authUrl)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
