import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'


export interface MediaBuyerMetrics {
  totalCampaigns: number
  activeCampaigns: number
  totalSpend: number
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  avgCtr: number
  avgCpc: number
  avgCpa: number
  avgRoas: number
  campaignsByPlatform: Record<string, number>
  creativeVariants: number
  abTestsRunning: number
}

const MEDIA_BUYER_AGENTS = {
  director: { role: 'Media Director', skills: ['media_strategy', 'budget_management', 'cross_platform'] },
  facebook_specialist: { role: 'Facebook Ads Specialist', skills: ['facebook_ads', 'audience_targeting', 'retargeting'] },
  google_specialist: { role: 'Google Ads Specialist', skills: ['google_ads', 'keyword_research', 'search_ads', 'display_ads'] },
  linkedin_specialist: { role: 'LinkedIn Ads Specialist', skills: ['linkedin_ads', 'b2b_targeting', 'account_based'] },
  tiktok_specialist: { role: 'TikTok Ads Specialist', skills: ['tiktok_ads', 'viral_creative', 'spark_ads'] },
  creative_copywriter: { role: 'Ad Creative Copywriter', skills: ['copywriting', 'cta_optimization', 'a_b_testing', 'headline_generation'] },
  performance_analyst: { role: 'Performance Analyst', skills: ['analytics', 'roi_analysis', 'bid_optimization', 'reporting'] },
}

export async function ensureMediaBuyerAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(MEDIA_BUYER_AGENTS)) {
    const { data: existing } = await supabase.from('agents').select('id').eq('user_id', userId).eq('role', def.role).limit(1)
    const rows = (existing ?? []) as any[]
    if (rows.length > 0) {
      ids[key] = rows[0].id
    } else {
      const { data: created } = await supabase.from('agents').insert([{
        user_id: userId, name: def.role, type: 'general', role: def.role,
        department: 'marketing', status: 'active', skills: def.skills,
        specialization: def.role.toLowerCase().replace(/\s+/g, '_'), level: 1,
        performance_score: 60, success_rate: 50, hired_at: new Date().toISOString(),
      }]).select('id').single()
      if (created) ids[key] = created.id
    }
  }
  return ids
}

export async function generateAdCampaigns(supabase: SupabaseClient, userId: string): Promise<number> {
  const agents = await ensureMediaBuyerAgents(supabase, userId)
  const systemPrompt = `You are a Media Director. Design ad campaigns. Return JSON: {"campaigns": [{"name": "string", "platform": "facebook|google|linkedin|tiktok", "goal": "awareness|consideration|conversion|retargeting", "daily_budget": number, "total_budget": number, "target_audience": {"age_range": "string", "interests": ["string"], "locations": ["string"], "job_titles": ["string"]}, "duration_days": number}]}`
  const result = await executeAgentTask(supabase, userId, agents.director,
    'Design 4 ad campaigns across Facebook, Google, LinkedIn, and TikTok. Mix awareness, consideration, and conversion goals. Budgets should range from $50-$500 daily.', { systemPrompt }
  )

  let campaigns: any[] = []
  try { campaigns = JSON.parse(result.response || '{}').campaigns || [] } catch { return 0 }

  let created = 0
  for (const c of campaigns.slice(0, 4)) {
    const startDate = new Date()
    const endDate = new Date(Date.now() + (c.duration_days || 30) * 86400000)
    const { data: campaign } = await supabase.from('ad_campaigns').insert([{
      user_id: userId, name: c.name, goal: c.goal || 'conversion',
      platform: c.platform || 'facebook', daily_budget: c.daily_budget || 100,
      total_budget: c.total_budget || (c.daily_budget || 100) * (c.duration_days || 30),
      status: 'planned', start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      target_audience: c.target_audience || {},
      targeting_json: { interests: c.target_audience?.interests || [], locations: c.target_audience?.locations || [], age_range: c.target_audience?.age_range || '25-54' },
    }]).select('id').single()
    if (campaign) created++
  }
  return created
}

export async function generateAdCreatives(supabase: SupabaseClient, userId: string): Promise<number> {
  const agents = await ensureMediaBuyerAgents(supabase, userId)
  const { data: campaigns } = await supabase.from('ad_campaigns').select('id, name, platform, goal').eq('user_id', userId).eq('status', 'planned').limit(5)
  let created = 0

  for (const campaign of (campaigns ?? []) as any[]) {
    const systemPrompt = `You are an Ad Creative Copywriter. Generate A/B ad creatives. Return JSON: {"creatives": [{"headline": "string", "primary_text": "string", "description": "string", "cta": "string", "variant": "a|b"}]}`
    const result = await executeAgentTask(supabase, userId, agents.creative_copywriter,
      `Generate 2 ad creatives (A/B test variants) for a ${campaign.platform} ad campaign "${campaign.name}" with goal ${campaign.goal}. Keep headlines under 40 chars, primary text under 125 chars.`, { systemPrompt }
    )

    let creatives: any[] = []
    try { creatives = JSON.parse(result.response || '{}').creatives || [] } catch { continue }

    for (const ad of creatives.slice(0, 2)) {
      await supabase.from('ad_creatives').insert([{
        campaign_id: campaign.id, user_id: userId,
        headline: ad.headline || '', primary_text: ad.primary_text || '',
        description: ad.description || '', cta: ad.cta || 'Learn More',
        media_type: 'image', variant: ad.variant || 'a', platform: campaign.platform,
        status: 'draft',
      }])
      created++
    }
  }
  return created
}

export async function createAdSets(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: campaigns } = await supabase.from('ad_campaigns').select('id, name, platform, daily_budget, targeting_json').eq('user_id', userId).in('status', ['planned', 'active']).limit(5)
  let created = 0

  for (const campaign of (campaigns ?? []) as any[]) {
    const bidAmount = Math.round((campaign.daily_budget || 100) * 0.3 * 100) / 100
    await supabase.from('ad_sets').insert([{
      campaign_id: campaign.id, user_id: userId,
      name: `${campaign.name} - Main Set`,
      bid_strategy: 'lowest_cost', bid_amount: bidAmount,
      daily_budget: campaign.daily_budget || 100,
      status: 'planned', targeting: campaign.targeting_json || {},
    }])
    created++
  }
  return created
}

export async function launchAdCampaigns(supabase: SupabaseClient, userId: string): Promise<number> {
  const agents = await ensureMediaBuyerAgents(supabase, userId)
  const { data: planned } = await supabase.from('ad_campaigns').select('id, name, platform').eq('user_id', userId).eq('status', 'planned').limit(5)
  let launched = 0

  for (const campaign of (planned ?? []) as any[]) {
    const platform = campaign.platform as string
    const agentKey = platform === 'facebook' ? 'facebook_specialist' : platform === 'google' ? 'google_specialist' : platform === 'linkedin' ? 'linkedin_specialist' : 'tiktok_specialist'
    const agentId = agents[agentKey as keyof typeof agents] || agents.director

    const systemPrompt = `You are a ${platform.charAt(0).toUpperCase() + platform.slice(1)} Ads Specialist. Review and approve campaign launch. Return JSON: {"approved": boolean, "notes": "string", "optimization_suggestions": ["string"]}`
    await executeAgentTask(supabase, userId, agentId,
      `Review ${platform} campaign "${campaign.name}" for launch readiness. Confirm budget, targeting, and creative are set.`, { systemPrompt }
    )

    await supabase.from('ad_campaigns').update({
      status: 'active', assignee_id: agentId, updated_at: new Date().toISOString(),
    }).eq('id', campaign.id)

    await supabase.from('ad_sets').update({ status: 'active' }).eq('campaign_id', campaign.id)
    await supabase.from('ad_creatives').update({ status: 'active' }).eq('campaign_id', campaign.id)
    launched++
  }
  return launched
}

export async function optimizeAdCampaigns(supabase: SupabaseClient, userId: string): Promise<number> {
  const agents = await ensureMediaBuyerAgents(supabase, userId)
  const { data: active } = await supabase.from('ad_campaigns').select('id, name, platform, daily_budget, performance, roas').eq('user_id', userId).eq('status', 'active').limit(5)
  let optimized = 0

  for (const campaign of (active ?? []) as any[]) {
    const perf = (campaign.performance || {}) as any
    const roas = campaign.roas || 0
    const spend = perf.spend || 0
    const impressions = perf.impressions || 0

    const systemPrompt = `You are a Performance Analyst. Analyze campaign performance and suggest optimizations. Return JSON: {"budget_change_pct": number, "bid_adjustment": number, "optimizations": ["string"], "reasoning": "string"}`
    const result = await executeAgentTask(supabase, userId, agents.performance_analyst,
      `Campaign "${campaign.name}" on ${campaign.platform}: $${spend} spend, ${impressions} impressions, ${roas}x ROAS. ${roas < 2 ? 'Underperforming' : roas > 4 ? 'Scaling opportunity' : 'Stable performance'}. Suggest budget and bid adjustments.`, { systemPrompt }
    )

    let optimization: any = {}
    try { optimization = JSON.parse(result.response || '{}') } catch { continue }

    const budgetChange = (campaign.daily_budget || 100) * (1 + (optimization.budget_change_pct || 0) / 100)
    await supabase.from('ad_campaigns').update({
      daily_budget: Math.max(10, Math.round(budgetChange * 100) / 100),
      updated_at: new Date().toISOString(),
    }).eq('id', campaign.id)

    await storeMemory(supabase, userId, {
      category: 'media_buying', tags: ['optimization', campaign.platform],
      content: { campaignId: campaign.id, platform: campaign.platform, budgetBefore: campaign.daily_budget, budgetAfter: budgetChange, roas, optimizations: optimization.optimizations || [], analyzedAt: new Date().toISOString() },
    })
    optimized++
  }
  return optimized
}

export async function analyzeAdPerformance(supabase: SupabaseClient, userId: string): Promise<number> {
  const agents = await ensureMediaBuyerAgents(supabase, userId)
  const { data: campaigns } = await supabase.from('ad_campaigns').select('id, name, platform, performance, roas, total_budget, daily_budget').eq('user_id', userId).limit(20)

  const totalSpend = (campaigns ?? []).reduce((s: number, c: any) => s + ((c.performance as any)?.spend || 0), 0)
  const totalConversions = (campaigns ?? []).reduce((s: number, c: any) => s + ((c.performance as any)?.conversions || 0), 0)
  const totalImpressions = (campaigns ?? []).reduce((s: number, c: any) => s + ((c.performance as any)?.impressions || 0), 0)

  const systemPrompt = `You are a Performance Analyst. Produce a media buying performance summary. Return JSON: {"summary": "string", "key_insights": ["string"], "recommendations": ["string"], "best_platform": "string", "worst_platform": "string"}`
  const result = await executeAgentTask(supabase, userId, agents.performance_analyst,
    `Campaigns: ${(campaigns ?? []).length}. Total spend: $${totalSpend}. Conversions: ${totalConversions}. Impressions: ${totalImpressions}. Platforms: ${[...new Set((campaigns ?? []).map((c: any) => c.platform))].join(', ')}. Provide performance analysis.`, { systemPrompt }
  )

  let analysis: any = {}
  try { analysis = JSON.parse(result.response || '{}') } catch {}

  await storeMemory(supabase, userId, {
    category: 'media_buying', tags: ['performance_analysis'],
    content: { campaignsCount: (campaigns ?? []).length, totalSpend, totalConversions, totalImpressions, summary: analysis.summary, insights: analysis.key_insights || [], recommendations: analysis.recommendations || [], analyzedAt: new Date().toISOString() },
  })

  return (campaigns ?? []).length
}

export async function simulatePerformanceData(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: campaigns } = await supabase.from('ad_campaigns').select('id, platform, daily_budget, roas').eq('user_id', userId)
  let updated = 0

  for (const campaign of (campaigns ?? []) as any[]) {
    const dailyBudget = campaign.daily_budget || 100
    const roas = campaign.roas || 2
    const dailySpend = dailyBudget * (0.7 + Math.random() * 0.3)
    const cpm = (campaign.platform === 'linkedin' ? 25 : campaign.platform === 'tiktok' ? 8 : campaign.platform === 'google' ? 12 : 10) + Math.random() * 5
    const impressions = Math.round((dailySpend / cpm) * 1000)
    const ctr = (campaign.platform === 'facebook' ? 1.5 : campaign.platform === 'google' ? 2.5 : campaign.platform === 'linkedin' ? 0.8 : 3.0) + Math.random() * 1.5
    const clicks = Math.round(impressions * (ctr / 100))
    const cpc = clicks > 0 ? dailySpend / clicks : 0
    const convRate = 1 + Math.random() * 4
    const conversions = Math.round(clicks * (convRate / 100))
    const cpa = conversions > 0 ? dailySpend / conversions : 0
    const newRoas = Math.round((roas + (Math.random() - 0.5) * 0.5) * 100) / 100

    await supabase.from('ad_campaigns').update({
      performance: { impressions: Math.round(impressions * 30), clicks: Math.round(clicks * 30), spend: Math.round(dailySpend * 30 * 100) / 100, conversions: Math.round(conversions * 30), ctr: Math.round(ctr * 100) / 100, cpc: Math.round(cpc * 100) / 100, cpa: Math.round(cpa * 100) / 100 },
      roas: Math.max(0, newRoas),
      updated_at: new Date().toISOString(),
    }).eq('id', campaign.id)
    updated++
  }
  return updated
}

export async function buildAudience(supabase: SupabaseClient, userId: string): Promise<number> {
  const agents = await ensureMediaBuyerAgents(supabase, userId)
  const { data: campaigns } = await supabase.from('ad_campaigns').select('id, name, platform, goal, target_audience').eq('user_id', userId).limit(5)
  let built = 0

  for (const campaign of (campaigns ?? []) as any[]) {
    const systemPrompt = `You are a Media Director specializing in audience targeting. Design detailed audience segments. Return JSON: {"segments": [{"name": "string", "platform": "string", "age_range": "string", "gender": "string", "interests": ["string"], "behaviors": ["string"], "locations": ["string"], "languages": ["string"], "estimated_size": number, "job_titles": ["string"], "industries": ["string"]}]}`
    const result = await executeAgentTask(supabase, userId, agents.director,
      `Design 3 audience segments for ${campaign.platform} campaign "${campaign.name}" (${campaign.goal}). Include demographics, interests, and behaviors.`, { systemPrompt }
    )

    let segments: any[] = []
    try { segments = JSON.parse(result.response || '{}').segments || [] } catch { continue }

    for (const seg of segments.slice(0, 3)) {
      await storeMemory(supabase, userId, {
        category: 'media_buying', tags: ['audience_segment', campaign.platform],
        content: { campaignId: campaign.id, campaignName: campaign.name, segment: seg, builtAt: new Date().toISOString() },
      })
      built++
    }
  }
  return built
}

export async function createRetargetingCampaigns(supabase: SupabaseClient, userId: string): Promise<number> {
  const agents = await ensureMediaBuyerAgents(supabase, userId)
  const { data: activeCampaigns } = await supabase.from('ad_campaigns').select('id, name, platform, goal, performance, roas').eq('user_id', userId).eq('status', 'active').limit(5)
  let created = 0

  for (const source of (activeCampaigns ?? []) as any[]) {
    const perf = (source.performance || {}) as any
    const visitors = Math.round((perf.impressions || 0) * 0.05)
    const converters = perf.conversions || 0

    const systemPrompt = `You are a Retargeting Specialist. Design retargeting campaigns. Return JSON: {"campaigns": [{"name": "string", "audience_type": "website_visitors|engaged_users|past_customers|cart_abandoners", "platform": "string", "daily_budget": number, "duration_days": number, "retargeting_window_days": number}]}`
    const result = await executeAgentTask(supabase, userId, agents.facebook_specialist,
      `Source campaign "${source.name}" on ${source.platform}: ${visitors} estimated visitors, ${converters} converters. Goal: retarget them. Design 2 retargeting campaigns.`, { systemPrompt }
    )

    let retargetCampaigns: any[] = []
    try { retargetCampaigns = JSON.parse(result.response || '{}').campaigns || [] } catch { continue }

    for (const rc of retargetCampaigns.slice(0, 2)) {
      const startDate = new Date()
      const endDate = new Date(Date.now() + (rc.duration_days || 30) * 86400000)
      await supabase.from('ad_campaigns').insert([{
        user_id: userId, name: rc.name || `${source.name} - Retargeting`,
        goal: 'retargeting', platform: rc.platform || source.platform,
        daily_budget: rc.daily_budget || Math.round((source.daily_budget || 100) * 0.4),
        total_budget: (rc.daily_budget || 40) * (rc.duration_days || 30),
        status: 'planned', start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        target_audience: { source_campaign: source.name, audience_type: rc.audience_type || 'website_visitors', retargeting_window: rc.retargeting_window_days || 30 },
        targeting_json: { retargeting: true, source_campaign_id: source.id, audience_type: rc.audience_type || 'website_visitors' },
      }])
      created++
    }
  }
  return created
}

export async function getMediaBuyerMetrics(supabase: SupabaseClient, userId: string): Promise<MediaBuyerMetrics> {
  const { data: campaigns } = await supabase.from('ad_campaigns').select('status, platform, performance, roas, daily_budget').eq('user_id', userId)
  const all = (campaigns ?? []) as any[]
  const { data: creatives } = await supabase.from('ad_creatives').select('variant, status').eq('user_id', userId)
  const allCreatives = (creatives ?? []) as any[]

  let totalSpend = 0; let totalImpressions = 0; let totalClicks = 0; let totalConversions = 0
  let roasSum = 0; let roasCount = 0
  const byPlatform: Record<string, number> = {}

  for (const c of all) {
    const p = (c.performance || {}) as any
    totalSpend += p.spend || 0
    totalImpressions += p.impressions || 0
    totalClicks += p.clicks || 0
    totalConversions += p.conversions || 0
    byPlatform[c.platform] = (byPlatform[c.platform] || 0) + 1
    if (c.roas) { roasSum += c.roas; roasCount++ }
  }

  return {
    totalCampaigns: all.length,
    activeCampaigns: all.filter(c => c.status === 'active').length,
    totalSpend, totalImpressions, totalClicks, totalConversions,
    avgCtr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
    avgCpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
    avgCpa: totalConversions > 0 ? Math.round((totalSpend / totalConversions) * 100) / 100 : 0,
    avgRoas: roasCount > 0 ? Math.round((roasSum / roasCount) * 100) / 100 : 0,
    campaignsByPlatform: byPlatform,
    creativeVariants: allCreatives.length,
    abTestsRunning: allCreatives.filter(c => c.variant === 'a' || c.variant === 'b').length,
  }
}

export async function getAdCampaigns(supabase: SupabaseClient, userId: string): Promise<any[]> {
  const { data } = await supabase.from('ad_campaigns').select('*, agents!ad_campaigns_assignee_id_fkey(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  return ((data ?? []) as any[]).map(r => ({ ...r, assignee_name: r.agents?.name || null }))
}

export async function runFullMediaBuyingCycle(supabase: SupabaseClient, userId: string): Promise<{
  campaignsCreated: number; creativesGenerated: number; adSetsCreated: number
  campaignsLaunched: number; campaignsOptimized: number; performancesAnalyzed: number
  performanceDataSimulated: number; audiencesBuilt: number; retargetingCreated: number
}> {
  await ensureMediaBuyerAgents(supabase, userId)

  const campaignsCreated = await generateAdCampaigns(supabase, userId)
  const creativesGenerated = await generateAdCreatives(supabase, userId)
  const adSetsCreated = await createAdSets(supabase, userId)
  const campaignsLaunched = await launchAdCampaigns(supabase, userId)
  const performanceDataSimulated = await simulatePerformanceData(supabase, userId)
  const campaignsOptimized = await optimizeAdCampaigns(supabase, userId)
  const performancesAnalyzed = await analyzeAdPerformance(supabase, userId)
  const audiencesBuilt = await buildAudience(supabase, userId)
  const retargetingCreated = await createRetargetingCampaigns(supabase, userId)

  const metrics = await getMediaBuyerMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'media_buying', tags: ['media_buyer_cycle'],
    content: { campaignsCreated, creativesGenerated, adSetsCreated, campaignsLaunched, campaignsOptimized, performancesAnalyzed, performanceDataSimulated, audiencesBuilt, retargetingCreated, metrics, runAt: new Date().toISOString() },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Media Buyer] Cycle completed', module: 'marketing', status: 'success',
    message: `Campaigns: ${campaignsCreated}, Creatives: ${creativesGenerated}, Launched: ${campaignsLaunched}, Retargeting: ${retargetingCreated}, ROAS: ${metrics.avgRoas}x`,
  }])

  return { campaignsCreated, creativesGenerated, adSetsCreated, campaignsLaunched, campaignsOptimized, performancesAnalyzed, performanceDataSimulated, audiencesBuilt, retargetingCreated }
}
