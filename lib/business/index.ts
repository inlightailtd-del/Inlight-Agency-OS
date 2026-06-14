import type { SupabaseClient } from '@supabase/supabase-js'
import { MarketIntelligenceEngine } from './market-intelligence'
import { CompetitorIntelligenceEngine } from './competitor-intelligence'
import { OpportunityDetectionEngine } from './opportunity-detection'
import { OfferGenerationEngine } from './offer-generation'
import { WebsiteStrategyEngine } from './website-strategy'
import { ContentStrategyEngine } from './content-strategy'
import { RevenueEngine } from './revenue-engine'
import { BusinessLearningEngine } from './learning-engine'
import { type BusinessCycleResult } from './types'

export class BusinessGrowthOrchestrator {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async runFullCycle(industry: string, niche?: string): Promise<BusinessCycleResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const cycleId = `biz-cycle-${Date.now()}`

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[BusinessGrowth] Cycle started', module: 'business', status: 'running',
      message: `Industry: ${industry}${niche ? ` / ${niche}` : ''} — using real external data sources`,
    }])

    // Phase 1: Market Intelligence (Google Trends + YouTube + Reddit)
    let market = null
    try {
      const mi = new MarketIntelligenceEngine(this.supabase, this.userId)
      market = await mi.analyze(industry, niche)
    } catch (e: any) { errors.push(`Market: ${e.message}`) }

    // Phase 2: Competitor Intelligence (website scraping + LinkedIn)
    let competitors = null
    try {
      const ci = new CompetitorIntelligenceEngine(this.supabase, this.userId)
      competitors = await ci.analyze(industry)
    } catch (e: any) { errors.push(`Competitors: ${e.message}`) }

    // Phase 3: Opportunity Detection (Google Trends + Reddit + YouTube)
    let opportunities: any[] = []
    try {
      const od = new OpportunityDetectionEngine(this.supabase, this.userId)
      opportunities = await od.detect(industry)
    } catch (e: any) { errors.push(`Opportunities: ${e.message}`) }

    // Phase 4: Offer Generation (competitor pricing scraping + integration data)
    let offers: any[] = []
    try {
      const og = new OfferGenerationEngine(this.supabase, this.userId)
      offers = await og.generate(industry)
    } catch (e: any) { errors.push(`Offers: ${e.message}`) }

    // Phase 5: Website Strategy (competitor structure scraping + Google Trends SEO)
    let websiteStrategy = null
    try {
      const ws = new WebsiteStrategyEngine(this.supabase, this.userId)
      websiteStrategy = await ws.createStrategy(industry + (niche ? ` ${niche}` : ''), industry)
    } catch (e: any) { errors.push(`Website: ${e.message}`) }

    // Phase 6: Content Strategy (Google Trends + YouTube + Reddit)
    let contentStrategy = null
    try {
      const cs = new ContentStrategyEngine(this.supabase, this.userId)
      contentStrategy = await cs.createStrategy(industry)
    } catch (e: any) { errors.push(`Content: ${e.message}`) }

    // Phase 7: Revenue Projection (competitor pricing + actual lead data)
    let revenue = null
    try {
      const re = new RevenueEngine(this.supabase, this.userId)
      revenue = await re.project(industry)
    } catch (e: any) { errors.push(`Revenue: ${e.message}`) }

    // Phase 8: Learning
    let lessonsStored = 0
    try {
      const bl = new BusinessLearningEngine(this.supabase, this.userId)
      const result = await bl.extractLessons({
        market: !!market, competitors: !!competitors, opportunities: opportunities.length,
        offers: offers.length, website: !!websiteStrategy, content: !!contentStrategy, revenue: !!revenue,
      }, industry)
      lessonsStored = result.lessonsStored
    } catch (e: any) { errors.push(`Learning: ${e.message}`) }

    const durationMs = Date.now() - startTime
    const topOpps = opportunities.slice(0, 3).map((o: any) => o.name).join(', ')

    const summary = [
      `Market: ${industry}`,
      `Trends: ${market?.trends?.length || 0} (Google Trends + YouTube + Reddit)`,
      `Competitors: ${(competitors as any)?.competitors?.length || 0} (web scraped)`,
      `Opportunities: ${opportunities.length} (${topOpps})`,
      `Offers: ${offers.length} (priced from competitor data)`,
      `Website Pages: ${(websiteStrategy as any)?.structure?.length || 0}`,
      `Content Topics: ${(contentStrategy as any)?.topics?.length || 0}`,
      `Lessons: ${lessonsStored}`,
      `Errors: ${errors.length}`,
      `${(durationMs / 1000).toFixed(1)}s`,
    ].join(' | ')

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[BusinessGrowth] Cycle completed', module: 'business',
      status: errors.length > 0 ? 'failed' : 'success', message: summary,
    }])

    return {
      cycleId, market, competitors, opportunities, offers,
      websiteStrategy, contentStrategy, revenue, lessonsStored, errors, summary,
    }
  }
}
