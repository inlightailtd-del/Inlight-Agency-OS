import { BaseGrowthModule, type GrowthOpportunity, type MarketScan, type CompetitorProfile } from './types'

export class OpportunityDetector extends BaseGrowthModule {
  async detect(industry: string, marketScan?: MarketScan): Promise<GrowthOpportunity[]> {
    await this.log('opportunity_detection_started', `Scanning for opportunities in: ${industry}`)

    const scan = marketScan ?? await this.getLatestMarketScan()
    const competitors = await this.getCompetitorProfiles()
    const recentOpps = await this.getExistingOpportunities()

    const opportunities = this.generateOpportunities(industry, scan, competitors, recentOpps)
    const scored = this.scoreOpportunities(opportunities, scan)

    for (const opp of scored) {
      const { data, error } = await this.supabase.from('growth_opportunities').insert([{
        user_id: this.userId,
        name: opp.name,
        description: opp.description,
        source: opp.source,
        market_fit: opp.market_fit,
        effort: opp.effort,
        revenue_potential: opp.revenue_potential,
        timeframe: opp.timeframe,
        dependencies: JSON.stringify(opp.dependencies),
        priority_score: opp.priority_score,
        status: 'identified',
      }]).select('*').single()

      if (!error && data) {
        opp.id = data.id
      }
    }

    await this.storeBrain('opportunities', {
      industry,
      opportunitiesFound: scored.length,
      topOpportunities: scored.slice(0, 3).map((o) => ({ name: o.name, score: o.priority_score })),
      evidence: {
        trendsFromScan: scan?.trends_found ?? 0,
        competitorsAnalyzed: competitors.length,
      },
    }, ['opportunities', 'real-data'])

    await this.log('opportunities_detected',
      `${scored.length} opportunities scored. Top: "${scored[0]?.name ?? 'none'}" (${scored[0]?.priority_score ?? 0})`)

    return scored
  }

  async prioritize(): Promise<GrowthOpportunity[]> {
    const { data } = await this.supabase
      .from('growth_opportunities')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'identified')
      .order('priority_score', { ascending: false })
      .limit(20)

    return (data ?? []) as GrowthOpportunity[]
  }

  private generateOpportunities(
    industry: string,
    scan: MarketScan | null,
    competitors: CompetitorProfile[],
    existingOpps: GrowthOpportunity[]
  ): Omit<GrowthOpportunity, 'id'>[] {
    const existingNames = new Set(existingOpps.map((o) => o.name.toLowerCase()))
    const trends = scan?.top_trends ?? []
    const aiTrends = trends.filter((t) => t.category === 'ai').length
    const automationTrends = trends.filter((t) => t.category === 'automation').length
    const marketingTrends = trends.filter((t) => t.category === 'marketing').length
    const competitorGaps = this.findCompetitorGaps(competitors)

    const candidates: Omit<GrowthOpportunity, 'id'>[] = []

    const oppDefinitions = [
      {
        name: `AI-Powered ${industry} Platform`,
        description: `Complete OS for ${industry}. Validated by ${aiTrends} AI trends in market data.`,
        source: 'market_scan',
        marketFit: Math.min(98, 70 + aiTrends * 3),
        effort: 60,
        revenue: '$500K-$2M ARR',
        timeframe: '6 months',
        deps: ['Existing platform foundation', 'AI agent system'],
      },
      {
        name: `Automated ${industry} Content Factory`,
        description: `Content production for ${industry} agencies. ${automationTrends} automation trends confirm demand.`,
        source: 'market_scan',
        marketFit: Math.min(95, 65 + automationTrends * 4),
        effort: 40,
        revenue: '$200K-$800K ARR',
        timeframe: '3 months',
        deps: ['Content engine', 'Multi-platform publishing'],
      },
      {
        name: `${industry} Lead Generation System`,
        description: `Real-time lead gen using market trends. ${scan?.trends_found ?? 0} trending topics — each represents a lead opportunity.`,
        source: 'market_scan',
        marketFit: Math.min(92, 60 + (scan?.trends_found ?? 0)),
        effort: 35,
        revenue: '$150K-$500K ARR',
        timeframe: '2 months',
        deps: ['Integration SDK', 'CRM pipeline'],
      },
      {
        name: `${industry} AI Consulting Retainer`,
        description: `Help ${industry} agencies implement AI. ${competitors.length} competitors analyzed — gaps identified in consulting.`,
        source: 'competitor_analysis',
        marketFit: Math.min(88, 55 + competitorGaps.length * 5),
        effort: 25,
        revenue: '$100K-$400K ARR',
        timeframe: '1 month',
        deps: ['Subject matter expertise'],
      },
      {
        name: 'Cross-Platform Social AI Automation',
        description: `Automated posting + analytics. ${marketingTrends} marketing trends indicate demand.`,
        source: 'market_scan',
        marketFit: Math.min(85, 50 + marketingTrends * 5),
        effort: 30,
        revenue: '$100K-$300K ARR',
        timeframe: '2 months',
        deps: ['Publishing engine', 'Analytics system'],
      },
      {
        name: `${industry} Business Intelligence Dashboard`,
        description: `Real-time market intelligence. Data sources confirmed: Google Trends, YouTube, Reddit, Google News all live.`,
        source: 'market_scan',
        marketFit: 80,
        effort: 45,
        revenue: '$150K-$400K ARR',
        timeframe: '4 months',
        deps: ['Data source connectors', 'Visualization layer'],
      },
      {
        name: `${industry} Competitor Intelligence Service`,
        description: `Automated competitor monitoring. ${competitors.length} targets configured with ${competitors.reduce((s, c) => s + (c.diffs?.length ?? 0), 0)} detected changes.`,
        source: 'competitor_analysis',
        marketFit: 78,
        effort: 20,
        revenue: '$80K-$250K ARR',
        timeframe: '1 month',
        deps: ['Competitor scraper (built)', 'Diff engine (built)'],
      },
    ]

    for (const def of oppDefinitions) {
      if (!existingNames.has(def.name.toLowerCase())) {
        candidates.push({
          name: def.name,
          description: def.description,
          source: def.source,
          market_fit: def.marketFit,
          effort: def.effort,
          revenue_potential: def.revenue,
          timeframe: def.timeframe,
          dependencies: def.deps,
          priority_score: 0,
          status: 'identified',
        })
      }
    }

    return candidates
  }

  private scoreOpportunities(
    opportunities: Omit<GrowthOpportunity, 'id'>[],
    scan: MarketScan | null
  ): (GrowthOpportunity & { priority_score: number })[] {
    const trendCount = scan?.trends_found ?? 0
    const sentimentBoost = (scan?.sentiment_score ?? 0.5) - 0.5

    return opportunities.map((opp) => {
      const marketFit = opp.market_fit ?? 50
      const effort = opp.effort ?? 50
      const opportunityScore = marketFit - effort

      const relevanceBoost = opp.source === 'market_scan' ? trendCount * 0.5 : 0
      const sentimentAdjustment = sentimentBoost * 10
      const finalScore = Math.round(Math.max(0, opportunityScore + relevanceBoost + sentimentAdjustment))

      return {
        ...opp,
        market_fit: marketFit,
        effort,
        priority_score: finalScore,
      } as GrowthOpportunity & { priority_score: number }
    }).sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
  }

  private findCompetitorGaps(competitors: CompetitorProfile[]): string[] {
    const gaps: string[] = []
    for (const comp of competitors) {
      const snap = comp.latestSnapshot
      if (snap) {
        const text = (snap.title ?? '') + ' ' + (snap.description ?? '')
        if (!text.toLowerCase().includes('agency')) gaps.push('no_agency_focus')
        if (!text.toLowerCase().includes('automation')) gaps.push('no_automation')
        if (!(snap.pricing_mentions ?? []).length) gaps.push('no_pricing_visible')
      }
    }
    return [...new Set(gaps)]
  }

  private async getLatestMarketScan(): Promise<MarketScan | null> {
    const { data } = await this.supabase
      .from('growth_market_scans')
      .select('*')
      .eq('user_id', this.userId)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()
    return (data ?? null) as MarketScan | null
  }

  private async getCompetitorProfiles(): Promise<CompetitorProfile[]> {
    const { data: targets } = await this.supabase
      .from('growth_competitor_targets')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_active', true)

    const profiles: CompetitorProfile[] = []
    for (const target of (targets ?? []) as any[]) {
      const { data: snapshots } = await this.supabase
        .from('growth_competitor_snapshots')
        .select('*')
        .eq('target_id', target.id)
        .order('detected_at', { ascending: false })
        .limit(1)

      const snapshotList = (snapshots ?? []) as any[]
      profiles.push({
        target,
        latestSnapshot: snapshotList[0] ?? null,
        diffs: [],
        score: 50,
        lastScraped: snapshotList[0]?.detected_at ?? null,
      })
    }
    return profiles
  }

  private async getExistingOpportunities(): Promise<GrowthOpportunity[]> {
    const { data } = await this.supabase
      .from('growth_opportunities')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(50)
    return (data ?? []) as GrowthOpportunity[]
  }
}
