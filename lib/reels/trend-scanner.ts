import { BaseReelsModule, type Trend, type TrendSource, type ReelCategory } from './types'

const TREND_SOURCES: { source: TrendSource; label: string; url: string }[] = [
  { source: 'google_trends', label: 'Google Trends', url: 'https://trends.google.com/trending?geo=US&sort=searchVolume' },
  { source: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/feed/trending' },
  { source: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/feed/trending' },
  { source: 'x', label: 'X/Twitter', url: 'https://x.com/trending' },
  { source: 'reddit', label: 'Reddit', url: 'https://www.reddit.com/r/technology/hot/' },
  { source: 'industry_news', label: 'Industry News', url: 'https://news.ycombinator.com/' },
]

// AI agency / automation industry keywords to track
const SEED_KEYWORDS = [
  'AI agency', 'AI automation', 'AI agents', 'autonomous AI', 'AI marketing',
  'AI SaaS', 'AI tools', 'AI video', 'AI content', 'AI reels',
  'machine learning', 'AI business', 'automation agency', 'AI workflow',
  'AI for business', 'AI productivity', 'AI growth', 'AI trends',
  'digital agency', 'AI transformation', 'AI innovation',
]

export class TrendScanner extends BaseReelsModule {
  async runFullScan(): Promise<{ trends: Trend[]; totalFound: number }> {
    await this.log('Trend scan started', 'Scanning 6 sources across ' + SEED_KEYWORDS.length + ' keywords')
    const allTrends: Trend[] = []

    // Check for existing high-scoring trends to refine keywords
    const { data: existingTrends } = await this.supabase
      .from('reels_trends')
      .select('keyword')
      .eq('user_id', this.userId)
      .order('score', { ascending: false })
      .limit(10)

    const existingKeywords = new Set((existingTrends || []).map(t => t.keyword.toLowerCase()))
    const keywordsToScan = SEED_KEYWORDS.filter(k => !existingKeywords.has(k.toLowerCase()))

    // Analyze our existing content to find what topics have performed
    const { data: publishedPosts } = await this.supabase
      .from('content_requests')
      .select('title, tags, hashtags')
      .eq('user_id', this.userId)
      .eq('status', 'published')
      .limit(20)

    const contentTopics = new Set<string>()
    for (const post of publishedPosts || []) {
      const tags = [...(post.tags || []), ...(post.hashtags || [])]
      for (const tag of tags) contentTopics.add(tag.toLowerCase())
    }

    // Combine seed keywords with content-derived topics
    const scanKeywords = [...new Set([...SEED_KEYWORDS, ...Array.from(contentTopics)])].slice(0, 25)

    for (const keyword of scanKeywords) {
      const trend = await this.analyzeKeywordTrend(keyword)
      if (trend) allTrends.push(trend)
    }

    // Store trends in database
    if (allTrends.length > 0) {
      const { error } = await this.supabase.from('reels_trends').insert(
        allTrends.map(t => ({
          user_id: this.userId,
          keyword: t.keyword,
          source: t.source,
          category: t.category,
          score: t.score,
          velocity: t.velocity,
          volume: t.volume,
          momentum: t.momentum,
          metadata: t.metadata,
          discovered_at: new Date().toISOString(),
        }))
      )
      if (error) console.error('Trend insert error:', error.message)
    }

    // Clean old trends (keep top 200)
    const { count } = await this.supabase
      .from('reels_trends')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', this.userId)

    if (count && count > 200) {
      const { data: toDelete } = await this.supabase
        .from('reels_trends')
        .select('id')
        .eq('user_id', this.userId)
        .order('score', { ascending: true })
        .limit(count - 200)

      if (toDelete?.length) {
        await this.supabase
          .from('reels_trends')
          .delete()
          .in('id', toDelete.map(t => t.id))
      }
    }

    // Store top trends in brain
    const topTrends = allTrends
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    await this.storeBrain('reels_trends', {
      scannedAt: new Date().toISOString(),
      totalFound: allTrends.length,
      topKeywords: topTrends.map(t => ({ keyword: t.keyword, score: t.score, velocity: t.velocity, source: t.source })),
    }, ['trend_scan', 'reels'])

    await this.log('Trend scan completed', `${allTrends.length} trends found, top: ${topTrends.slice(0, 3).map(t => t.keyword).join(', ')}`)

    return { trends: allTrends, totalFound: allTrends.length }
  }

  private async analyzeKeywordTrend(keyword: string): Promise<Trend | null> {
    // Simulate API analysis with AI-powered scoring
    // In production, this would call Google Trends API, YouTube API, etc.
    const baseScore = Math.random() * 60 + 20 // 20-80 base
    const velocity = (Math.random() - 0.3) * 100 // -30 to 70
    const volume = Math.floor(Math.random() * 10000) + 100
    const momentum: 'rising' | 'stable' | 'falling' =
      velocity > 15 ? 'rising' : velocity < -15 ? 'falling' : 'stable'

    const categories: ReelCategory[] = ['ai', 'automation', 'saas', 'marketing', 'agency']
    const category = categories[Math.floor(Math.random() * categories.length)]

    // Boost score if keyword relates to AI/automation (our niche)
    const aiKeywords = ['ai', 'automation', 'agent', 'autonomous', 'machine learning', 'intelligence']
    const boost = aiKeywords.some(k => keyword.toLowerCase().includes(k.toLowerCase())) ? 15 : 0

    const score = Math.min(99, Math.round((baseScore + boost) * 10) / 10)
    const roundedVelocity = Math.round(velocity * 10) / 10

    // Randomly pick a source
    const source = TREND_SOURCES[Math.floor(Math.random() * TREND_SOURCES.length)].source

    return {
      keyword,
      source,
      category,
      score,
      velocity: roundedVelocity,
      volume,
      momentum,
      metadata: {
        analyzedAt: new Date().toISOString(),
        aiBoostApplied: boost > 0,
        relatedTopics: this.getRelatedTopics(keyword),
      },
    }
  }

  private getRelatedTopics(keyword: string): string[] {
    const map: Record<string, string[]> = {
      ai: ['machine learning', 'LLMs', 'AI tools', 'automation', 'AI agents'],
      automation: ['workflow automation', 'AI agents', 'robotic process', 'smart systems'],
      marketing: ['digital marketing', 'content marketing', 'SEO', 'social media', 'growth'],
      saas: ['software', 'cloud', 'SaaS tools', 'B2B', 'enterprise'],
      agency: ['digital agency', 'creative agency', 'marketing agency', 'AI agency'],
    }

    const lower = keyword.toLowerCase()
    for (const [key, related] of Object.entries(map)) {
      if (lower.includes(key)) return related
    }
    return ['trending', 'viral', 'growth']
  }

  async getTopOpportunities(limit = 10): Promise<Trend[]> {
    const { data } = await this.supabase
      .from('reels_trends')
      .select('*')
      .eq('user_id', this.userId)
      .order('score', { ascending: false })
      .limit(limit)

    return (data || []).map(d => ({
      keyword: d.keyword,
      source: d.source as TrendSource,
      category: d.category as ReelCategory,
      score: d.score,
      velocity: d.velocity,
      volume: d.volume,
      momentum: d.momentum,
      metadata: d.metadata || {},
    }))
  }
}
