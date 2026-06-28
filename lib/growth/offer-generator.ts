import { BaseGrowthModule, type GrowthOffer, type MarketScan, type PricingModel } from './types'

export class OfferGenerator extends BaseGrowthModule {
  async generate(industry: string, marketScan?: MarketScan): Promise<GrowthOffer[]> {
    await this.log('offer_generation_started', `Generating offers for: ${industry}`)

    const scan = marketScan ?? await this.getLatestMarketScan()
    const pricingModel = await this.getActivePricing()
    const competitorSnapshots = await this.getCompetitorSnapshots()

    const offers: GrowthOffer[] = []

    const primaryOffer = await this.buildPrimaryOffer(industry, scan, pricingModel, competitorSnapshots)
    offers.push(primaryOffer)

    const secondaryOffers = this.buildSecondaryOffers(industry, scan, pricingModel)
    offers.push(...secondaryOffers)

    const bundleOffer = this.buildBundleOffer(industry, offers)
    offers.push(bundleOffer)

    for (const offer of offers) {
      const { data, error } = await this.supabase.from('growth_offers').insert([{
        user_id: this.userId,
        name: offer.name,
        tagline: offer.tagline,
        description: offer.description,
        offer_type: offer.offer_type,
        target_audience: offer.target_audience,
        pricing_tier: offer.pricing_tier,
        pricing_model_id: pricingModel?.id ?? null,
        deliverables: JSON.stringify(offer.deliverables),
        value_propositions: JSON.stringify(offer.value_propositions),
        evidence: JSON.stringify(offer.evidence),
        status: 'draft',
      }]).select('*').single()

      if (error) throw new Error(`Failed to save offer: ${error.message}`)
      offer.id = data.id
    }

    await this.storeBrain('offers', {
      industry, offersGenerated: offers.length,
      evidence: {
        trendsUsed: scan?.trends_found ?? 0,
        pricingModel: pricingModel?.name ?? null,
        competitorSnapshots: competitorSnapshots.length,
      },
    }, ['offers', 'real-data'])

    await this.log('offers_generated', `${offers.length} offers created for ${industry}`)
    return offers
  }

  async getActiveOffers(): Promise<GrowthOffer[]> {
    const { data } = await this.supabase
      .from('growth_offers')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    return (data ?? []) as GrowthOffer[]
  }

  private async buildPrimaryOffer(
    industry: string,
    scan: MarketScan | null,
    pricingModel: PricingModel | null,
    competitorSnapshots: any[]
  ): Promise<GrowthOffer> {
    const topTrends = (scan?.top_trends ?? []).slice(0, 3).map((t) => t.keyword).join(', ')

    const primaryTier = pricingModel?.tiers?.find((t) => t.name === 'Professional')
      ?? pricingModel?.tiers?.[1]
      ?? { name: 'Professional', price: 2499, currency: 'USD' }

    const competitorCount = competitorSnapshots.length

    return {
      id: '',
      name: `${industry} Agency OS`,
      tagline: `The complete ${industry} platform — AI-powered, fully integrated`,
      description: `An all-in-one ${industry} operating system that combines AI agents, content automation, lead generation, market intelligence, and team collaboration. Backed by real-time data from ${competitorCount} competitor analyses and ${scan?.trends_found ?? 0} market trends.`,
      offer_type: 'subscription',
      target_audience: `${industry} agencies and consultancies with 3-50 employees looking to automate operations`,
      pricing_tier: `${primaryTier.name} — ${primaryTier.currency} $${primaryTier.price}/mo`,
      pricing_model_id: pricingModel?.id ?? null,
      deliverables: [
        'Full platform access with all integrations',
        'AI agent workforce (CEO, Content, Sales, Operations)',
        'Automated daily content generation and publishing',
        'Real-time market intelligence and competitor monitoring',
        'Lead generation and automated outreach',
        'Performance analytics and monthly reports',
      ],
      value_propositions: [
        `Replace 5+ separate tools with one integrated platform`,
        `Trend-driven: Content and strategy informed by ${scan?.trends_found ?? 'real-time'} market signals`,
        `Competitor-aware: Pricing and positioning based on ${competitorCount} competitor analyses`,
        `Fully autonomous: Run daily operations with minimal human intervention`,
      ],
      evidence: {
        marketTrends: topTrends,
        competitorCount,
        pricingModelUsed: pricingModel?.name ?? null,
        marketSize: scan?.market_size ?? null,
        growthRate: scan?.growth_rate ?? null,
      },
      status: 'draft',
    }
  }

  private buildSecondaryOffers(
    industry: string,
    scan: MarketScan | null,
    pricingModel: PricingModel | null
  ): GrowthOffer[] {
    const starterTier = pricingModel?.tiers?.[0] ?? { name: 'Starter', price: 999, currency: 'USD' }

    return [
      {
        id: '',
        name: 'AI Content Factory',
        tagline: 'Never create content manually again',
        description: `Automated content production pipeline for ${industry}: trend discovery → generation → publishing → analytics. Uses real market data to inform content strategy.`,
        offer_type: 'subscription',
        target_audience: `${industry} teams producing 5+ pieces of content per week`,
        pricing_tier: `${starterTier.name} — ${starterTier.currency} $${Math.round(starterTier.price * 0.6)}/mo`,
        pricing_model_id: pricingModel?.id ?? null,
        deliverables: [
          'Daily AI-generated content calendar',
          'Multi-platform publishing (LinkedIn, Facebook, Instagram, Blog)',
          'Trend-based content suggestions from real-time market scans',
          'Performance analytics with engagement tracking',
          'Content repurposing across formats',
        ],
        value_propositions: [
          `Content driven by real ${scan?.trends_found ?? 'market'} signals — not guesswork`,
          'Automated publishing to connected social platforms',
          'Self-improving: engagement data feeds back into content strategy',
        ],
        evidence: { marketTrends: scan?.top_trends?.slice(0, 3) ?? [] },
        status: 'draft',
      },
      {
        id: '',
        name: 'Market Intelligence Suite',
        tagline: 'Know your market before your competitors do',
        description: `Real-time ${industry} market intelligence powered by Google Trends, YouTube, Reddit, Google News, and competitive website scraping. Updated every scan cycle.`,
        offer_type: 'subscription',
        target_audience: `${industry} owners and strategy teams needing market insight`,
        pricing_tier: `${starterTier.name} — ${starterTier.currency} $${Math.round(starterTier.price * 0.4)}/mo`,
        pricing_model_id: pricingModel?.id ?? null,
        deliverables: [
          'Real-time Google Trends monitoring',
          'Competitor website change detection',
          'Reddit and social media sentiment analysis',
          'Automated market opportunity reports',
          'Strategic recommendations',
        ],
        value_propositions: [
          'Data from real external APIs — not AI hallucinations',
          'Competitor intelligence from actual website scraping',
          'Trend detection before they become mainstream',
        ],
        evidence: { channels: scan?.channels_analyzed ?? [] },
        status: 'draft',
      },
    ]
  }

  private buildBundleOffer(industry: string, existingOffers: GrowthOffer[]): GrowthOffer {
    const totalPrice = existingOffers.reduce((s, o) => {
      const match = o.pricing_tier?.match(/\$(\d+(?:,\d{3})*)/)
      return s + (match ? parseFloat(match[1].replace(/,/g, '')) : 0)
    }, 0)

    return {
      id: '',
      name: `Complete ${industry} Bundle`,
      tagline: 'Everything you need to run and grow your agency',
      description: `Full suite bundle: Agency OS + Content Factory + Market Intelligence. Integrated platform with shared data, unified analytics, and cross-system automation.`,
      offer_type: 'bundle',
      target_audience: `${industry} agencies wanting an all-in-one solution`,
      pricing_tier: `Bundle — USD $${Math.round(totalPrice * 0.7)}/mo (save ${Math.round((1 - 0.7) * 100)}%)`,
      pricing_model_id: null,
      deliverables: existingOffers.flatMap((o) => o.deliverables),
      value_propositions: [
        'Integrated platform — all tools share data and context',
        'Significant savings vs individual subscriptions',
        'Single dashboard for all agency operations',
        'Priority support and onboarding',
      ],
      evidence: { bundledOffers: existingOffers.map((o) => o.name) },
      status: 'draft',
    }
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

  private async getActivePricing(): Promise<PricingModel | null> {
    const { data } = await this.supabase
      .from('growth_pricing_models')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return (data ?? null) as PricingModel | null
  }

  private async getCompetitorSnapshots(): Promise<any[]> {
    const { data } = await this.supabase
      .from('growth_competitor_snapshots')
      .select('*, growth_competitor_targets!inner(name)')
      .eq('growth_competitor_targets.user_id', this.userId)
      .order('detected_at', { ascending: false })
      .limit(20)
    return data ?? []
  }
}
