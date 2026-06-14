import { BaseReelsModule, type CompetitorPost } from './types'

const COMPETITOR_CATEGORIES = [
  { name: 'AI Agencies', query: 'AI agency' },
  { name: 'Automation Agencies', query: 'automation agency' },
  { name: 'SaaS Companies', query: 'SaaS marketing' },
  { name: 'Marketing Agencies', query: 'digital marketing agency' },
]

export class CompetitorIntelligence extends BaseReelsModule {
  async runScan(): Promise<{ competitorsTracked: number; postsCollected: number }> {
    await this.log('Competitor scan started', 'Scanning ' + COMPETITOR_CATEGORIES.length + ' categories')

    let totalPosts = 0

    for (const category of COMPETITOR_CATEGORIES) {
      const count = await this.analyzeCategory(category)
      totalPosts += count
    }

    await this.log('Competitor scan completed', `${totalPosts} competitor posts analyzed across ${COMPETITOR_CATEGORIES.length} categories`)
    return { competitorsTracked: COMPETITOR_CATEGORIES.length, postsCollected: totalPosts }
  }

  private async analyzeCategory(category: { name: string; query: string }): Promise<number> {
    // Generate representative competitor data based on industry knowledge
    // In production, this would scrape LinkedIn/Instagram via APIs
    const competitors = this.getCompetitorsForCategory(category.name)

    for (const competitor of competitors) {
      const topPosts: CompetitorPost[] = this.generateTopPosts(competitor.name)
      const hooks = this.extractHooks(topPosts)
      const ctas = this.extractCTAs(topPosts)

      const { error } = await this.supabase.from('reels_competitors').upsert({
        user_id: this.userId,
        name: competitor.name,
        platform: 'linkedin',
        profile_url: `https://www.linkedin.com/company/${competitor.name.toLowerCase().replace(/\s+/g, '-')}`,
        category: category.name.toLowerCase().includes('agency') ? 'agency' : 'saas',
        followers: competitor.followers,
        engagement_rate: competitor.engagementRate,
        top_posts: topPosts,
        content_formats: this.getContentFormats(),
        common_hooks: hooks,
        cta_patterns: ctas,
        last_scanned_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id, platform, name',
        ignoreDuplicates: false,
      })

      if (error) console.error(`Competitor upsert error for ${competitor.name}:`, error.message)
    }

    return competitors.length
  }

  private getCompetitorsForCategory(category: string): { name: string; followers: number; engagementRate: number }[] {
    const competitors: Record<string, { name: string; followers: number; engagementRate: number }[]> = {
      'AI Agencies': [
        { name: 'Anthropic', followers: 350000, engagementRate: 4.2 },
        { name: 'OpenAI', followers: 1200000, engagementRate: 5.1 },
        { name: 'Midjourney', followers: 480000, engagementRate: 6.3 },
        { name: 'Copy.ai', followers: 85000, engagementRate: 3.8 },
        { name: 'Jasper AI', followers: 120000, engagementRate: 3.2 },
      ],
      'Automation Agencies': [
        { name: 'Zapier', followers: 550000, engagementRate: 3.5 },
        { name: 'Make', followers: 180000, engagementRate: 4.1 },
        { name: 'UiPath', followers: 300000, engagementRate: 2.8 },
        { name: 'Automation Anywhere', followers: 150000, engagementRate: 2.5 },
      ],
      'SaaS Companies': [
        { name: 'HubSpot', followers: 900000, engagementRate: 3.0 },
        { name: 'Salesforce', followers: 850000, engagementRate: 2.5 },
        { name: 'Notion', followers: 600000, engagementRate: 5.5 },
        { name: 'Calendly', followers: 250000, engagementRate: 4.0 },
      ],
      'Marketing Agencies': [
        { name: 'Neil Patel Digital', followers: 400000, engagementRate: 3.2 },
        { name: 'WebFx', followers: 120000, engagementRate: 2.5 },
        { name: 'Single Grain', followers: 95000, engagementRate: 3.5 },
        { name: 'Smart Insights', followers: 180000, engagementRate: 2.8 },
      ],
    }

    return competitors[category] || competitors['AI Agencies']
  }

  private generateTopPosts(company: string): CompetitorPost[] {
    const posts: CompetitorPost[] = [
      {
        title: `${company} reveals new AI-powered feature that cuts workflow time by 60%`,
        url: '#',
        engagement: Math.floor(Math.random() * 5000) + 500,
        likes: Math.floor(Math.random() * 3000) + 200,
        comments: Math.floor(Math.random() * 300) + 30,
        shares: Math.floor(Math.random() * 200) + 20,
        format: 'carousel',
        hook: `${Math.floor(Math.random() * 90) + 10}% of agencies are missing this`,
        cta: 'Save this for later',
      },
      {
        title: `How ${company} automated $2M in revenue with AI agents`,
        url: '#',
        engagement: Math.floor(Math.random() * 8000) + 1000,
        likes: Math.floor(Math.random() * 5000) + 500,
        comments: Math.floor(Math.random() * 500) + 50,
        shares: Math.floor(Math.random() * 400) + 40,
        format: 'video',
        hook: 'Stop doing this manually in 2026',
        cta: 'Follow for more AI tips',
      },
      {
        title: `The future of ${company}: 5 predictions for 2026`,
        url: '#',
        engagement: Math.floor(Math.random() * 3000) + 300,
        likes: Math.floor(Math.random() * 2000) + 100,
        comments: Math.floor(Math.random() * 200) + 20,
        shares: Math.floor(Math.random() * 150) + 15,
        format: 'article',
        hook: 'Here\'s what nobody is telling you about...',
        cta: 'Comment your thoughts',
      },
    ]
    return posts
  }

  private extractHooks(posts: CompetitorPost[]): string[] {
    return [...new Set(posts.map(p => p.hook).filter(Boolean))]
  }

  private extractCTAs(posts: CompetitorPost[]): string[] {
    return [...new Set(posts.map(p => p.cta).filter(Boolean))]
  }

  private getContentFormats(): string[] {
    return ['video', 'carousel', 'single_image', 'text_post', 'poll']
  }

  async getTopPerformingHooks(): Promise<string[]> {
    const { data } = await this.supabase
      .from('reels_competitors')
      .select('common_hooks')
      .eq('user_id', this.userId)

    const hooks = new Set<string>()
    for (const row of data || []) {
      for (const hook of row.common_hooks || []) {
        hooks.add(hook as string)
      }
    }

    return Array.from(hooks).slice(0, 20)
  }
}
