import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'

export interface MarketIntelligence {
  industry: string
  marketSize: string
  growthRate: string
  trends: { trend: string; impact: 'high' | 'medium' | 'low'; description: string }[]
  customerProfile: { segment: string; painPoints: string[]; budget: string }[]
  channels: { name: string; effectiveness: number; description: string }[]
}

export interface CompetitorIntelligence {
  competitors: { name: string; marketShare: string; strengths: string[]; weaknesses: string[]; pricing: string; positioning: string }[]
  gaps: string[]
  advantages: string[]
}

export interface Opportunity {
  name: string
  description: string
  marketFit: number
  effort: number
  revenue: string
  timeframe: string
  dependencies: string[]
}

export interface Offer {
  name: string
  tagline: string
  description: string
  targetAudience: string
  pricing: string
  deliverables: string[]
  valuePropositions: string[]
}

export interface WebsiteStrategy {
  structure: { page: string; purpose: string; sections: string[] }[]
  seoStrategy: string[]
  conversionGoals: string[]
  copyTone: string
}

export interface ContentStrategy {
  topics: { topic: string; format: string; platform: string; frequency: string }[]
  pillars: string[]
  repurposingPlan: string[]
}

export interface RevenueProjection {
  monthlyProjection: { month: number; leads: number; conversions: number; revenue: number }[]
  channels: { channel: string; cost: number; expectedLeads: number; roi: number }[]
  breakEven: string
}

export interface BusinessCycleResult {
  cycleId: string
  market: MarketIntelligence | null
  competitors: CompetitorIntelligence | null
  opportunities: Opportunity[]
  offers: Offer[]
  websiteStrategy: WebsiteStrategy | null
  contentStrategy: ContentStrategy | null
  revenue: RevenueProjection | null
  lessonsStored: number
  errors: string[]
  summary: string
}

export abstract class BaseBusinessModule {
  protected supabase: SupabaseClient
  protected userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  protected async log(action: string, message: string, status = 'success') {
    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: `[BusinessGrowth] ${action}`, module: 'business', status, message,
    }])
  }

  protected async storeBrain(category: string, content: Record<string, any>, tags: string[]) {
    await storeMemory(this.supabase, this.userId, {
      category: `business_${category}`, content, tags: ['business', ...tags],
    })
  }
}
