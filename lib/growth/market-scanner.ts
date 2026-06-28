import { BaseGrowthModule, type MarketScan, type TrendItem, INDUSTRY_CATEGORIES } from './types'

export class MarketScanner extends BaseGrowthModule {
  async scan(industry?: string, niche?: string): Promise<MarketScan> {
    await this.log('market_scan_started', `Scanning: ${industry ?? 'general'}${niche ? ` / ${niche}` : ''}`)

    const [googleTrends, redditTrends, youtubeTrends, googleNews] = await Promise.all([
      this.fetchGoogleTrends(),
      this.fetchRedditTrends(),
      this.fetchYouTubeTrending(),
      this.fetchGoogleNews(industry),
    ])

    const allTrends: TrendItem[] = [
      ...googleTrends, ...redditTrends, ...youtubeTrends, ...googleNews,
    ].filter((t) => t.keyword.length > 3)

    const categorized = this.categorizeTrends(allTrends)
    const sentimentScore = this.computeSentiment(allTrends)
    const channels = this.analyzeChannels(googleTrends, youtubeTrends, redditTrends, googleNews)
    const marketInfo = this.getMarketInfo(industry)

    const topTrends = categorized.slice(0, 15)

    const { data, error } = await this.supabase.from('growth_market_scans').insert([{
      user_id: this.userId,
      industry: industry ?? null,
      niche: niche ?? null,
      trends_found: allTrends.length,
      top_trends: JSON.stringify(topTrends),
      sentiment_score: sentimentScore,
      market_size: marketInfo.size,
      growth_rate: marketInfo.growth,
      channels_analyzed: JSON.stringify(channels),
      scan_source: 'full',
    }]).select('*').single()

    if (error) throw new Error(`Failed to save market scan: ${error.message}`)

    await this.storeBrain('market_scan', {
      industry, niche,
      trendsFound: allTrends.length,
      topTrends: topTrends.slice(0, 5),
      sentimentScore,
      channels,
      scannedAt: new Date().toISOString(),
    }, ['market', 'real-data'])

    await this.log('market_scan_completed',
      `${allTrends.length} trends found (Google:${googleTrends.length}, Reddit:${redditTrends.length}, YouTube:${youtubeTrends.length}, News:${googleNews.length})`)

    return data as MarketScan
  }

  async getLatestScan(): Promise<MarketScan | null> {
    const { data } = await this.supabase
      .from('growth_market_scans')
      .select('*')
      .eq('user_id', this.userId)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()
    return (data ?? null) as MarketScan | null
  }

  private async fetchGoogleTrends(): Promise<TrendItem[]> {
    try {
      const r = await fetch('https://trends.google.com/trending/rss?geo=US', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      })
      const xml = await r.text()
      const items: TrendItem[] = []
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let m
      while ((m = itemRegex.exec(xml)) !== null) {
        const title = m[1].match(/<title>([^<]*)<\/title>/)?.[1]
        const traffic = m[1].match(/<ht:approx_traffic>([^<]*)<\/ht:approx_traffic>/)?.[1] ?? ''
        if (title) {
          items.push({
            keyword: title,
            traffic: traffic.replace('+', '').trim(),
            source: 'google_trends',
            category: this.inferCategory(title),
            sentiment: 0,
            timestamp: new Date().toISOString(),
          })
        }
      }
      return items
    } catch { return [] }
  }

  private async fetchRedditTrends(): Promise<TrendItem[]> {
    const subreddits = ['artificial', 'technology', 'Entrepreneur', 'startups', 'marketing', 'SaaS', 'agency']
    const items: TrendItem[] = []
    for (const sub of subreddits) {
      try {
        const r = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        })
        if (!r.ok) continue
        const data = await r.json()
        for (const child of data?.data?.children?.slice(0, 3) ?? []) {
          const post = child.data
          if (post?.title) {
            items.push({
              keyword: post.title,
              traffic: `${post.ups ?? 0} upvotes, ${post.num_comments ?? 0} comments`,
              source: `reddit_r_${sub}`,
              category: this.inferCategory(post.title),
              sentiment: post.ups > 0 ? Math.min(1, post.ups / 100) : 0,
              timestamp: new Date().toISOString(),
            })
          }
        }
      } catch { /* continue */ }
    }
    return items
  }

  private async fetchYouTubeTrending(): Promise<TrendItem[]> {
    try {
      const r = await fetch('https://www.youtube.com/feed/trending?hl=en', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      })
      const html = await r.text()
      const items: TrendItem[] = []
      const initMatch = html.match(/ytInitialData\s*=\s*({[\s\S]*?});\s*<\/script>/)
      if (initMatch) {
        try {
          const data = JSON.parse(initMatch[1])
          const contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents ?? []
          for (const item of contents) {
            const video = item?.richItemRenderer?.content?.videoRenderer
            const title = video?.title?.runs?.[0]?.text
            if (title && items.length < 15) {
              items.push({
                keyword: title,
                traffic: video?.viewCountText?.simpleText ?? '',
                source: 'youtube_trending',
                category: this.inferCategory(title),
                sentiment: 0,
                timestamp: new Date().toISOString(),
              })
            }
          }
        } catch { /* fallback below */ }
      }
      if (items.length === 0) {
        const titles = html.match(/"text":"([^"]+)"[^}]*"webCommandMetadata/g) ?? []
        for (const t of titles.slice(0, 10)) {
          const text = t.match(/"text":"([^"]+)"/)?.[1]
          if (text && !text.match(/^(Home|Shorts|Subscriptions|Library)/)) {
            items.push({
              keyword: text, traffic: '', source: 'youtube_trending',
              category: this.inferCategory(text), sentiment: 0,
              timestamp: new Date().toISOString(),
            })
          }
        }
      }
      return items
    } catch { return [] }
  }

  private async fetchGoogleNews(industry?: string): Promise<TrendItem[]> {
    try {
      const query = industry ? encodeURIComponent(industry) : 'technology+business+AI'
      const r = await fetch(
        `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      )
      const xml = await r.text()
      const items: TrendItem[] = []
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let m
      while ((m = itemRegex.exec(xml)) !== null && items.length < 10) {
        const title = m[1].match(/<title>([^<]*)<\/title>/)?.[1]
        if (title) {
          items.push({
            keyword: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
            traffic: 'news',
            source: 'google_news',
            category: this.inferCategory(title),
            sentiment: 0,
            timestamp: new Date().toISOString(),
          })
        }
      }
      return items
    } catch { return [] }
  }

  private categorizeTrends(trends: TrendItem[]): TrendItem[] {
    const categoryOrder: Record<string, number> = {
      ai: 0, automation: 1, saas: 2, marketing: 3,
      business: 4, agency: 5, startup: 6, technology: 7, general: 8,
    }
    return trends.sort((a, b) => {
      const catDiff = (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9)
      if (catDiff !== 0) return catDiff
      return parseInt(b.traffic.replace(/\D/g, '')) - parseInt(a.traffic.replace(/\D/g, '')) || 0
    })
  }

  private computeSentiment(trends: TrendItem[]): number {
    if (trends.length === 0) return 0
    const keywords: [RegExp, number][] = [
      [/(grow|expand|launch|breakthrough|record|surge|opportunity)/gi, 0.3],
      [/(innovate|disrupt|transform|revolutionize)/gi, 0.2],
      [/(decline|shrink|slow|struggl|fail|loss)/gi, -0.3],
      [/(uncertain|risk|challeng|concern|threat)/gi, -0.2],
    ]
    let score = 0.5
    let matches = 0
    for (const t of trends) {
      for (const [pattern, delta] of keywords) {
        if (pattern.test(t.keyword)) {
          score += delta
          matches++
        }
      }
    }
    return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100
  }

  private analyzeChannels(
    google: TrendItem[], youtube: TrendItem[],
    reddit: TrendItem[], news: TrendItem[]
  ): { name: string; effectiveness: number; description: string }[] {
    return [
      {
        name: 'Google Trends',
        effectiveness: Math.min(95, 60 + google.length * 3),
        description: `${google.length} trending queries detected`,
      },
      {
        name: 'YouTube',
        effectiveness: Math.min(90, 50 + youtube.length * 3),
        description: `${youtube.length} trending videos analyzed`,
      },
      {
        name: 'Reddit',
        effectiveness: Math.min(85, 45 + reddit.length * 3),
        description: `${reddit.length} discussions across ${new Set(reddit.map((t) => t.source)).size} subreddits`,
      },
      {
        name: 'Google News',
        effectiveness: Math.min(80, 40 + news.length * 4),
        description: `${news.length} relevant news articles`,
      },
    ]
  }

  private getMarketInfo(industry?: string | null): { size: string; growth: string } {
    if (!industry) return INDUSTRY_CATEGORIES.general
    const lower = industry.toLowerCase()
    for (const [key, info] of Object.entries(INDUSTRY_CATEGORIES)) {
      if (lower.includes(key)) return info
    }
    return INDUSTRY_CATEGORIES.general
  }

  private inferCategory(text: string): string {
    const lower = text.toLowerCase()
    if (/\b(ai|artificial intelligence|machine learning|llm|gpt|neural|deep learning|langchain|openai|claude)\b/.test(lower)) return 'ai'
    if (/\b(automation|workflow|robotic|rpa|auto\b|pipeline|orchestrat)\b/.test(lower)) return 'automation'
    if (/\b(saas|software|app|platform|api|cloud|subscription)\b/.test(lower)) return 'saas'
    if (/\b(marketing|seo|content|social media|brand|advert|campaign)\b/.test(lower)) return 'marketing'
    if (/\b(agency|consulting|service|client|firm|digital agency)\b/.test(lower)) return 'agency'
    if (/\b(startup|venture|funding|investor|pitch|seed|founder)\b/.test(lower)) return 'startup'
    if (/\b(business|growth|scale|revenue|profit|lead|sales)\b/.test(lower)) return 'business'
    if (/\b(tech|digital|transform|innovate|developer|engineering)\b/.test(lower)) return 'technology'
    return 'general'
  }
}
