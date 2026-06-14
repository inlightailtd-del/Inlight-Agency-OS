import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IntegrationSDK } from '@/lib/integrations/sdk'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sdk = new IntegrationSDK(supabase, user.id)

    const status = await sdk.getProviderStatus('facebook' as any)
    if (!status.connected) {
      return NextResponse.json({ error: 'Facebook not connected' }, { status: 400 })
    }

    const conn = status.connection as any
    const selectedPageName = conn?.config?.selectedPageName

    const result = await sdk.executeAction('facebook' as any, 'publish_post', {
      content: 'Testing Inlight Agency OS Facebook integration. Automated post via production execution. 🚀',
      title: 'Test post from Inlight Agency OS',
      platform: 'facebook',
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Publish failed' }, { status: 500 })
    }

    // Store proof in execution_logs
    await supabase.from('execution_logs').insert([{
      user_id: user.id,
      command_id: null,
      action: '[Facebook] Test post published',
      module: 'integrations',
      status: 'success',
      message: `Published to ${selectedPageName || 'Facebook'}: ${result.data?.postId || ''}`,
    }])

    return NextResponse.json({
      success: true,
      postId: result.data?.postId,
      pageName: selectedPageName,
      message: `Test post published to ${selectedPageName || 'Facebook page'}`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
