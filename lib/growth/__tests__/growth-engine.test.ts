import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GrowthEngine, runFullGrowthCycle, getGrowthMetrics } from '../engine'
import { CompetitorScraper } from '../competitor-scraper'
import { MarketScanner } from '../market-scanner'
import { PricingEngine } from '../pricing-engine'
import { OfferGenerator } from '../offer-generator'
import { RevenueSimulator } from '../revenue-simulator'
import { OpportunityDetector } from '../opportunity-detector'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/ai/execution', () => ({
  executeAgentTask: vi.fn().mockResolvedValue({
    id: 'ae1', status: 'completed', response: 'Generated content',
    tokens_used: 100, duration_ms: 500,
  }),
}))
vi.mock('@/lib/ai/memory', () => ({
  storeMemory: vi.fn().mockResolvedValue([]),
}))

const userId = 'test-user-id'

function makeSupabase(overrides?: Record<string, any>): SupabaseClient {
  const chain: Record<string, any> = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    not: vi.fn(() => chain),
    match: vi.fn(() => chain),
    is: vi.fn(() => chain),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn((fn: any) => fn({ data: [], error: null })),
    ...overrides,
  }
  const from = vi.fn(() => chain)
  return { from } as unknown as SupabaseClient
}

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: () => Promise.resolve({ response: 'Mock AI response' }),
    text: () => Promise.resolve(JSON.stringify({ response: 'Mock AI response' })),
    headers: { get: () => null },
  } as any)
})

// ─── GrowthEngine ──────────────────────────────────────────────
describe('GrowthEngine', () => {
  it('constructs with supabase and userId', () => {
    const engine = new GrowthEngine(makeSupabase(), userId)
    expect(engine).toBeInstanceOf(GrowthEngine)
    expect(engine.competitor).toBeInstanceOf(CompetitorScraper)
    expect(engine.market).toBeInstanceOf(MarketScanner)
    expect(engine.pricing).toBeInstanceOf(PricingEngine)
    expect(engine.offers).toBeInstanceOf(OfferGenerator)
    expect(engine.revenue).toBeInstanceOf(RevenueSimulator)
    expect(engine.opportunities).toBeInstanceOf(OpportunityDetector)
  })

  it('runFullCycle executes all 6 phases', async () => {
    const sb = makeSupabase()
    ;(sb.from('growth_engine_runs') as any).insert.mockReturnValue({
      select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: 'run-1', status: 'running' }, error: null })) })),
    })
    const engine = new GrowthEngine(sb, userId)

    engine.market = { scan: vi.fn().mockResolvedValue({
      trends: [{ keyword: 'AI', traffic: 100, source: 'google_trends', category: 'tech', sentiment: 0.8, timestamp: new Date().toISOString() }],
      sentimentScore: 0.75, marketSize: '$1B+', growthRate: '15%',
    }) } as any
    engine.competitor = { scrapeAll: vi.fn().mockResolvedValue([{ target: { name: 'Comp A', website: 'https://comp-a.com' }, profile: { score: 7 } }]) } as any
    engine.pricing = { generate: vi.fn().mockResolvedValue({ tiers: [{ name: 'Basic', price: 99 }], strategy: 'value_based', benchmarks: [] }) } as any
    engine.opportunities = { detect: vi.fn().mockResolvedValue({ opportunities: [{ name: 'AI Chatbot', description: 'Growing demand', source: 'market_scan', marketFit: 0.85, effort: 0.4, revenuePotential: '$50K', timeframe: '3-6 months', priorityScore: 85 }] }) } as any
    engine.revenue = { simulate: vi.fn().mockResolvedValue({ scenarios: [{ name: 'Optimistic', probability: 0.2, totalRevenue: 500000, totalCost: 100000, netRevenue: 400000, breakevenMonth: 6 }], breakevenAnalysis: { averageMonth: 9 } }) } as any
    engine.offers = { generate: vi.fn().mockResolvedValue({ offers: [{ name: 'AI Package', tagline: 'Streamline', description: 'AI suite', offerType: 'bundle', targetAudience: 'SMBs', pricingTier: 'Pro', deliverables: ['AI Chatbot'], valuePropositions: ['Save time'] }] }) } as any

    const result = await engine.runFullCycle('ai')
    expect(result.status).toBe('completed')
    expect(result.phases_completed).toEqual(['market_scan', 'competitor_scrape', 'pricing', 'opportunities', 'revenue', 'offers'])
  })
})

// ─── Standalone Functions ──────────────────────────────────────
describe('runFullGrowthCycle', () => {
  it('returns contentCreated, leadsGenerated, published counts', async () => {
    // Per-table chain factory
    const tableChains = new Map<string, Record<string, any>>()
    function getChain(table: string) {
      if (!tableChains.has(table)) {
        const c: Record<string, any> = {}
        // All query-building methods return the chain itself
        const chainMethods = ['select', 'insert', 'update', 'eq', 'gte', 'lte',
          'order', 'limit', 'not', 'is', 'overlaps', 'match', 'single', 'filter']
        for (const m of chainMethods) c[m] = vi.fn(() => c)
        // Default .then makes the chain awaitable (resolves with no rows)
        c.then = vi.fn((resolve: Function) => resolve({ data: [], error: null }))
        tableChains.set(table, c)
      }
      return tableChains.get(table)!
    }
    const from = vi.fn((table: string) => getChain(table))
    const sb = { from } as unknown as SupabaseClient

    // ── content_requests ──
    const contentChain = getChain('content_requests')
    // .insert({...}).select('id').single() → used by generateDailyContent (4 calls)
    contentChain.insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'c1' }, error: null })),
      })),
      then: vi.fn((resolve: Function) => resolve({ data: [], error: null })),
    }))
    // .update({...}).eq('id', id) → used by publishScheduled
    contentChain.update = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
    }))

    // ── growth_content_calendar ──
    const calChain = getChain('growth_content_calendar')
    // .select(...).eq(...).eq(...).lte(...).limit(10) → used by publishScheduled
    calChain.select = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      then: vi.fn((resolve: Function) => resolve({ data: [], error: null })),
    }))
    // .eq('user_id', userId) standalone → used by getGrowthMetrics
    // Override after per-call setup
    calChain.eq = vi.fn(() => Promise.resolve({ data: [], error: null }))
    // .update({...}).eq('id', id)
    calChain.update = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
    }))

    // ── growth_leads ──
    const leadsChain = getChain('growth_leads')
    // .select('id, score').eq(...).is(...).limit(20) → used by generateLeads
    leadsChain.select = vi.fn(() => ({
      eq: vi.fn(() => ({
        is: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      then: vi.fn((resolve: Function) => resolve({ data: [], error: null })),
    }))
    // .eq('user_id', userId) standalone → used by getGrowthMetrics
    leadsChain.eq = vi.fn(() => Promise.resolve({ data: [], error: null }))
    // .update({...}).eq('id', id)
    leadsChain.update = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
    }))

    // ── outreach_campaigns ──
    const outreachChain = getChain('outreach_campaigns')
    outreachChain.select = vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [{ id: 'oc1' }], error: null })),
      })),
    }))

    // ── execution_logs ──
    const execChain = getChain('execution_logs')
    execChain.insert = vi.fn(() => ({
      then: vi.fn((resolve: Function) => resolve({ data: [], error: null })),
    }))

    const result = await runFullGrowthCycle(sb, userId)
    expect(result).toHaveProperty('contentCreated')
    expect(result).toHaveProperty('leadsGenerated')
    expect(result).toHaveProperty('published')
  })
})

describe('getGrowthMetrics', () => {
  it('returns aggregated metrics with defaults', async () => {
    const sb = makeSupabase()
    ;(sb.from('growth_content_calendar') as any).select.mockReturnValue({
      eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })
    ;(sb.from('growth_leads') as any).select.mockReturnValue({
      eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })
    ;(sb.from('content_requests') as any).select.mockReturnValue({
      eq: vi.fn(() => ({
        gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })
    const metrics = await getGrowthMetrics(sb, userId)
    expect(metrics.scheduledCount).toBe(0)
    expect(metrics.publishedCount).toBe(0)
    expect(metrics.leadsGenerated).toBe(0)
    expect(metrics.totalEngagement).toBe(0)
  })
})
