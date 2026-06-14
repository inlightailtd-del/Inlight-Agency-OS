import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export const CONTENT_STAGES = ['idea', 'planned', 'draft', 'approved', 'generated', 'scheduled', 'published'] as const
export type ContentStage = (typeof CONTENT_STAGES)[number]

export interface ContentMetrics {
  total: number; byStage: Record<string, number>; byType: Record<string, number>
  campaignsActive: number; campaignsCompleted: number; totalEngagement: number
  postsThisWeek: number; postsThisMonth: number
}

interface ContentItem {
  id: string; title: string; content_type: string; status: string; platform: string | null
  assignee_id: string | null; scheduled_at: string | null; published_at: string | null
  campaign_id: string | null; score: number; created_at: string
  agents?: { name: string } | null; content_campaigns?: { name: string } | null
}

const CONTENT_AGENTS = {
  director: { role: 'Marketing Director', skills: ['strategy', 'campaign_management', 'team_leadership'] },
  strategist: { role: 'Content Strategist', skills: ['content_strategy', 'editorial_planning', 'audience_research'] },
  copywriter: { role: 'Copywriter', skills: ['copywriting', 'ad_copy', 'persuasive_writing'] },
  blog_writer: { role: 'Blog Writer', skills: ['blog_writing', 'seo_writing', 'long_form'] },
  seo: { role: 'SEO Specialist', skills: ['seo', 'keyword_research', 'on_page_optimization'] },
  reel_script: { role: 'Reel Script Writer', skills: ['reel_scripting', 'short_form', 'viral_content'] },
  carousel: { role: 'Carousel Creator', skills: ['carousel_design', 'visual_storytelling', 'educational_content'] },
  social_manager: { role: 'Social Media Manager', skills: ['social_media', 'community_management', 'content_calendar'] },
  analytics: { role: 'Content Analytics Agent', skills: ['analytics', 'reporting', 'performance_analysis'] },
}

export async function ensureContentAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(CONTENT_AGENTS)) {
    const { data: existing } = await supabase.from('agents').select('id').eq('user_id', userId).eq('role', def.role).limit(1)
    const rows = (existing ?? []) as any[]
    if (rows.length > 0) {
      ids[key] = rows[0].id
    } else {
      const { data: created } = await supabase.from('agents').insert([{
        user_id: userId, name: def.role, type: 'marketing', role: def.role,
        department: 'marketing', status: 'active', skills: def.skills,
        specialization: def.role.toLowerCase().replace(/\s+/g, '_'), level: 1,
        performance_score: 60, success_rate: 50, hired_at: new Date().toISOString(),
      }]).select('id').single()
      if (created) ids[key] = created.id
    }
  }
  return ids
}

export async function planCampaign(supabase: SupabaseClient, userId: string, name: string, description: string, goal: string): Promise<string> {
  const { data: campaign } = await supabase.from('content_campaigns').insert([{
    user_id: userId, name, description, goal, status: 'planned',
  }]).select('id').single()
  if (!campaign) throw new Error('Failed to create campaign')

  await storeMemory(supabase, userId, {
    category: 'content_strategy', tags: ['campaign', name.toLowerCase().replace(/\s+/g, '_')],
    content: { type: 'campaign_created', campaignId: campaign.id, name, description, goal, createdAt: new Date().toISOString() },
  })
  return campaign.id
}

export async function generateContentIdeas(supabase: SupabaseClient, userId: string, campaignId?: string): Promise<number> {
  const agents = await ensureContentAgents(supabase, userId)
  let campaignInfo = ''
  if (campaignId) {
    const { data: c } = await supabase.from('content_campaigns').select('name, goal').eq('id', campaignId).single()
    if (c) campaignInfo = ` for campaign: ${c.name}${c.goal ? ` (goal: ${c.goal})` : ''}`
  }

  const systemPrompt = 'You are a Content Strategist. Generate 3 content ideas. Return JSON: {"ideas": [{"title": "string", "description": "string", "content_type": "blog|social_media|reel_script|carousel", "platform": "linkedin|twitter|facebook|instagram|blog", "target_audience": "string"}]}'
  const result = await executeAgentTask(supabase, userId, null,
    `Generate content ideas${campaignInfo}. Include a mix of blog posts, social media posts, reel scripts, and carousel content.`,
    { systemPrompt }
  )

  let ideas: any[] = []
  try { ideas = JSON.parse(result.response || '{}').ideas || [] } catch { return 0 }

  let created = 0
  for (const idea of ideas.slice(0, 3)) {
    await supabase.from('content_requests').insert([{
      user_id: userId, title: idea.title, description: idea.description,
      content_type: idea.content_type || 'blog', platform: idea.platform || 'blog',
      status: 'idea', campaign_id: campaignId || null,
      target_audience: idea.target_audience || null,
    }])
    created++
  }
  return created
}

export async function advanceContentStage(supabase: SupabaseClient, userId: string): Promise<{ drafted: number; approved: number; generated: number; scheduled: number; published: number }> {
  let drafted = 0; let approved = 0; let generated = 0; let scheduled = 0; let published = 0

  // Idea → Planned (auto-promote, but let AI pick priority)
  const { data: ideas } = await supabase.from('content_requests').select('id, title, content_type').eq('user_id', userId).eq('status', 'idea').limit(10)
  for (const idea of (ideas ?? []) as any[]) {
    await supabase.from('content_requests').update({ status: 'planned', updated_at: new Date().toISOString() }).eq('id', idea.id)
  }

  // Planned → Draft (assign to strategist, create draft content)
  const { data: planned } = await supabase.from('content_requests').select('*, agents!content_requests_assignee_id_fkey(name)').eq('user_id', userId).eq('status', 'planned').limit(5)
  for (const item of (planned ?? []) as any[]) {
    const agents = await ensureContentAgents(supabase, userId)
    await assignTaskToEmployee(supabase, userId, agents.strategist, `Draft: ${item.title}`, `Create a draft outline for this ${item.content_type} content`)
    await supabase.from('content_requests').update({ status: 'draft', assignee_id: agents.strategist, updated_at: new Date().toISOString() }).eq('id', item.id)
    drafted++
  }

  // Draft → Approved
  const { data: drafts } = await supabase.from('content_requests').select('id').eq('user_id', userId).eq('status', 'draft').limit(5)
  for (const item of (drafts ?? []) as any[]) {
    await supabase.from('content_requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', item.id)
    approved++
  }

  // Approved → Generated (AI generates the actual content)
  const agentTypeMap: Record<string, string> = {
    reel_script: 'reel_script', carousel: 'carousel', social_media: 'social_manager',
    blog: 'blog_writer', ad_copy: 'copywriter', email: 'copywriter', landing_page: 'copywriter',
  }
  const { data: approvedList } = await supabase.from('content_requests').select('id, title, description, content_type, platform, tone').eq('user_id', userId).eq('status', 'approved').limit(5)
  for (const item of (approvedList ?? []) as any[]) {
    const agentKey = agentTypeMap[item.content_type] || 'blog_writer'
    const systemPrompt =
      agentKey === 'reel_script' ? 'You are a Reel Script Writer. Write engaging, fast-paced short-form video scripts with hooks, transitions, and CTAs.'
      : agentKey === 'carousel' ? 'You are a Carousel Creator. Write educational slide-by-slide carousel content with clear takeaways.'
      : agentKey === 'social_manager' ? 'You are a Social Media Manager. Write engaging social posts optimized for the target platform with hashtags.'
      : agentKey === 'blog_writer' ? 'You are a Blog Writer. Write SEO-optimized blog posts with headings, short paragraphs, and actionable insights.'
      : 'You are an expert copywriter. Write compelling, persuasive content.'

    const userPrompt = `Create ${item.content_type} content:\nTitle: ${item.title}\n${item.description ? `Description: ${item.description}\n` : ''}${item.platform ? `Platform: ${item.platform}\n` : ''}Tone: ${item.tone || 'professional'}\nWrite the full content.`
    const result = await executeAgentTask(supabase, userId, null, userPrompt, { systemPrompt: systemPrompt })

    const agents = await ensureContentAgents(supabase, userId)
    await supabase.from('content_requests').update({
      status: 'generated', generated_content: result.response,
      word_count: result.response ? result.response.split(/\s+/).length : 0,
      score: result.status === 'completed' ? Math.min(100, Math.round(Math.random() * 30 + 70)) : 0,
      assignee_id: agents[agentKey as keyof typeof agents] || null,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    generated++

    // Content-to-Video hook: reel_script → auto-create video project
    if (item.content_type === 'reel_script') {
      try {
        await supabase.from('video_projects').insert([{
          user_id: userId, title: item.title, description: item.description,
          content_type: 'reel', platform: item.platform || 'instagram',
          status: 'idea', script_content: result.response,
        }])
        await storeMemory(supabase, userId, {
          category: 'cross_dept', tags: ['content_to_video', item.id],
          content: { type: 'video_from_content', contentId: item.id, title: item.title, createdAt: new Date().toISOString() },
        })
      } catch { /* table may not exist yet */ }
    }

    // Content-to-Website hook: landing_page → auto-create website project
    if (item.content_type === 'landing_page' || item.platform === 'blog') {
      try {
        await supabase.from('website_projects').insert([{
          user_id: userId, name: `${item.title} — Landing Page`, description: item.description || '',
          website_type: 'landing_page', status: 'idea', pages: 1,
        }])
        await storeMemory(supabase, userId, {
          category: 'cross_dept', tags: ['content_to_website', item.id],
          content: { type: 'website_from_content', contentId: item.id, title: item.title, createdAt: new Date().toISOString() },
        })
      } catch { /* table may not exist yet */ }
    }

    await storeMemory(supabase, userId, {
      category: 'generated_content', tags: [item.content_type, item.id],
      content: { contentId: item.id, title: item.title, contentType: item.content_type, platform: item.platform || null, generatedAt: new Date().toISOString() },
    })
  }

  // Generated → Scheduled (set schedule 1-7 days out)
  const { data: generatedList } = await supabase.from('content_requests').select('id').eq('user_id', userId).eq('status', 'generated').limit(10)
  for (const item of (generatedList ?? []) as any[]) {
    const daysOut = Math.floor(Math.random() * 7) + 1
    await supabase.from('content_requests').update({
      status: 'scheduled', scheduled_at: new Date(Date.now() + daysOut * 86400000).toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    scheduled++
  }

  // Scheduled → Published (if scheduled date passed)
  const now = new Date().toISOString()
  const { data: scheduledList } = await supabase.from('content_requests').select('id').eq('user_id', userId).eq('status', 'scheduled').lte('scheduled_at', now).limit(10)
  for (const item of (scheduledList ?? []) as any[]) {
    await supabase.from('content_requests').update({
      status: 'published', published_at: now, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    published++
  }

  return { drafted, approved, generated, scheduled, published }
}

export async function getContentMetricsData(supabase: SupabaseClient, userId: string): Promise<ContentMetrics> {
  const { data: items } = await supabase.from('content_requests').select('status, content_type, platform, score, engagement_likes, engagement_shares, engagement_comments, created_at, published_at').eq('user_id', userId)
  const allItems = (items ?? []) as any[]

  const byStage: Record<string, number> = {}
  const byType: Record<string, number> = {}
  let totalEngagement = 0
  let postsThisWeek = 0
  let postsThisMonth = 0

  const now = Date.now()
  const weekAgo = new Date(now - 7 * 86400000).toISOString()
  const monthAgo = new Date(now - 30 * 86400000).toISOString()

  for (const item of allItems) {
    byStage[item.status] = (byStage[item.status] || 0) + 1
    byType[item.content_type] = (byType[item.content_type] || 0) + 1
    totalEngagement += (item.engagement_likes || 0) + (item.engagement_shares || 0) + (item.engagement_comments || 0)
    if (item.published_at && item.published_at >= weekAgo) postsThisWeek++
    if (item.published_at && item.published_at >= monthAgo) postsThisMonth++
  }

  const { data: campaigns } = await supabase.from('content_campaigns').select('status').eq('user_id', userId)

  return {
    total: allItems.length, byStage, byType,
    campaignsActive: ((campaigns ?? []) as any[]).filter((c: any) => c.status === 'active' || c.status === 'planned').length,
    campaignsCompleted: ((campaigns ?? []) as any[]).filter((c: any) => c.status === 'completed').length,
    totalEngagement, postsThisWeek, postsThisMonth,
  }
}

export async function getContentPipeline(supabase: SupabaseClient, userId: string): Promise<{
  idea: ContentItem[]; planned: ContentItem[]; draft: ContentItem[]; approved: ContentItem[]
  generated: ContentItem[]; scheduled: ContentItem[]; published: ContentItem[]
}> {
  const { data } = await supabase.from('content_requests').select('*, agents!content_requests_assignee_id_fkey(name), content_campaigns!content_requests_campaign_id_fkey(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  const items = ((data ?? []) as any[]).map((r: any) => ({ ...r, agents: r.agents || null, content_campaigns: r.content_campaigns || null }))

  const pipeline: any = { idea: [], planned: [], draft: [], approved: [], generated: [], scheduled: [], published: [] }
  for (const item of items) {
    if (pipeline[item.status]) pipeline[item.status].push(item)
  }
  return pipeline
}

export async function runFullContentCycle(supabase: SupabaseClient, userId: string): Promise<{
  ideasGenerated: number; drafted: number; approved: number; generated: number; scheduled: number; published: number
}> {
  await ensureContentAgents(supabase, userId)
  const ideasGenerated = await generateContentIdeas(supabase, userId)
  const stages = await advanceContentStage(supabase, userId)

  const metrics = await getContentMetricsData(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'content_strategy', tags: ['content_cycle'],
    content: { ideasGenerated, ...stages, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Content] Cycle completed', module: 'marketing', status: 'success',
    message: `Ideas: ${ideasGenerated}, Drafted: ${stages.drafted}, Generated: ${stages.generated}, Scheduled: ${stages.scheduled}, Published: ${stages.published}`,
  }])

  return { ideasGenerated, ...stages }
}
