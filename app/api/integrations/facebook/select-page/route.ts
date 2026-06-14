import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { pageId, pageName, pageAccessToken } = await request.json()
    if (!pageId || !pageName || !pageAccessToken) {
      return NextResponse.json({ error: 'pageId, pageName, and pageAccessToken required' }, { status: 400 })
    }

    // Find the facebook connection
    const { data: conn } = await supabase
      .from('integration_connections')
      .select('id, credential_id')
      .eq('user_id', user.id)
      .eq('provider', 'facebook')
      .eq('is_active', true)
      .single()

    if (!conn) return NextResponse.json({ error: 'No active Facebook connection' }, { status: 400 })

    // Update connection config with selected page info
    await supabase
      .from('integration_connections')
      .update({
        config: {
          selectedPageId: pageId,
          selectedPageName: pageName,
          selectedPageToken: pageAccessToken,
          connectedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id)

    // Also store the page token alongside the user token in credentials
    const { data: cred } = await supabase
      .from('integration_credentials')
      .select('id, credentials')
      .eq('id', conn.credential_id)
      .single()

    if (cred) {
      const currentCreds = cred.credentials as Record<string, any>
      await supabase
        .from('integration_credentials')
        .update({
          credentials: {
            ...currentCreds,
            selected_page_id: pageId,
            selected_page_name: pageName,
            page_access_token: pageAccessToken,
            updated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.credential_id)
    }

    await supabase.from('execution_logs').insert([{
      user_id: user.id,
      command_id: null,
      action: '[Facebook] Page selected',
      module: 'integrations',
      status: 'success',
      message: `Selected page: ${pageName} (${pageId})`,
    }])

    return NextResponse.json({ success: true, pageId, pageName })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
