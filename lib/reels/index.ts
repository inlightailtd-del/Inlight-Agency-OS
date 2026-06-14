import type { SupabaseClient } from '@supabase/supabase-js'
import { TrendScanner } from './trend-scanner'
import { CompetitorIntelligence } from './competitor-intelligence'
import { HookEngine } from './hook-engine'
import { ScriptEngine } from './script-engine'
import { ReelProductionEngine } from './production-engine'
import { PublishingEngine } from './publishing-engine'
import { AnalyticsEngine } from './analytics-engine'
import { LearningEngine } from './learning-engine'
import { type ReelsFactoryResult } from './types'

export type {
  Trend, Hook, Script, ReelVideo, PublishResult, AnalyticsSnapshot,
  ReelsFactoryResult, TrendSource, HookType, ReelDuration,
} from './types'

export { TrendScanner } from './trend-scanner'
export { CompetitorIntelligence } from './competitor-intelligence'
export { HookEngine } from './hook-engine'
export { ScriptEngine } from './script-engine'
export { ReelProductionEngine } from './production-engine'
export { PublishingEngine } from './publishing-engine'
export { AnalyticsEngine } from './analytics-engine'
export { LearningEngine } from './learning-engine'

/**
 * runFullReelsCycle — complete autonomous reels factory execution.
 * Runs the entire loop: trends → hooks → scripts → produce → publish → analytics → learn
 */
export async function runFullReelsCycle(
  supabase: SupabaseClient,
  userId: string
): Promise<ReelsFactoryResult> {
  const startTime = Date.now()
  const errors: string[] = []

  // Init all modules
  const trendScanner = new TrendScanner(supabase, userId)
  const competitorIntel = new CompetitorIntelligence(supabase, userId)
  const hookEngine = new HookEngine(supabase, userId)
  const scriptEngine = new ScriptEngine(supabase, userId)
  const productionEngine = new ReelProductionEngine(supabase, userId)
  const publishingEngine = new PublishingEngine(supabase, userId)
  const analyticsEngine = new AnalyticsEngine(supabase, userId)
  const learningEngine = new LearningEngine(supabase, userId)

  // Phase 1: Trend Scan
  let trendsScanned = 0
  try {
    const trendResult = await trendScanner.runFullScan()
    trendsScanned = trendResult.totalFound
  } catch (e: any) {
    errors.push(`Trend scan: ${e.message}`)
  }

  // Phase 2: Competitor Scan
  try {
    await competitorIntel.runScan()
  } catch (e: any) {
    errors.push(`Competitor scan: ${e.message}`)
  }

  // Phase 3: Hook Generation
  let hooksGenerated = 0
  try {
    const hooks = await hookEngine.generateHooks(undefined, 10)
    hooksGenerated = hooks.length
  } catch (e: any) {
    errors.push(`Hook generation: ${e.message}`)
  }

  // Phase 4: Script Generation (5 scripts)
  let scriptsCreated = 0
  let scripts: any[] = []
  try {
    scripts = await scriptEngine.generateScripts(undefined, 5)
    scriptsCreated = scripts.length
  } catch (e: any) {
    errors.push(`Script generation: ${e.message}`)
  }

  // Phase 5: Reel Production (3 videos from best scripts)
  let videosProduced = 0
  let videos: any[] = []
  try {
    const topScripts = scripts.slice(0, 3)
    if (topScripts.length > 0) {
      videos = await productionEngine.produceFromScripts(topScripts)
      videosProduced = videos.length
    }
  } catch (e: any) {
    errors.push(`Reel production: ${e.message}`)
  }

  // Phase 6: Publishing
  let videosPublished = 0
  try {
    if (videos.length > 0) {
      for (const video of videos) {
        const results = await publishingEngine.publishVideo(video)
        const published = results.filter(r => r.success).length
        if (published > 0) videosPublished++
      }
    }
  } catch (e: any) {
    errors.push(`Publishing: ${e.message}`)
  }

  // Phase 7: Analytics Collection
  let analyticsCollected = 0
  try {
    const snapshots = await analyticsEngine.collectDailySnapshots()
    analyticsCollected = snapshots.length
  } catch (e: any) {
    errors.push(`Analytics: ${e.message}`)
  }

  // Phase 8: Strategy Update
  let strategyUpdated = false
  try {
    await learningEngine.runStrategyUpdate()
    strategyUpdated = true
  } catch (e: any) {
    errors.push(`Strategy update: ${e.message}`)
  }

  const durationMs = Date.now() - startTime
  const summary = [
    `Trends: ${trendsScanned}`,
    `Hooks: ${hooksGenerated}`,
    `Scripts: ${scriptsCreated}`,
    `Produced: ${videosProduced}`,
    `Published: ${videosPublished}`,
    `Analytics: ${analyticsCollected}`,
    `Strategy: ${strategyUpdated ? '✓' : '✗'}`,
    `Errors: ${errors.length}`,
  ].join(' | ')

  // Log completion
  await supabase.from('execution_logs').insert([{
    user_id: userId,
    command_id: null,
    action: '[ReelsFactory] Cycle completed',
    module: 'reels',
    status: errors.length > 0 ? 'failed' : 'success',
    message: summary,
  }])

  return {
    trendsScanned,
    hooksGenerated,
    scriptsCreated,
    videosProduced,
    videosPublished,
    analyticsCollected,
    strategyUpdated,
    errors,
    summary,
    durationMs,
  } as ReelsFactoryResult & { durationMs: number }
}
