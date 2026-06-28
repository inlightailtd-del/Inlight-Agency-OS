import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'

export interface CompetitorTarget {
  id: string
  user_id: string
  name: string
  website: string
  pages: string[]
  industry: string | null
  is_active: boolean
  notes: string | null
}

export interface CompetitorSnapshot {
  id: string
  target_id: string
  page_url: string
  title: string | null
  description: string | null
  headings: string[]
  pricing_mentions: { text: string; context: string }[]
  feature_mentions: { text: string; category: string }[]
  cta_text: string | null
  raw_text_sample: string | null
  detected_at: string
}

export interface CompetitorDiff {
  id: string
  target_id: string
  previous_snapshot_id: string
  current_snapshot_id: string
  changes: { field: string; from: string; to: string; significance: string }[]
  significance: 'low' | 'medium' | 'high'
  detected_at: string
}

export interface CompetitorProfile {
  target: CompetitorTarget
  latestSnapshot: CompetitorSnapshot | null
  diffs: CompetitorDiff[]
  score: number
  lastScraped: string | null
}

export interface TrendItem {
  keyword: string
  traffic: string
  source: string
  category: string
  sentiment: number
  timestamp: string
}

export interface MarketScan {
  id: string
  industry: string | null
  niche: string | null
  trends_found: number
  top_trends: TrendItem[]
  sentiment_score: number | null
  market_size: string | null
  growth_rate: string | null
  channels_analyzed: { name: string; effectiveness: number; description: string }[]
  scanned_at: string
}

export interface PricingTier {
  name: string
  price: number
  currency: string
  description: string
  features: string[]
  limits: Record<string, any>
  target_segment: string | null
}

export interface PricingModel {
  id: string
  name: string
  description: string | null
  tiers: PricingTier[]
  competitor_benchmarks: { competitor: string; price: number; tier: string; url: string }[]
  cost_data: { fixed_costs: number; variable_costs: number; target_margin: number } | null
  strategy: 'cost_plus' | 'value_based' | 'competitor_based' | 'penetration' | 'premium'
  status: 'draft' | 'active' | 'archived'
}

export interface GrowthOffer {
  id: string
  name: string
  tagline: string | null
  description: string | null
  offer_type: 'product' | 'service' | 'bundle' | 'subscription' | 'consultation'
  target_audience: string | null
  pricing_tier: string | null
  pricing_model_id: string | null
  deliverables: string[]
  value_propositions: string[]
  evidence: Record<string, any>
  status: 'draft' | 'active' | 'archived'
}

export interface RevenueScenario {
  name: string
  probability: number
  monthly: { month: number; leads: number; conversions: number; revenue: number; cost: number }[]
  total_revenue: number
  total_cost: number
  net_revenue: number
  breakeven_month: number | null
}

export interface RevenueSimulation {
  id: string
  name: string | null
  scenarios: RevenueScenario[]
  assumptions: {
    base_leads: number
    conversion_rate: number
    avg_deal_size: number
    monthly_growth: number
    monthly_cost: number
    seasonality: Record<string, number>
  }
  channel_breakdown: { channel: string; cost: number; expected_leads: number; roi: number }[]
  breakeven_analysis: { optimistic: number | null; realistic: number | null; conservative: number | null }
}

export interface GrowthOpportunity {
  id: string
  name: string
  description: string | null
  source: string
  market_fit: number | null
  effort: number | null
  revenue_potential: string | null
  timeframe: string | null
  dependencies: string[]
  priority_score: number | null
  status: 'identified' | 'evaluating' | 'planned' | 'in_progress' | 'completed' | 'dismissed'
}

export interface GrowthEngineRun {
  id: string
  status: 'running' | 'completed' | 'failed'
  phases_completed: string[]
  competitors_scraped: number
  trends_detected: number
  pricing_generated: boolean
  offers_generated: number
  simulations_run: number
  opportunities_found: number
  errors: string[]
  summary: string | null
  started_at: string
  completed_at: string | null
}

export abstract class BaseGrowthModule {
  protected supabase: SupabaseClient
  protected userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  protected async log(action: string, message: string, status = 'success') {
    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: `[GrowthEngine] ${action}`, module: 'growth', status, message,
    }])
  }

  protected async storeBrain(
    category: string,
    content: Record<string, any>,
    tags: string[]
  ) {
    await storeMemory(this.supabase, this.userId, {
      category: `growth_${category}`,
      content,
      tags: ['growth', ...tags],
    })
  }
}

export const INDUSTRY_CATEGORIES: Record<string, { size: string; growth: string }> = {
  ai: { size: '$57B (2025) → $297B (2027)', growth: '37.3% CAGR' },
  automation: { size: '$28B (2025) → $62B (2028)', growth: '22.5% CAGR' },
  saas: { size: '$230B (2025) → $340B (2027)', growth: '18.5% CAGR' },
  marketing: { size: '$65B (2025) → $96B (2028)', growth: '13.8% CAGR' },
  agency: { size: '$350B (2025) → $480B (2028)', growth: '11.2% CAGR' },
  development: { size: '$150B (2025) dev tools', growth: '20% CAGR' },
  design: { size: '$45B (2025) design tools', growth: '15% CAGR' },
  finance: { size: '$200B (2025) fintech', growth: '25% CAGR' },
  general: { size: '$100B+ addressable', growth: '15% estimated' },
}
