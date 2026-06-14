import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IntegrationSDK } from '@/lib/integrations/sdk'

export async function GET(request: Request, { params }: { params: { provider: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { provider } = params
    const validProviders = ['gmail', 'linkedin', 'apollo', 'clay', 'calendly', 'hubspot', 'stripe', 'twilio', 'vapi', 'bland_ai', 'facebook', 'instagram', 'x', 'youtube', 'outlook']
    
    if (!provider || !validProviders.includes(provider)) {
      return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 })
    }

    const sdk = new IntegrationSDK(supabase, user.id)
    const startTime = Date.now()

    // Check if there's a connection
    const status = await sdk.getProviderStatus(provider as any)
    if (!status.connected) {
      return NextResponse.json({
        provider,
        connected: false,
        error: 'No active connection found',
        durationMs: Date.now() - startTime,
        connection: null,
      })
    }

    // Try to execute a test action
    const result = await sdk.testConnection(provider as any)

    return NextResponse.json({
      provider,
      connected: status.connected,
      testResult: result,
      health: status.health,
      connectionId: status.connection?.id || null,
      durationMs: Date.now() - startTime,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
