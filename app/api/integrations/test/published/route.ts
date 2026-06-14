import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ items: [], emailProof: null })

    // Get all published posts with media
    const { data: posts } = await supabase
      .from('content_requests')
      .select('id, title, platform_post_id, status, published_at, platform, media_url, media_asset_id, image_count, carousel_count, tags')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20)

    // Get last sent email
    const { data: emails } = await supabase
      .from('execution_logs')
      .select('id, message, created_at')
      .eq('user_id', user.id)
      .eq('action', '[Gmail] Real outreach email sent')
      .order('created_at', { ascending: false })
      .limit(1)

    // Get factory execution logs
    const { data: factoryLogs } = await supabase
      .from('execution_logs')
      .select('id, action, message, status, created_at')
      .eq('user_id', user.id)
      .contains('action', '[ContentFactory]')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      items: (posts ?? []).map(p => ({
        ...p,
        platform_post_id: p.platform_post_id || '',
        media_url: p.media_url || '',
        media_asset_id: p.media_asset_id || '',
        image_count: p.image_count || 0,
        carousel_count: p.carousel_count || 0,
      })),
      emailProof: emails?.[0] || null,
      factoryLogs: factoryLogs || [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
