import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IntegrationSDK } from '@/lib/integrations/sdk'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sdk = new IntegrationSDK(supabase, user.id)
    const [connections, healthLogs] = await Promise.all([
      sdk.getConnections().catch(() => []),
      sdk.getHealthLogs(20).catch(() => []),
    ])

    return NextResponse.json({ connections, healthLogs })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
