import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: creds } = await supabase
      .from('integration_credentials')
      .select('id, credentials')
      .eq('user_id', user.id)
      .eq('provider', 'facebook')
      .eq('is_expired', false)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!creds || creds.length === 0) {
      return NextResponse.json({ error: 'Facebook not connected' }, { status: 400 })
    }

    const accessToken = (creds[0].credentials as any).access_token
    if (!accessToken) return NextResponse.json({ error: 'No access token' }, { status: 400 })

    const res = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=name,id,picture,access_token,category&access_token=${accessToken}`
    )
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error?.message || 'Failed to fetch pages' }, { status: 500 })

    return NextResponse.json({ pages: data.data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
