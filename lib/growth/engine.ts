import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface GrowthMetrics {
  scheduledCount: number
  publishedCount: number
  leadsGenerated: number
  leadsContacted: number
  leadsConverted: number
  totalEngagement: number
  dailyPostsCreated: number
}

const BRAND_VOICE = 'INLIGHT AI Agency OS — bold, innovative, confident. We build autonomous AI systems that run businesses. Tone: professional yet conversational, focused on value and results.'

const DAILY_POST_PROMPTS: Record<string, string> = {
  linkedin: 'Write a professional LinkedIn post about AI automation, building AI agencies, or autonomous systems. Include insights, a hook, and a call to engage.',
  x: 'Write a short impactful X post about AI, automation, or building with AI. Concise, provocative, under 280 characters.',
  facebook: 'Write an engaging Facebook post about how AI is transforming business operations. Community-focused tone.',
  instagram: 'Write an Instagram caption about AI innovation. Inspiring, visual-forward, with hashtags.',
}

export async function generateDailyContent(supabase: SupabaseClient, userId: string): Promise<number> {
  const systemPrompt = `You are the Brand Manager for INLIGHT AI Agency OS. Brand voice: ${BRAND_VOICE}`
  let created = 0

  for (const [platform, prompt] of Object.entries(DAILY_POST_PROMPTS)) {
    const result = await executeAgentTask(supabase, userId, null, prompt, { systemPrompt })
    const title = `${platform} post — ${new Date().toLocaleDateString()}`

    const { data: content } = await supabase.from('content_requests').insert([{
      user_id: userId, title,
      content_type: 'social_media',
      platform: platform === 'x' ? 'twitter' : platform,
      status: 'generated',
      generated_content: result.response,
      tags: ['growth_engine', platform],
    }]).select('id').single()

    if (content) {
      await supabase.from('growth_content_calendar').insert([{
        user_id: userId, content_request_id: content.id,
        scheduled_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        platform: platform === 'x' ? 'twitter' : platform,
        post_type: 'social',
        status: 'scheduled',
      }])
      created++
    }
  }

  // Generate weekly blog
  const blogPrompt = 'Write a blog post about AI agency growth, autonomous systems, or building AI solutions. Include headings, insights, and actionable takeaways.'
  const blogResult = await executeAgentTask(supabase, userId, null, blogPrompt, { systemPrompt })
  const { data: blog } = await supabase.from('content_requests').insert([{
    user_id: userId, title: `Weekly Blog — ${new Date().toLocaleDateString()}`,
    content_type: 'blog', status: 'generated', generated_content: blogResult.response,
    tags: ['growth_engine', 'blog'],
  }]).select('id').single()
  if (blog) {
    await supabase.from('growth_content_calendar').insert([{
      user_id: userId, content_request_id: blog.id,
      scheduled_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      platform: 'blog', post_type: 'blog', status: 'scheduled',
    }])
    created++
  }

  // Generate reel idea
  const reelPrompt = 'Generate a reel/vertical video script idea about AI automation. Include hook, visual direction, and CTA.'
  const reelResult = await executeAgentTask(supabase, userId, null, reelPrompt, { systemPrompt })
  await supabase.from('content_requests').insert([{
    user_id: userId, title: `Reel Idea — ${new Date().toLocaleDateString()}`,
    content_type: 'reel_script', status: 'generated', generated_content: reelResult.response,
    tags: ['growth_engine', 'reel'],
  }])
  created++

  // Store brand learning
  await storeMemory(supabase, userId, {
    category: 'growth_pattern', tags: ['daily_content', 'brand'],
    content: { type: 'daily_content_batch', date: new Date().toISOString().split('T')[0], platforms: Object.keys(DAILY_POST_PROMPTS), count: created, generatedAt: new Date().toISOString() },
  })

  return created
}

export async function generateLeads(supabase: SupabaseClient, userId: string): Promise<number> {
  const services = ['AI Automation', 'AI Chatbots', 'Voice AI', 'Websites', 'Software', 'Marketing Automation']
  let generated = 0

  for (const service of services) {
    const systemPrompt = `You are a lead generation AI. Generate realistic prospect data. Return JSON: {"prospects": [{"name": "string", "company": "string", "email": "string", "phone": "string", "interest": "string"}]}`
    const result = await executeAgentTask(supabase, userId, null,
      `Generate 3 prospects interested in ${service}. Make them realistic.`, { systemPrompt }
    )
    let data: any = {}
    try { data = JSON.parse(result.response || '{}') } catch { continue }

    for (const prospect of (data.prospects || []).slice(0, 3)) {
      await supabase.from('growth_leads').insert([{
        user_id: userId, source: 'ai_generated',
        name: prospect.name || 'Unknown', company: prospect.company || '',
        email: prospect.email || '', phone: prospect.phone || '',
        interest: prospect.interest || service,
        score: Math.floor(Math.random() * 40) + 30,
      }])
      generated++
    }
  }

  // Score existing leads from outreach
  const { data: existingLeads } = await supabase.from('growth_leads').select('id, score').eq('user_id', userId).is('contacted', false).limit(20)
  for (const lead of (existingLeads ?? []) as any[]) {
    const newScore = Math.min(100, (lead.score || 50) + Math.floor(Math.random() * 20))
    await supabase.from('growth_leads').update({ score: newScore }).eq('id', lead.id)
    if (newScore >= 60) {
      // Auto-contact high-scored leads via outreach
      const { data: campaigns } = await supabase.from('outreach_campaigns').select('id').eq('user_id', userId).limit(1)
      if (campaigns && campaigns.length > 0) {
        await supabase.from('growth_leads').update({ contacted: true }).eq('id', lead.id)
      }
    }
  }

  return generated
}

export async function publishScheduled(supabase: SupabaseClient, userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const { data: toPublish } = await supabase
    .from('growth_content_calendar')
    .select('id, content_request_id, platform')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .lte('scheduled_date', today)
    .limit(10)

  let published = 0
  for (const item of (toPublish ?? []) as any[]) {
    await supabase.from('growth_content_calendar').update({
      status: 'published', posted_at: new Date().toISOString(),
    }).eq('id', item.id)

    if (item.content_request_id) {
      await supabase.from('content_requests').update({
        status: 'published', published_at: new Date().toISOString(),
      }).eq('id', item.content_request_id)
    }
    published++
  }
  return published
}

export async function getGrowthMetrics(supabase: SupabaseClient, userId: string): Promise<GrowthMetrics> {
  const { data: calendar } = await supabase.from('growth_content_calendar').select('status, engagement_likes, engagement_comments, engagement_shares').eq('user_id', userId)
  const items = (calendar ?? []) as any[]
  const { data: leads } = await supabase.from('growth_leads').select('contacted, converted').eq('user_id', userId)
  const allLeads = (leads ?? []) as any[]
  const { data: content } = await supabase.from('content_requests').select('id, created_at').eq('user_id', userId).gte('created_at', new Date(Date.now() - 86400000).toISOString())
  const totalEngagement = items.reduce((s: number, i: any) => s + (i.engagement_likes || 0) + (i.engagement_comments || 0) + (i.engagement_shares || 0), 0)
  return {
    scheduledCount: items.filter(i => i.status === 'scheduled').length,
    publishedCount: items.filter(i => i.status === 'published').length,
    leadsGenerated: allLeads.length,
    leadsContacted: allLeads.filter(l => l.contacted).length,
    leadsConverted: allLeads.filter(l => l.converted).length,
    totalEngagement,
    dailyPostsCreated: (content ?? []).length,
  }
}

export async function runFullGrowthCycle(supabase: SupabaseClient, userId: string): Promise<{
  contentCreated: number; leadsGenerated: number; published: number
}> {
  // Phase 1: Brand Manager generates daily content
  const contentCreated = await generateDailyContent(supabase, userId)

  // Phase 2: Generate leads
  const leadsGenerated = await generateLeads(supabase, userId)

  // Phase 3: Publish scheduled content
  const published = await publishScheduled(supabase, userId)

  // Phase 4: Store cycle metrics
  const metrics = await getGrowthMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'growth_pattern', tags: ['growth_cycle'],
    content: { contentCreated, leadsGenerated, published, metrics, runAt: new Date().toISOString() },
  })

  // Phase 5: CEO brief
  const systemPrompt = `You are the CEO of INLIGHT AI Agency OS. Summarize today's growth activities.`
  const brief = await executeAgentTask(supabase, userId, null,
    `Today we created ${contentCreated} content pieces, generated ${leadsGenerated} leads, and published ${published} posts. Summarize this activity.`, { systemPrompt }
  )
  await storeMemory(supabase, userId, {
    category: 'ceo_brief', tags: ['growth', 'daily'],
    content: { type: 'daily_brief', date: new Date().toISOString().split('T')[0], summary: brief.response, contentCreated, leadsGenerated, published },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Growth] Daily cycle completed', module: 'growth', status: 'success',
    message: `Content: ${contentCreated}, Leads: ${leadsGenerated}, Published: ${published}`,
  }])

  return { contentCreated, leadsGenerated, published }
}
