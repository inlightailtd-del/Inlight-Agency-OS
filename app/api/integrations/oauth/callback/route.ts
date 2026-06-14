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
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=${encodeURIComponent(error)}&provider=${provider}`, request.url)
      )
    }

    if (!provider || !code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=Missing+parameters', request.url)
      )
    }

    const sdk = new IntegrationSDK(supabase, user.id)
    await sdk.handleOAuthCallback(provider as any, code, state)

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?connected=${provider}`, request.url)
    )
  } catch (e: any) {
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=${encodeURIComponent(e.message)}`, request.url)
    )
  }
}
