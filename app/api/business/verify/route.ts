import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { MarketIntelligenceEngine } from '@/lib/business/market-intelligence'
import { CompetitorIntelligenceEngine } from '@/lib/business/competitor-intelligence'
import { OpportunityDetectionEngine } from '@/lib/business/opportunity-detection'
import { OfferGenerationEngine } from '@/lib/business/offer-generation'
import { WebsiteStrategyEngine } from '@/lib/business/website-strategy'
import { ContentStrategyEngine } from '@/lib/business/content-strategy'
import { RevenueEngine } from '@/lib/business/revenue-engine'
import { BusinessLearningEngine } from '@/lib/business/learning-engine'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const start = Date.now()
    const results: Record<string, any> = {}

    // Clean old business data
    const { data: old } = await supabase.from('agent_memory').select('id').filter('category', 'ilike', 'business%')
    if (old?.length) for (const o of old) await supabase.from('agent_memory').delete().eq('id', o.id)

    // M1
    try {
      const mi = new MarketIntelligenceEngine(supabase, user.id)
      const m1 = await mi.analyze('AI Agency')
      results.m1 = { status: 'OK', data: { trends: m1.trends?.length, size: m1.marketSize, growth: m1.growthRate } }
    } catch(e: any) { results.m1 = { status: 'ERROR', error: e.message } }

    // M2
    try {
      const ci = new CompetitorIntelligenceEngine(supabase, user.id)
      const m2 = await ci.analyze('AI Agency')
      results.m2 = { status: 'OK', data: { competitors: m2.competitors?.length, gaps: m2.gaps?.length, advantages: m2.advantages?.length } }
    } catch(e: any) { results.m2 = { status: 'ERROR', error: e.message } }

    // M3
    try {
      const od = new OpportunityDetectionEngine(supabase, user.id)
      const m3 = await od.detect('AI Agency')
      results.m3 = { status: 'OK', data: { count: m3.length, top3: m3.slice(0,3).map(o => ({ name: o.name, fit: o.marketFit, rev: o.revenue })) } }
    } catch(e: any) { results.m3 = { status: 'ERROR', error: e.message } }

    // M4
    try {
      const og = new OfferGenerationEngine(supabase, user.id)
      const m4 = await og.generate('AI Agency')
      results.m4 = { status: 'OK', data: { count: m4.length, offers: m4.map(o => ({ name: o.name, pricing: o.pricing })) } }
    } catch(e: any) { results.m4 = { status: 'ERROR', error: e.message } }

    // M5
    try {
      const ws = new WebsiteStrategyEngine(supabase, user.id)
      const m5 = await ws.createStrategy('AI Agency', 'AI Agency')
      results.m5 = { status: 'OK', data: { pages: m5.structure?.length, names: m5.structure?.map(p => p.page) } }
    } catch(e: any) { results.m5 = { status: 'ERROR', error: e.message } }

    // M6
    try {
      const cs = new ContentStrategyEngine(supabase, user.id)
      const m6 = await cs.createStrategy('AI Agency')
      results.m6 = { status: 'OK', data: { topics: m6.topics?.length, pillars: m6.pillars?.slice(0,3) } }
    } catch(e: any) { results.m6 = { status: 'ERROR', error: e.message } }

    // M7
    try {
      const rev = new RevenueEngine(supabase, user.id)
      const m7 = await rev.project('AI Agency')
      const total = m7.monthlyProjection?.reduce((s: number, m: any) => s + (m.revenue || 0), 0) || 0
      results.m7 = { status: 'OK', data: { months: m7.monthlyProjection?.length, totalRev: total, breakEven: m7.breakEven } }
    } catch(e: any) { results.m7 = { status: 'ERROR', error: e.message } }

    // M8
    try {
      const learn = new BusinessLearningEngine(supabase, user.id)
      const m8 = await learn.extractLessons({ market: true, competitors: true, opportunities: 5, offers: 3, website: true, content: true, revenue: true }, 'AI Agency')
      results.m8 = { status: 'OK', data: { lessons: m8.lessonsStored, recommendations: m8.recommendations?.slice(0,3) } }
    } catch(e: any) { results.m8 = { status: 'ERROR', error: e.message } }

    // DB proof
    const [db1, db2, db3, db4, db5, db6, db7, db8] = await Promise.all([
      supabase.from('agent_memory').select('id,created_at').filter('category', 'eq', 'business_market_intelligence').order('created_at', { ascending: false }).limit(1),
      supabase.from('agent_memory').select('id,created_at').filter('category', 'eq', 'business_competitor_intelligence').order('created_at', { ascending: false }).limit(1),
      supabase.from('agent_memory').select('id,created_at').filter('category', 'eq', 'business_opportunities').order('created_at', { ascending: false }).limit(1),
      supabase.from('agent_memory').select('id,created_at').filter('category', 'eq', 'business_offers').order('created_at', { ascending: false }).limit(1),
      supabase.from('agent_memory').select('id,created_at').filter('category', 'eq', 'business_website_strategy').order('created_at', { ascending: false }).limit(1),
      supabase.from('agent_memory').select('id,created_at').filter('category', 'eq', 'business_content_strategy').order('created_at', { ascending: false }).limit(1),
      supabase.from('agent_memory').select('id,created_at').filter('category', 'eq', 'business_revenue_projection').order('created_at', { ascending: false }).limit(1),
      supabase.from('agent_memory').select('id,created_at').filter('category', 'eq', 'business_lesson').order('created_at', { ascending: false }).limit(1),
    ])

    // Log proof
    const [l1, l2, l3, l4, l5, l6, l7, l8] = await Promise.all([
      supabase.from('execution_logs').select('status,message,created_at').filter('action', 'ilike', '%[BusinessGrowth] Market%').order('created_at', { ascending: false }).limit(1),
      supabase.from('execution_logs').select('status,message,created_at').filter('action', 'ilike', '%[BusinessGrowth] Competitor%').order('created_at', { ascending: false }).limit(1),
      supabase.from('execution_logs').select('status,message,created_at').filter('action', 'ilike', '%[BusinessGrowth] Opportunity%').order('created_at', { ascending: false }).limit(1),
      supabase.from('execution_logs').select('status,message,created_at').filter('action', 'ilike', '%[BusinessGrowth] Offer%').order('created_at', { ascending: false }).limit(1),
      supabase.from('execution_logs').select('status,message,created_at').filter('action', 'ilike', '%[BusinessGrowth] Website%').order('created_at', { ascending: false }).limit(1),
      supabase.from('execution_logs').select('status,message,created_at').filter('action', 'ilike', '%[BusinessGrowth] Content%').order('created_at', { ascending: false }).limit(1),
      supabase.from('execution_logs').select('status,message,created_at').filter('action', 'ilike', '%[BusinessGrowth] Revenue%').order('created_at', { ascending: false }).limit(1),
      supabase.from('execution_logs').select('status,message,created_at').filter('action', 'ilike', '%[BusinessGrowth] lesson%').order('created_at', { ascending: false }).limit(1),
    ])

    const durationMs = Date.now() - start

    return NextResponse.json({
      durationMs,
      modules: results,
      database: {
        market_intelligence: db1.data?.[0]?.id ? 'ROW EXISTS' : 'MISSING',
        competitor_intelligence: db2.data?.[0]?.id ? 'ROW EXISTS' : 'MISSING',
        opportunities: db3.data?.[0]?.id ? 'ROW EXISTS' : 'MISSING',
        offers: db4.data?.[0]?.id ? 'ROW EXISTS' : 'MISSING',
        website_strategy: db5.data?.[0]?.id ? 'ROW EXISTS' : 'MISSING',
        content_strategy: db6.data?.[0]?.id ? 'ROW EXISTS' : 'MISSING',
        revenue_projection: db7.data?.[0]?.id ? 'ROW EXISTS' : 'MISSING',
        business_lessons: db8.data?.[0]?.id ? 'ROW EXISTS' : 'MISSING',
      },
      logs: {
        market: l1.data?.[0]?.status || 'MISSING',
        competitor: l2.data?.[0]?.status || 'MISSING',
        opportunity: l3.data?.[0]?.status || 'MISSING',
        offers: l4.data?.[0]?.status || 'MISSING',
        website: l5.data?.[0]?.status || 'MISSING',
        content: l6.data?.[0]?.status || 'MISSING',
        revenue: l7.data?.[0]?.status || 'MISSING',
        learning: l8.data?.[0]?.status || 'MISSING',
      },
      scorecard: {
        m1_market_intelligence: (results.m1?.status === 'OK' && db1.data?.[0]?.id && l1.data?.[0]?.status) ? 'READY' : 'PARTIAL',
        m2_competitor_intelligence: (results.m2?.status === 'OK' && db2.data?.[0]?.id && l2.data?.[0]?.status) ? 'READY' : 'PARTIAL',
        m3_opportunity_detection: (results.m3?.status === 'OK' && db3.data?.[0]?.id && l3.data?.[0]?.status) ? 'READY' : 'PARTIAL',
        m4_offer_generation: (results.m4?.status === 'OK' && db4.data?.[0]?.id && l4.data?.[0]?.status) ? 'READY' : 'PARTIAL',
        m5_website_strategy: (results.m5?.status === 'OK' && db5.data?.[0]?.id && l5.data?.[0]?.status) ? 'READY' : 'PARTIAL',
        m6_content_strategy: (results.m6?.status === 'OK' && db6.data?.[0]?.id && l6.data?.[0]?.status) ? 'READY' : 'PARTIAL',
        m7_revenue_engine: (results.m7?.status === 'OK' && db7.data?.[0]?.id && l7.data?.[0]?.status) ? 'READY' : 'PARTIAL',
        m8_business_learning: (results.m8?.status === 'OK' && db8.data?.[0]?.id) ? 'READY' : 'PARTIAL',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
