import { BaseBusinessModule, type ContentStrategy } from './types'
import { fetchGoogleTrends, fetchYouTubeTrending, fetchRedditTrends, storeMarketData } from './data-sources'

export class ContentStrategyEngine extends BaseBusinessModule {
  async createStrategy(industry: string): Promise<ContentStrategy> {
    await this.log('Content strategy started', 'Using real platform trend data')

    // REAL DATA: Google Trends for topic discovery
    const trends = await fetchGoogleTrends('US', 20)
    await storeMarketData(this.supabase, this.userId, 'content_trends', trends)

    // REAL DATA: YouTube for content format inspiration
    const videos = await fetchYouTubeTrending(10)
    await storeMarketData(this.supabase, this.userId, 'content_videos', videos)

    // REAL DATA: Reddit for discussion topics
    const discussions = await fetchRedditTrends(['artificial', 'technology', 'marketing'], 5)
    await storeMarketData(this.supabase, this.userId, 'content_discussions', discussions)

    // Generate topic clusters from real trend data
    const aiTopicTrends = trends.filter(t => t.category === 'ai').slice(0, 4)
    const bizTopicTrends = trends.filter(t => t.category === 'business' || t.category === 'startup').slice(0, 3)
    const techTopicTrends = trends.filter(t => t.category === 'technology').slice(0, 3)

    const topics = [
      // Pillar 1: AI & Automation
      ...aiTopicTrends.map((t, i) => ({
        topic: t.keyword,
        format: ['video', 'carousel', 'blog', 'infographic'][i % 4] as any,
        platform: i % 2 === 0 ? 'linkedin' as const : 'youtube' as const,
        frequency: 'weekly' as const,
      })),
      // Pillar 2: Business Growth
      ...bizTopicTrends.map((t, i) => ({
        topic: `${t.keyword} — AI agency perspective`,
        format: ['carousel', 'blog', 'video'][i % 3] as any,
        platform: 'linkedin' as const,
        frequency: 'biweekly' as const,
      })),
      // Pillar 3: Technology Trends
      ...techTopicTrends.map((t, i) => ({
        topic: t.keyword,
        format: ['video', 'infographic', 'blog'][i % 3] as any,
        platform: i % 2 === 0 ? 'youtube' as const : 'blog' as const,
        frequency: 'weekly' as const,
      })),
      // Viral/Reddit topics
      ...discussions.slice(0, 3).map((d, i) => ({
        topic: d.keyword,
        format: 'carousel' as const,
        platform: 'linkedin' as const,
        frequency: 'weekly' as const,
      })),
    ].slice(0, 12)

    const pillars = [
      `AI & Automation (${aiTopicTrends.length} real trends from Google Trends)`,
      `Business Growth for Agencies (based on ${bizTopicTrends.length} trending business topics)`,
      `Technology & Innovation (${videos.length} trending YouTube videos analyzed)`,
      `Community & Discussions (${discussions.length} Reddit threads analyzed)`,
    ]

    const repurposingPlan = [
      `YouTube video → LinkedIn carousel post → Twitter thread → Newsletter item`,
      `Google Trends report → Blog post → LinkedIn video → Instagram reel`,
      `Reddit discussion analysis → LinkedIn opinion post → Twitter poll → Blog deep-dive`,
      `Trending topic → 60s YouTube Short → 30s LinkedIn video → Text post with hook`,
    ]

    await this.storeBrain('content_strategy', {
      industry, strategy: { topics, pillars, repurposingPlan },
      evidence: {
        googleTrendsQueries: trends.map(t => t.keyword),
        youtubeVideos: videos.map(v => v.keyword),
        redditThreads: discussions.map(d => d.keyword),
      },
      createdAt: new Date().toISOString(),
    }, ['content', 'real-data'])

    await this.log('Content strategy created',
      `${topics.length} topics from ${trends.length} Google Trends, ${videos.length} YouTube videos, ${discussions.length} Reddit threads`)

    return { topics, pillars, repurposingPlan }
  }
}
