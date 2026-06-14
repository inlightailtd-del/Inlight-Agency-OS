import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { connectionId } = await request.json()
    if (!connectionId) return NextResponse.json({ error: 'connectionId required' }, { status: 400 })

    // Verify ownership
    const { data: conn } = await supabase
      .from('integration_connections')
      .select('id, credential_id')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single()

    if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

    // Mark connection as disconnected
    await supabase
      .from('integration_connections')
      .update({ status: 'disconnected', is_active: false, updated_at: new Date().toISOString() })
      .eq('id', connectionId)

    // Mark credentials as expired
    if (conn.credential_id) {
      await supabase
        .from('integration_credentials')
        .update({ is_expired: true, updated_at: new Date().toISOString() })
        .eq('id', conn.credential_id)
    }

    await supabase.from('execution_logs').insert([{
      user_id: user.id,
      command_id: null,
      action: '[Integration] Disconnected provider',
      module: 'integrations',
      status: 'success',
      message: `Connection ${connectionId} disconnected`,
    }])

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
