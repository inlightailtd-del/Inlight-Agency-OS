import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IntegrationSDK } from '@/lib/integrations/sdk'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { provider, apiKey } = await request.json()
    if (!provider || !apiKey) return NextResponse.json({ error: 'provider and apiKey required' }, { status: 400 })

    const sdk = new IntegrationSDK(supabase, user.id)
    const result = await sdk.connectProvider(provider, 'api_key', { api_key: apiKey })

    return NextResponse.json({ success: true, credentialId: result.credentialId, connectionId: result.connectionId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
