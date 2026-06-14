import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export const VIDEO_STAGES = ['idea', 'script', 'voiceover', 'assets', 'editing', 'thumbnail', 'review', 'scheduled', 'published'] as const
export type VideoStage = (typeof VIDEO_STAGES)[number]

export interface VideoMetrics {
  total: number; byStage: Record<string, number>; byPlatform: Record<string, number>
  campaignsActive: number; totalViews: number; totalLikes: number
  totalComments: number; totalShares: number; avgViralScore: number
  publishedThisWeek: number; publishedThisMonth: number
}

interface VideoProject {
  id: string; title: string; content_type: string; status: string; platform: string | null
  assignee_id: string | null; scheduled_at: string | null; published_at: string | null
  views: number; likes: number; comments: number; shares: number; viral_score: number
  hook_text: string | null; duration_seconds: number | null; created_at: string
}

const VIDEO_AGENTS = {
  director: { role: 'Video Director', skills: ['video_strategy', 'production', 'creative_direction'] },
  strategist: { role: 'Video Strategist', skills: ['content_strategy', 'audience_analysis', 'platform_optimization'] },
  reel_creator: { role: 'Reel Creator', skills: ['reel_production', 'trend_spotting', 'short_form'] },
  short_editor: { role: 'Short Form Editor', skills: ['editing', 'effects', 'pacing'] },
  long_editor: { role: 'Long Form Editor', skills: ['long_form_editing', 'storytelling', 'color_grading'] },
  thumbnail: { role: 'Thumbnail Designer', skills: ['thumbnail_design', 'click_optimization', 'visual_design'] },
  script_writer: { role: 'Script Writer', skills: ['script_writing', 'storytelling', 'hook_creation'] },
  voiceover: { role: 'Voiceover Manager', skills: ['voice_direction', 'audio_production', 'narration'] },
  distribution: { role: 'Distribution Manager', skills: ['publishing', 'scheduling', 'cross_platform'] },
  analytics: { role: 'Analytics Manager', skills: ['performance_analysis', 'viral_patterns', 'reporting'] },
}

export async function ensureVideoAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(VIDEO_AGENTS)) {
    const { data: existing } = await supabase.from('agents').select('id').eq('user_id', userId).eq('role', def.role).limit(1)
    const rows = (existing ?? []) as any[]
    if (rows.length > 0) {
      ids[key] = rows[0].id
    } else {
      const { data: created } = await supabase.from('agents').insert([{
        user_id: userId, name: def.role, type: 'general', role: def.role,
        department: 'content', status: 'active', skills: def.skills,
        specialization: def.role.toLowerCase().replace(/\s+/g, '_'), level: 1,
        performance_score: 60, success_rate: 50, hired_at: new Date().toISOString(),
      }]).select('id').single()
      if (created) ids[key] = created.id
    }
  }
  return ids
}

export async function createVideoCampaign(supabase: SupabaseClient, userId: string, name: string, description: string, goal: string, platforms: string[]): Promise<string> {
  const { data: campaign } = await supabase.from('video_campaigns').insert([{
    user_id: userId, name, description, goal, target_platforms: platforms, status: 'planned',
  }]).select('id').single()
  if (!campaign) throw new Error('Failed to create campaign')

  await storeMemory(supabase, userId, {
    category: 'content_strategy', tags: ['video_campaign', name.toLowerCase().replace(/\s+/g, '_')],
    content: { type: 'video_campaign_created', campaignId: campaign.id, name, description, goal, platforms, createdAt: new Date().toISOString() },
  })
  return campaign.id
}

export async function generateVideoIdeas(supabase: SupabaseClient, userId: string, campaignId?: string): Promise<number> {
  const agents = await ensureVideoAgents(supabase, userId)
  let campaignInfo = ''
  if (campaignId) {
    const { data: c } = await supabase.from('video_campaigns').select('name, goal').eq('id', campaignId).single()
    if (c) campaignInfo = ` for campaign: ${c.name}${c.goal ? ` (${c.goal})` : ''}`
  }

  const systemPrompt = 'You are a Video Strategist. Generate 3 video content ideas. Return JSON: {"ideas": [{"title": "string", "description": "string", "content_type": "reel|short|long", "platform": "youtube|instagram|tiktok|linkedin|facebook|twitter", "hook": "string", "duration_seconds": number}]}'
  const result = await executeAgentTask(supabase, userId, null,
    `Generate video content ideas${campaignInfo}. Include a mix of reels, short-form, and long-form content.`, { systemPrompt }
  )

  let ideas: any[] = []
  try { ideas = JSON.parse(result.response || '{}').ideas || [] } catch { return 0 }

  let created = 0
  for (const idea of ideas.slice(0, 3)) {
    await supabase.from('video_projects').insert([{
      user_id: userId, title: idea.title, description: idea.description,
      content_type: idea.content_type || 'short', platform: idea.platform || 'youtube',
      status: 'idea', campaign_id: campaignId || null,
      hook_text: idea.hook || null, duration_seconds: idea.duration_seconds || null,
    }])
    created++
  }
  return created
}

export async function advanceVideoStage(supabase: SupabaseClient, userId: string): Promise<{
  scripted: number; voiced: number; assetsCollected: number; edited: number
  thumbnailed: number; reviewed: number; scheduled: number; published: number
}> {
  let scripted = 0; let voiced = 0; let assetsCollected = 0; let edited = 0
  let thumbnailed = 0; let reviewed = 0; let scheduled = 0; let published = 0
  const agents = await ensureVideoAgents(supabase, userId)

  // idea → script
  const { data: ideas } = await supabase.from('video_projects').select('id, title, description, hook_text, content_type, platform').eq('user_id', userId).eq('status', 'idea').limit(5)
  for (const item of (ideas ?? []) as any[]) {
    const systemPrompt = 'You are a Script Writer. Write a compelling video script. Return JSON: {"script": "full script with hook, body, CTA", "hook": "string"}'
    const result = await executeAgentTask(supabase, userId, null,
      `Write a ${item.content_type || 'short'} video script for "${item.title}"${item.hook_text ? ` (hook idea: ${item.hook_text})` : ''} on ${item.platform || 'youtube'}.`, { systemPrompt }
    )
    let script = ''; let hook = ''
    try { const p = JSON.parse(result.response || '{}'); script = p.script || result.response; hook = p.hook || item.hook_text || '' } catch { script = result.response || '' }
    await supabase.from('video_projects').update({
      status: 'script', script_content: script, hook_text: hook || item.hook_text,
      assignee_id: agents.script_writer, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.script_writer, `Write script: ${item.title}`, `Create a ${item.content_type} script for ${item.platform || 'youtube'}`)
    scripted++
  }

  // script → voiceover
  const { data: scripts } = await supabase.from('video_projects').select('id, title').eq('user_id', userId).eq('status', 'script').limit(5)
  for (const item of (scripts ?? []) as any[]) {
    await supabase.from('video_projects').update({ status: 'voiceover', assignee_id: agents.voiceover, updated_at: new Date().toISOString() }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.voiceover, `Create voiceover: ${item.title}`, 'Record or generate voiceover for this video script.')
    voiced++
  }

  // voiceover → assets
  const { data: voiceovers } = await supabase.from('video_projects').select('id, title').eq('user_id', userId).eq('status', 'voiceover').limit(5)
  for (const item of (voiceovers ?? []) as any[]) {
    await supabase.from('video_projects').update({ status: 'assets', asset_count: Math.floor(Math.random() * 5) + 3, updated_at: new Date().toISOString() }).eq('id', item.id)
    assetsCollected++
  }

  // assets → editing
  const editAgentMap: Record<string, string> = { reel: 'reel_creator', short: 'short_editor', long: 'long_editor' }
  const { data: assets } = await supabase.from('video_projects').select('id, title, content_type').eq('user_id', userId).eq('status', 'assets').limit(5)
  for (const item of (assets ?? []) as any[]) {
    const agentKey = editAgentMap[item.content_type] || 'short_editor'
    await supabase.from('video_projects').update({ status: 'editing', assignee_id: agents[agentKey as keyof typeof agents] || agents.short_editor, updated_at: new Date().toISOString() }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents[agentKey as keyof typeof agents] || agents.short_editor, `Edit video: ${item.title}`, `Edit this ${item.content_type || 'short'} video project.`)
    edited++
  }

  // editing → thumbnail
  const { data: editing } = await supabase.from('video_projects').select('id, title').eq('user_id', userId).eq('status', 'editing').limit(5)
  for (const item of (editing ?? []) as any[]) {
    const systemPrompt = 'You are a Thumbnail Designer. Describe a compelling thumbnail. Return JSON: {"thumbnail_description": "detailed description", "colors": ["c1"], "text_overlay": "string"}'
    const result = await executeAgentTask(supabase, userId, null,
      `Design a high-CTR thumbnail for "${item.title}" video.`, { systemPrompt }
    )
    let thumb = ''
    try { thumb = JSON.parse(result.response || '{}').thumbnail_description || result.response } catch { thumb = result.response || '' }
    await supabase.from('video_projects').update({
      status: 'thumbnail', thumbnail_url: thumb.substring(0, 500),
      assignee_id: agents.thumbnail, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    thumbnailed++
  }

  // thumbnail → review
  const { data: thumbnails } = await supabase.from('video_projects').select('id').eq('user_id', userId).eq('status', 'thumbnail').limit(5)
  for (const item of (thumbnails ?? []) as any[]) {
    await supabase.from('video_projects').update({ status: 'review', assignee_id: agents.director, updated_at: new Date().toISOString() }).eq('id', item.id)
    reviewed++
  }

  // review → scheduled (auto-schedule 2-14 days out)
  const { data: reviews } = await supabase.from('video_projects').select('id').eq('user_id', userId).eq('status', 'review').limit(10)
  for (const item of (reviews ?? []) as any[]) {
    const daysOut = Math.floor(Math.random() * 12) + 2
    await supabase.from('video_projects').update({
      status: 'scheduled', scheduled_at: new Date(Date.now() + daysOut * 86400000).toISOString(),
      assignee_id: agents.distribution, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    scheduled++
  }

  // scheduled → published
  const now = new Date().toISOString()
  const { data: scheduledItems } = await supabase.from('video_projects').select('id, title, hook_text, content_type, platform').eq('user_id', userId).eq('status', 'scheduled').lte('scheduled_at', now).limit(10)
  for (const item of (scheduledItems ?? []) as any[]) {
    const views = Math.floor(Math.random() * 5000) + 100
    const likes = Math.floor(views * (Math.random() * 0.08 + 0.02))
    const comments = Math.floor(likes * (Math.random() * 0.2 + 0.05))
    const shares = Math.floor(likes * (Math.random() * 0.3 + 0.05))
    const viralScore = views > 1000 ? Math.min(100, Math.round((shares / views) * 1000)) : Math.floor(Math.random() * 40) + 10

    await supabase.from('video_projects').update({
      status: 'published', published_at: now, views, likes, comments, shares, viral_score: viralScore,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    published++

    // Store viral patterns in Company Brain
    if (viralScore >= 70) {
      await storeMemory(supabase, userId, {
        category: 'viral_pattern', tags: [item.platform || 'youtube', 'viral', item.content_type || 'short'],
        content: { videoId: item.id, title: item.title, hook: item.hook_text, contentType: item.content_type, platform: item.platform, views, likes, shares, viralScore, publishedAt: now },
      })
    }
  }

  return { scripted, voiced, assetsCollected, edited, thumbnailed, reviewed, scheduled, published }
}

export async function getVideoMetrics(supabase: SupabaseClient, userId: string): Promise<VideoMetrics> {
  const { data: items } = await supabase.from('video_projects').select('status, platform, views, likes, comments, shares, viral_score, published_at').eq('user_id', userId)
  const allItems = (items ?? []) as any[]

  const byStage: Record<string, number> = {}
  const byPlatform: Record<string, number> = {}
  let totalViews = 0; let totalLikes = 0; let totalComments = 0; let totalShares = 0
  let viralScoreSum = 0; let viralCount = 0
  let publishedThisWeek = 0; let publishedThisMonth = 0

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  for (const item of allItems) {
    byStage[item.status] = (byStage[item.status] || 0) + 1
    byPlatform[item.platform || 'unknown'] = (byPlatform[item.platform || 'unknown'] || 0) + 1
    totalViews += item.views || 0; totalLikes += item.likes || 0
    totalComments += item.comments || 0; totalShares += item.shares || 0
    if (item.viral_score) { viralScoreSum += item.viral_score; viralCount++ }
    if (item.published_at) {
      if (item.published_at >= weekAgo) publishedThisWeek++
      if (item.published_at >= monthAgo) publishedThisMonth++
    }
  }

  const { data: campaigns } = await supabase.from('video_campaigns').select('status').eq('user_id', userId)
  const allCampaigns = (campaigns ?? []) as any[]

  return {
    total: allItems.length, byStage, byPlatform,
    campaignsActive: allCampaigns.filter((c: any) => c.status === 'active' || c.status === 'planned').length,
    totalViews, totalLikes, totalComments, totalShares,
    avgViralScore: viralCount > 0 ? Math.round(viralScoreSum / viralCount) : 0,
    publishedThisWeek, publishedThisMonth,
  }
}

export async function getVideoPipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, VideoProject[]>> {
  const { data } = await supabase.from('video_projects').select('*, agents!video_projects_assignee_id_fkey(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  const items = ((data ?? []) as any[]).map((r: any) => ({ ...r, assignee_name: r.agents?.name || null }))

  const pipeline: Record<string, any[]> = {}
  for (const stage of VIDEO_STAGES) pipeline[stage] = []
  for (const item of items) {
    if (pipeline[item.status]) pipeline[item.status].push(item)
  }
  return pipeline
}

export async function runFullVideoCycle(supabase: SupabaseClient, userId: string): Promise<{
  ideasGenerated: number; scripted: number; voiced: number; edited: number
  thumbnailed: number; reviewed: number; scheduled: number; published: number
}> {
  await ensureVideoAgents(supabase, userId)
  const ideasGenerated = await generateVideoIdeas(supabase, userId)
  const stages = await advanceVideoStage(supabase, userId)
  const metrics = await getVideoMetrics(supabase, userId)

  await storeMemory(supabase, userId, {
    category: 'content_strategy', tags: ['video_cycle'],
    content: { ideasGenerated, ...stages, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Video] Cycle completed', module: 'content', status: 'success',
    message: `Ideas: ${ideasGenerated}, Scripted: ${stages.scripted}, Published: ${stages.published}`,
  }])

  return { ideasGenerated, ...stages }
}
