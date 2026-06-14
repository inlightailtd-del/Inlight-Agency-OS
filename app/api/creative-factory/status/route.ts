import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [assets, prompts, queue] = await Promise.all([
      supabase.from('creative_assets').select('id, asset_type, prompt, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30).then(r => r.data || []),
      supabase.from('creative_prompts').select('id, prompt_type, prompt_text, times_used, performance_score, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('creative_generation_queue').select('id, prompt, model, status, priority, queued_at').eq('user_id', user.id).order('queued_at', { ascending: false }).limit(10).then(r => r.data || []),
    ])

    return NextResponse.json({
      assets: { total: assets.length, items: assets },
      prompts: { total: prompts.length, items: prompts },
      queue: { total: queue.length, items: queue },
      summary: {
        totalAssets: assets.length,
        pending: assets.filter((a: any) => a.status === 'pending').length,
        completed: assets.filter((a: any) => a.status === 'completed').length,
        queuePending: queue.filter((q: any) => q.status === 'queued').length,
        thumbnails: assets.filter((a: any) => a.asset_type === 'thumbnail').length,
        covers: assets.filter((a: any) => a.asset_type === 'cover').length,
        carouselSlides: assets.filter((a: any) => a.asset_type === 'carousel_slide').length,
        bRolls: assets.filter((a: any) => a.asset_type === 'b_roll').length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
