import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationSDK } from '@/lib/integrations/sdk'
import { storeMemory } from '@/lib/ai/memory'

/**
 * Publish approved content to real social platforms via Integration SDK.
 * Only LinkedIn is fully implemented; other providers fall through cleanly.
 */
export async function publishApprovedContent(supabase: SupabaseClient, userId: string): Promise<{
  linkedin: number; facebook: number; instagram: number; x: number; youtube: number; errors: string[]
}> {
  const sdk = new IntegrationSDK(supabase, userId)
  const errors: string[] = []

  const { data: approved } = await supabase
    .from('growth_content_calendar')
    .select('id, content_request_id, platform, content_requests!inner(title, generated_content)')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .limit(10)

  const counts = { linkedin: 0, facebook: 0, instagram: 0, x: 0, youtube: 0 }

  for (const item of (approved ?? []) as any[]) {
    const platform = item.platform as string
    const content = item.content_requests?.generated_content || ''
    const title = item.content_requests?.title || ''

    // Map front-end platform names to provider names in the SDK
    const providerMap: Record<string, { provider: string; action: string }> = {
      linkedin: { provider: 'linkedin', action: 'create_post' },
      facebook: { provider: 'facebook', action: 'publish_post' },
      instagram: { provider: 'instagram', action: 'publish_post' },
      x: { provider: 'x', action: 'publish_post' },
      twitter: { provider: 'x', action: 'publish_post' },
      youtube: { provider: 'youtube', action: 'publish_video' },
    }
    const mapping = providerMap[platform]
    if (!mapping) continue

    try {
      const result = await sdk.executeAction(mapping.provider as any, mapping.action, { content, title, platform })

      if (result.success) {
        await supabase.from('growth_content_calendar').update({
          status: 'published', posted_at: new Date().toISOString(),
        }).eq('id', item.id)
        if (item.content_request_id) {
          await supabase.from('content_requests').update({
            status: 'published', published_at: new Date().toISOString(),
          }).eq('id', item.content_request_id)
        }
        const key = mapping.provider as keyof typeof counts
        if (counts[key] !== undefined) counts[key]++
      } else {
        errors.push(`${platform}: ${result.error || 'unknown error'}`)
      }
    } catch (e: any) {
      errors.push(`${platform}: ${e.message}`)
    }
  }

  if (counts.linkedin > 0 || counts.facebook > 0) {
    await storeMemory(supabase, userId, {
      category: 'growth_pattern', tags: ['real_publishing'],
      content: { type: 'real_publish_batch', date: new Date().toISOString().split('T')[0], counts, errors: errors.slice(0, 5), publishedAt: new Date().toISOString() },
    })
  }

  return { ...counts, errors }
}
