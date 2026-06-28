import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { GrowthEngine } from '@/lib/growth/engine'
import { generateDailyContent, generateLeads, publishScheduled } from '@/lib/growth/engine'

export interface CmoReport {
  summary: string
  contentPerformance: string
  campaignInsights: string[]
  channelRecommendations: string[]
  budgetOptimizations: string[]
  metrics: CmoMetrics
}

export interface CmoMetrics {
  totalContentPieces: number
  publishedThisWeek: number
  scheduledContent: number
  activeCampaigns: number
  totalReach: number
  engagementRate: number
  leadConversionRate: number
}

export class CmoAgent {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async assessMarketingPerformance(): Promise<CmoReport> {
    const start = Date.now()
    const metrics = await this.gatherMetrics()

    const systemPrompt = `You are the CMO of an AI-powered digital agency.
Review the marketing performance and provide:
1. Executive marketing summary
2. Content performance analysis
3. Campaign insights
4. Channel recommendations
5. Budget optimization suggestions

Format as JSON:
{
  "summary": "2-3 sentence marketing assessment",
  "contentPerformance": "analysis of content effectiveness",
  "campaignInsights": ["insight1", "insight2"],
  "channelRecommendations": ["rec1", "rec2"],
  "budgetOptimizations": ["opt1", "opt2"]
}`

    const stateText = [
      `Total content pieces: ${metrics.totalContentPieces}`,
      `Published this week: ${metrics.publishedThisWeek}`,
      `Scheduled: ${metrics.scheduledContent}`,
      `Active campaigns: ${metrics.activeCampaigns}`,
      `Total reach: ${metrics.totalReach}`,
      `Engagement rate: ${metrics.engagementRate}%`,
      `Lead conversion rate: ${metrics.leadConversionRate}%`,
    ].join('\n')

    const result = await executeAgentTask(this.supabase, this.userId, null, stateText, { systemPrompt })
    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response }

    await storeMemory(this.supabase, this.userId, {
      category: 'cmo_assessment',
      content: { type: 'marketing_performance', metrics, insights: parsed.campaignInsights, assessedAt: new Date().toISOString() },
      tags: ['cmo', 'marketing', 'assessment'],
    })

    await this.log('cmo_assessment', `Assessment complete | ${(Date.now() - start)}ms`)
    return {
      summary: parsed.summary || 'Marketing assessment completed',
      contentPerformance: parsed.contentPerformance || '',
      campaignInsights: parsed.campaignInsights || [],
      channelRecommendations: parsed.channelRecommendations || [],
      budgetOptimizations: parsed.budgetOptimizations || [],
      metrics,
    }
  }

  async runContentCycle(): Promise<{ contentCreated: number; leadsGenerated: number; published: number }> {
    const start = Date.now()
    const contentCreated = await generateDailyContent(this.supabase, this.userId)
    const leadsGenerated = await generateLeads(this.supabase, this.userId)
    const published = await publishScheduled(this.supabase, this.userId)
    await this.log('cmo_content_cycle', `Content: ${contentCreated} | Leads: ${leadsGenerated} | Published: ${published} | ${(Date.now() - start)}ms`)
    return { contentCreated, leadsGenerated, published }
  }

  async runGrowthCycle(industry: string): Promise<any> {
    const start = Date.now()
    const engine = new GrowthEngine(this.supabase, this.userId)
    const result = await engine.runFullCycle(industry)
    await this.log('cmo_growth_cycle', `Industry: ${industry} | ${result.status} | ${(Date.now() - start)}ms`)
    return result
  }

  async planContentStrategy(objective: string): Promise<{ strategy: string; contentPlan: string[]; channels: string[] }> {
    const systemPrompt = `You are the CMO planning content strategy. Return JSON:
{
  "strategy": "overall strategy description",
  "contentPlan": ["content idea 1", "content idea 2"],
  "channels": ["channel1", "channel2"]
}`

    const result = await executeAgentTask(this.supabase, this.userId, null, objective, { systemPrompt })
    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.strategy = result.response }

    await storeMemory(this.supabase, this.userId, {
      category: 'cmo_strategy',
      content: { type: 'content_strategy', objective, strategy: parsed.strategy, plan: parsed.contentPlan, channels: parsed.channels, createdAt: new Date().toISOString() },
      tags: ['cmo', 'strategy', 'content'],
    })

    return {
      strategy: parsed.strategy || '',
      contentPlan: parsed.contentPlan || [],
      channels: parsed.channels || [],
    }
  }

  private async gatherMetrics(): Promise<CmoMetrics> {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const today = new Date().toISOString().split('T')[0]

    const [{ count: totalContent }, { data: weeklyContent }, { data: calendar }, { data: leads }] = await Promise.all([
      this.supabase.from('content_requests').select('*', { count: 'exact', head: true }).eq('user_id', this.userId),
      this.supabase.from('content_requests').select('id').eq('user_id', this.userId).gte('created_at', weekAgo),
      this.supabase.from('growth_content_calendar').select('status, engagement_likes, engagement_comments, engagement_shares').eq('user_id', this.userId),
      this.supabase.from('leads').select('status').eq('user_id', this.userId),
    ])

    const calItems = (calendar ?? []) as any[]
    const allLeads = (leads ?? []) as any[]
    const totalEngagement = calItems.reduce((s: number, i: any) =>
      s + (i.engagement_likes || 0) + (i.engagement_comments || 0) + (i.engagement_shares || 0), 0
    )
    const convertedLeads = allLeads.filter((l: any) => l.status === 'converted').length

    return {
      totalContentPieces: totalContent || 0,
      publishedThisWeek: (weeklyContent ?? []).length,
      scheduledContent: calItems.filter((i: any) => i.status === 'scheduled').length,
      activeCampaigns: 0,
      totalReach: totalEngagement,
      engagementRate: calItems.length ? Math.round((totalEngagement / calItems.length) * 100) / 100 : 0,
      leadConversionRate: allLeads.length ? Math.round((convertedLeads / allLeads.length) * 100) : 0,
    }
  }

  private async log(action: string, message: string, status = 'success'): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null,
        action: `[CMO] ${action}`, module: 'cmo', status, message,
      }])
    } catch { /* best effort */ }
  }
}
