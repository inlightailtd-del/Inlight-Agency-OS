import { BaseReelsModule, type Script, type HookType } from './types'
import { AnalyticsEngine } from './analytics-engine'

export class LearningEngine extends BaseReelsModule {
  async runStrategyUpdate(): Promise<{
    updatedHookScores: number
    updatedTopicScores: number
    recommendations: string[]
  }> {
    await this.log('Strategy update started', 'Analyzing performance data')

    const analytics = new AnalyticsEngine(this.supabase, this.userId)
    const summary = await analytics.getPerformanceSummary()

    const recommendations: string[] = []

    // 1. Update hook scores based on analytics
    const updatedHookScores = await this.updateHookScores()

    // 2. Update topic scores
    const updatedTopicScores = await this.updateTopicScores(summary)

    // 3. Generate recommendations
    if (summary.totalVideos > 0) {
      recommendations.push(`Top platform: ${summary.topPlatform} (${summary.totalViews} views)`)
      if (summary.avgEngagementRate > 3) {
        recommendations.push(`High engagement rate (${summary.avgEngagementRate}%) — continue current strategy`)
      } else {
        recommendations.push(`Engagement rate at ${summary.avgEngagementRate}% — try curiosity hooks for better engagement`)
      }
      if (summary.topVideo) {
        recommendations.push(`Best performing video: "${summary.topVideo}" — analyze and replicate format`)
      }
      recommendations.push(`Publish more content for ${summary.topPlatform} — it's driving the most views`)
    }

    // 4. Update factory config with learnings
    await this.supabase.from('reels_factory_config').upsert({
      user_id: this.userId,
      config: {
        lastLearningUpdate: new Date().toISOString(),
        topPlatform: summary.topPlatform,
        avgEngagementRate: summary.avgEngagementRate,
        recommendations,
        strategyVersion: Date.now(),
      },
    }, { onConflict: 'user_id', ignoreDuplicates: false })

    // 5. Store in company brain
    await this.storeBrain('reels_strategy', {
      type: 'weekly_strategy_update',
      updatedAt: new Date().toISOString(),
      analytics: summary,
      recommendations,
      updatedHookScores,
      updatedTopicScores,
    }, ['reels', 'strategy', 'optimization'])

    await this.log('Strategy update completed',
      `${updatedHookScores} hook scores updated, ${updatedTopicScores} topic scores updated, ${recommendations.length} recommendations`
    )

    return { updatedHookScores, updatedTopicScores, recommendations }
  }

  private async updateHookScores(): Promise<number> {
    // Get analytics data linked to hook types via reels_videos → reels_scripts
    const { data: scriptAnalytics } = await this.supabase
      .from('reels_scripts')
      .select(`
        hook_type, hook_text,
        reels_videos!inner(
          id,
          reels_analytics(views, likes, comments, shares, engagement_rate)
        )
      `)
      .eq('user_id', this.userId)
      .not('hook_type', 'is', null)
      .limit(50)

    if (!scriptAnalytics?.length) return 0

    const hookPerformance: Record<string, { views: number; engagement: number; count: number }> = {}

    for (const script of scriptAnalytics) {
      const videos = Array.isArray(script.reels_videos) ? script.reels_videos : [script.reels_videos]
      for (const video of videos) {
        const analytics = Array.isArray(video.reels_analytics) ? video.reels_analytics : [video.reels_analytics]
        for (const a of analytics) {
          if (!a) continue
          const type = script.hook_type
          if (!hookPerformance[type]) {
            hookPerformance[type] = { views: 0, engagement: 0, count: 0 }
          }
          hookPerformance[type].views += a.views || 0
          hookPerformance[type].engagement += (a.likes || 0) + (a.comments || 0) + (a.shares || 0)
          hookPerformance[type].count += 1
        }
      }
    }

    let updated = 0
    for (const [hookType, perf] of Object.entries(hookPerformance)) {
      const avgEngagement = perf.count > 0 ? perf.engagement / perf.count : 0
      const performanceScore = Math.min(99, Math.round((avgEngagement / Math.max(perf.views, 1)) * 1000))

      await this.supabase
        .from('reels_hooks')
        .update({
          performance_score: performanceScore,
          times_used: perf.count,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', this.userId)
        .eq('hook_type', hookType)
        .gt('times_used', 0)

      // Update individual hook scores
      const winRate = perf.views > 0 ? Math.round((perf.engagement / perf.views) * 100 * 100) / 100 : 0
      await this.supabase
        .from('reels_hooks')
        .update({
          performance_score: performanceScore,
          win_rate: winRate,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', this.userId)
        .eq('hook_type', hookType)

      updated++
    }

    return updated
  }

  private async updateTopicScores(summary: any): Promise<number> {
    const { data: topicAnalytics } = await this.supabase
      .from('reels_scripts')
      .select(`
        topic, category,
        reels_videos!inner(
          id,
          reels_analytics(views, likes, comments, shares, engagement_rate)
        )
      `)
      .eq('user_id', this.userId)
      .not('topic', 'is', null)
      .limit(50)

    if (!topicAnalytics?.length) return 0

    const topicPerformance: Record<string, { views: number; engagement: number; count: number }> = {}

    for (const script of topicAnalytics) {
      const videos = Array.isArray(script.reels_videos) ? script.reels_videos : [script.reels_videos]
      for (const video of videos) {
        const analytics = Array.isArray(video.reels_analytics) ? video.reels_analytics : [video.reels_analytics]
        for (const a of analytics) {
          if (!a) continue
          const topic = script.topic
          if (!topicPerformance[topic]) {
            topicPerformance[topic] = { views: 0, engagement: 0, count: 0 }
          }
          topicPerformance[topic].views += a.views || 0
          topicPerformance[topic].engagement += (a.likes || 0) + (a.comments || 0) + (a.shares || 0)
          topicPerformance[topic].count += 1
        }
      }
    }

    let updated = 0
    for (const [topic, perf] of Object.entries(topicPerformance)) {
      const performanceScore = Math.min(99, Math.round((perf.engagement / Math.max(perf.views, 1)) * 1000))
      const engagementAvg = perf.count > 0 ? Math.round((perf.engagement / perf.count) * 100) / 100 : 0

      await this.supabase
        .from('reels_topic_scores')
        .upsert({
          user_id: this.userId,
          topic,
          performance_score: performanceScore,
          engagement_avg: engagementAvg,
          total_posts: perf.count,
          win_count: performanceScore > 50 ? 1 : 0,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'user_id, topic', ignoreDuplicates: false })

      updated++
    }

    return updated
  }
}
