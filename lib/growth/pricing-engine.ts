import { BaseGrowthModule, type PricingModel, type PricingTier } from './types'

export class PricingEngine extends BaseGrowthModule {
  async generate(params: {
    name: string
    description?: string
    basePrice?: number
    tiers?: Partial<PricingTier>[]
    strategy?: PricingModel['strategy']
    costData?: { fixed_costs: number; variable_costs: number; target_margin: number }
  }): Promise<PricingModel> {
    await this.log('pricing_generation_started', `Generating pricing model: ${params.name}`)

    const competitorBenchmarks = await this.collectCompetitorPricing()
    const tiers = this.buildTiers(params, competitorBenchmarks)

    const { data, error } = await this.supabase.from('growth_pricing_models').insert([{
      user_id: this.userId,
      name: params.name,
      description: params.description ?? null,
      tiers: JSON.stringify(tiers),
      competitor_benchmarks: JSON.stringify(competitorBenchmarks),
      cost_data: params.costData ? JSON.stringify(params.costData) : null,
      strategy: params.strategy ?? 'value_based',
      status: 'draft',
    }]).select('*').single()

    if (error) throw new Error(`Failed to save pricing model: ${error.message}`)

    await this.storeBrain('pricing_model', {
      name: params.name,
      tiers: tiers.length,
      strategy: params.strategy,
      competitorBenchmarks: competitorBenchmarks.length,
    }, ['pricing', 'real-data'])

    await this.log('pricing_generated', `${tiers.length} tiers created from ${competitorBenchmarks.length} competitor benchmarks`)
    return data as PricingModel
  }

  async getLatest(): Promise<PricingModel | null> {
    const { data } = await this.supabase
      .from('growth_pricing_models')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return (data ?? null) as PricingModel | null
  }

  async activate(modelId: string): Promise<void> {
    await this.supabase.from('growth_pricing_models').update({
      status: 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', modelId).eq('user_id', this.userId)
  }

  private buildTiers(
    params: { basePrice?: number; tiers?: Partial<PricingTier>[]; strategy?: string },
    benchmarks: PricingModel['competitor_benchmarks']
  ): PricingTier[] {
    if (params.tiers && params.tiers.length > 0) {
      return params.tiers.map((t, i) => ({
        name: t.name ?? `Tier ${i + 1}`,
        price: t.price ?? (params.basePrice ?? 999) * (i + 1),
        currency: t.currency ?? 'USD',
        description: t.description ?? '',
        features: t.features ?? [],
        limits: t.limits ?? {},
        target_segment: t.target_segment ?? null,
      }))
    }

    const avgCompetitorPrice = benchmarks.length > 0
      ? benchmarks.reduce((s, b) => s + b.price, 0) / benchmarks.length
      : params.basePrice ?? 999

    const tiers: PricingTier[] = [
      {
        name: 'Starter',
        price: Math.round(avgCompetitorPrice * 0.4),
        currency: 'USD',
        description: 'Essential features for small teams getting started',
        features: ['Core platform access', 'Up to 5 active agents', 'Basic analytics', 'Email support'],
        limits: { agents: 5, storage_gb: 10, api_calls_per_day: 1000 },
        target_segment: 'Freelancers & Small Teams',
      },
      {
        name: 'Professional',
        price: Math.round(avgCompetitorPrice * 0.75),
        currency: 'USD',
        description: 'Advanced features for growing agencies',
        features: ['All Starter features', 'Up to 20 active agents', 'Advanced analytics & reports', 'Priority support', 'Custom integrations', 'Team collaboration'],
        limits: { agents: 20, storage_gb: 50, api_calls_per_day: 10000 },
        target_segment: 'Growing Agencies',
      },
      {
        name: 'Enterprise',
        price: Math.round(avgCompetitorPrice * 1.5),
        currency: 'USD',
        description: 'Full platform with dedicated support',
        features: ['All Professional features', 'Unlimited agents', 'Custom AI model training', 'Dedicated account manager', 'SLA guarantees', 'On-premise deployment option', 'Advanced security & compliance'],
        limits: { agents: -1, storage_gb: 500, api_calls_per_day: 100000 },
        target_segment: 'Large Agencies & Enterprises',
      },
    ]

    if (params.strategy === 'penetration') {
      for (const tier of tiers) {
        tier.price = Math.round(tier.price * 0.6)
      }
    } else if (params.strategy === 'premium') {
      for (const tier of tiers) {
        tier.price = Math.round(tier.price * 1.4)
      }
    }

    return tiers
  }

  private async collectCompetitorPricing(): Promise<PricingModel['competitor_benchmarks']> {
    const benchmarks: PricingModel['competitor_benchmarks'] = []

    const { data: snapshots } = await this.supabase
      .from('growth_competitor_snapshots')
      .select('*, growth_competitor_targets!inner(name, website)')
      .eq('growth_competitor_targets.user_id', this.userId)
      .not('pricing_mentions', 'eq', '[]')
      .order('detected_at', { ascending: false })
      .limit(20)

    for (const snap of (snapshots ?? []) as any[]) {
      const mentions = typeof snap.pricing_mentions === 'string'
        ? JSON.parse(snap.pricing_mentions)
        : snap.pricing_mentions

      for (const mention of mentions ?? []) {
        const priceMatch = mention.text?.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/)
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''))
          const tierName = mention.text?.match(/(free|basic|pro|enterprise|premium|starter|growth)/i)?.[0] ?? 'unknown'
          benchmarks.push({
            competitor: snap.growth_competitor_targets?.name ?? 'unknown',
            price,
            tier: tierName,
            url: snap.page_url,
          })
        }
      }
    }

    return benchmarks
  }
}
