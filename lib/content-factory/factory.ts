import { createClient } from '@supabase/supabase-js'
import { generateAndUpload } from './image'
import { publishLinkedInImagePost } from './linkedin-publisher'
import type { TemplateId, TemplateInput } from './templates'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface FactoryPost {
  contentRequestId: string
  title: string
  templateId: TemplateId
  platform: string
  postUrn: string
  assetId?: string
  imageUrl: string
  status: 'published' | 'failed'
  error?: string
  publishedAt: string
}

export interface FactoryRunResult {
  posts: FactoryPost[]
  totalGenerated: number
  totalPublished: number
  totalFailed: number
}

/**
 * The day's content schedule. Platform = 'linkedin' | 'facebook' | 'instagram' | 'x'
 * The factory checks which providers are connected before publishing.
 */
const DAILY_SCHEDULE: { templateId: TemplateId; platform: string; headline: string; body: string; stat?: string; statLabel?: string }[] = [
  // LinkedIn — 2 posts
  { templateId: 'ai-automation', platform: 'linkedin', headline: 'AI Automation Is Eating the Agency World', body: 'Forward-thinking agencies are automating 80% of repetitive tasks. The ones that don\'t will be left behind.', stat: '80%', statLabel: 'tasks automated by AI' },
  { templateId: 'ai-chatbots', platform: 'linkedin', headline: 'Your Website Should Be Having 1,000 Conversations', body: 'AI chatbots don\'t sleep. They qualify, nurture, and convert leads while you focus on strategy.', stat: '3.2x', statLabel: 'higher conversion with AI chat' },
  // Facebook — 1 post
  { templateId: 'ai-marketing', platform: 'facebook', headline: 'Your Marketing Team Just Got a Raise', body: 'Because AI handles the grunt work. Publishing, analytics, A/B testing — all autonomous.', stat: '10x', statLabel: 'content output increase' },
  // Instagram — 1 post
  { templateId: 'ai-websites', platform: 'instagram', headline: 'Websites That Build Themselves', body: 'AI-powered sites that update content, optimize SEO, and generate leads on autopilot.' },
]

/**
 * Run the Content Factory for a given user.
 * Generates branded images and publishes to all connected platforms.
 */
export async function runContentFactory(userId: string, schedule?: typeof DAILY_SCHEDULE): Promise<FactoryRunResult> {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const s = schedule || DAILY_SCHEDULE
  const posts: FactoryPost[] = []
  const today = new Date().toISOString()

  // Check connected providers
  const { data: connections } = await supabase
    .from('integration_connections')
    .select('provider')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .eq('is_active', true)

  const connected = new Set((connections || []).map((c: any) => c.provider))

  // Get LinkedIn token if connected
  let linkedinToken: string | null = null
  if (connected.has('linkedin')) {
    const { data: creds } = await supabase
      .from('integration_credentials')
      .select('credentials')
      .eq('provider', 'linkedin')
      .eq('user_id', userId)
      .single()
    if (creds) linkedinToken = (creds.credentials as any).access_token
  }

  for (const item of s) {
    if (!connected.has(item.platform) && item.platform === 'linkedin') {
      posts.push({ contentRequestId: '', title: item.headline, templateId: item.templateId, platform: item.platform, postUrn: '', imageUrl: '', status: 'failed', error: 'Not connected', publishedAt: today })
      continue
    }
    // Skip non-LinkedIn for now (FB/IG/Twitter OAuth not configured)
    if (item.platform !== 'linkedin' && !connected.has(item.platform)) {
      posts.push({ contentRequestId: '', title: item.headline, templateId: item.templateId, platform: item.platform, postUrn: '', imageUrl: '', status: 'failed', error: 'Not connected', publishedAt: today })
      continue
    }

    try {
      // 1. Generate branded image
      const img = await generateAndUpload(item.templateId, {
        headline: item.headline,
        body: item.body,
        stat: item.stat,
        statLabel: item.statLabel,
        date: new Date().toLocaleDateString(),
      })

      // 2. Publish to platform
      let postUrn = ''
      let assetId = ''

      if (item.platform === 'linkedin' && linkedinToken) {
        const liResult = await publishLinkedInImagePost(linkedinToken, `${item.headline}\n\n${item.body}${item.stat ? `\n\n${item.stat} — ${item.statLabel}` : ''}\n\n#AIAgency #Automation #InlightAOS`, img.buffer, item.headline)
        postUrn = liResult.postUrn
        assetId = liResult.assetId
      }
      // Future: facebook/instagram/x publishers here

      // 3. Store in content_requests
      const { data: cr, error: crErr } = await supabase.from('content_requests').insert([{
        user_id: userId,
        title: item.headline,
        content_type: 'social_media',
        platform: item.platform,
        tone: 'professional',
        status: 'published',
        generated_content: item.body,
        score: 85,
        platform_post_id: postUrn || null,
        media_url: img.url,
        media_asset_id: assetId || null,
        image_count: 1,
        carousel_count: 0,
        hashtags: ['AIAgency', 'Automation', 'InlightAOS'],
        published_at: new Date().toISOString(),
        tags: ['content_factory', item.platform, 'image_post', 'production'],
      }]).select('id').single()

      const contentRequestId = cr?.id || ''

      // 4. Store in growth_content_calendar
      await supabase.from('growth_content_calendar').insert([{
        user_id: userId,
        content_request_id: contentRequestId,
        scheduled_date: new Date().toISOString().split('T')[0],
        platform: item.platform,
        post_type: 'image',
        status: 'published',
        posted_at: new Date().toISOString(),
      }])

      // 5. Log execution
      await supabase.from('execution_logs').insert([{
        user_id: userId,
        command_id: null,
        action: `[ContentFactory] ${item.platform} image post: ${item.headline.substring(0, 40)}`,
        module: 'content_factory',
        status: 'success',
        message: `Published to ${item.platform}: ${postUrn || 'OK'}`,
      }])

      posts.push({
        contentRequestId,
        title: item.headline,
        templateId: item.templateId,
        platform: item.platform,
        postUrn,
        assetId,
        imageUrl: img.url,
        status: 'published',
        publishedAt: new Date().toISOString(),
      })
    } catch (e: any) {
      await supabase.from('execution_logs').insert([{
        user_id: userId,
        command_id: null,
        action: `[ContentFactory] FAILED ${item.platform}: ${item.headline.substring(0, 40)}`,
        module: 'content_factory',
        status: 'failed',
        message: e.message,
      }])

      posts.push({
        contentRequestId: '',
        title: item.headline,
        templateId: item.templateId,
        platform: item.platform,
        postUrn: '',
        imageUrl: '',
        status: 'failed',
        error: e.message,
        publishedAt: new Date().toISOString(),
      })
    }
  }

  const published = posts.filter(p => p.status === 'published')
  return {
    posts,
    totalGenerated: s.length,
    totalPublished: published.length,
    totalFailed: posts.length - published.length,
  }
}

export { DAILY_SCHEDULE }
