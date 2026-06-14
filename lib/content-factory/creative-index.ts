import type { SupabaseClient } from '@supabase/supabase-js'
import { CreativeFactory, type CreativeFactoryResult } from './creative-factory'
import { type ReelPackage } from '@/lib/reels/package-types'

export async function runCreativeFactory(
  supabase: SupabaseClient,
  userId: string
): Promise<{ results: CreativeFactoryResult[]; totalAssets: number; totalQueued: number; errors: string[] }> {
  const errors: string[] = []

  // Get latest draft reel packages
  const { data: packages } = await supabase
    .from('reel_packages')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(3)

  if (!packages?.length) {
    errors.push('No draft reel packages found. Run Reel Package Factory first.')
    return { results: [], totalAssets: 0, totalQueued: 0, errors }
  }

  const factory = new CreativeFactory(supabase, userId)
  const results: CreativeFactoryResult[] = []
  let totalAssets = 0
  let totalQueued = 0

  for (const pkg of packages) {
    const reelPkg: ReelPackage = {
      title: pkg.title,
      topic: pkg.topic,
      durationSeconds: pkg.duration_seconds,
      trendSource: pkg.trend_source,
      trendKeyword: pkg.trend_keyword,
      trendCategory: pkg.trend_category,
      hook: pkg.hook,
      hookType: pkg.hook_type,
      hookScore: pkg.hook_score,
      scriptBody: pkg.script_body,
      storyboard: pkg.storyboard || [],
      scenes: pkg.scenes || [],
      visualPrompts: pkg.visual_prompts || [],
      voiceoverText: pkg.voiceover_text || '',
      caption: pkg.caption || '',
      hashtags: pkg.hashtags || [],
      cta: pkg.cta || '',
      predictedPerformance: pkg.predicted_performance || 0,
    }

    const result = await factory.processPackage(reelPkg)
    results.push(result)
    totalAssets += result.assetsCreated
    totalQueued += result.queueJobs
    errors.push(...result.errors)
  }

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[CreativeFactory] Full run completed',
    module: 'content',
    status: errors.length > 0 ? 'failed' : 'success',
    message: `${packages.length} packages processed: ${totalAssets} assets created, ${totalQueued} queued for generation`,
  }])

  return { results, totalAssets, totalQueued, errors }
}
