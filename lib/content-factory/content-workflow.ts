/**
 * Automated Content Workflow Engine
 *
 * Orchestrates the full pipeline:
 *   Google Trends → News API → Content Agent → Unsplash/Pexels → Calendar → Approvals
 *
 * Every phase feeds into the next. The workflow produces scheduled, approved content.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchGoogleTrends } from '@/lib/business/data-sources'
import type { TrendData } from '@/lib/business/data-sources'
import { getNewsForContentResearch } from '@/lib/integrations/news-sources'
import type { NewsArticle } from '@/lib/integrations/news-sources'
import { getImagesForTopic } from '@/lib/integrations/image-sources'
import type { StockImage } from '@/lib/integrations/image-sources'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

// ─── Types ─────────────────────────────────────────────────

export interface WorkflowContext {
  trends: TrendData[]
  news: NewsArticle[]
  images: StockImage[]
  contentIdeas: ContentIdea[]
  publishedContent: ContentIdea[]
  calendarDays: CalendarDay[]
  approvalQueue: ApprovalItem[]
  errors: string[]
  durationMs: number
  trace: string[]
}

export interface ContentIdea {
  title: string
  body: string
  contentType: 'blog' | 'social_media' | 'ad_copy' | 'email' | 'landing_page'
  platform: string
  topic: string
  category: string
  suggestedImage: StockImage | null
  sourceRef: string
  score: number
}

export interface CalendarDay {
  date: string
  dayLabel: string
  items: CalendarItem[]
}

export interface CalendarItem {
  title: string
  platform: string
  contentType: string
  status: 'draft' | 'scheduled' | 'approved' | 'published'
  imageUrl: string | null
  sourceRef: string
  score: number
}

export interface ApprovalItem {
  id: string
  title: string
  contentType: string
  platform: string
  body: string
  imageUrl: string | null
  score: number
  sources: string[]
}

// ─── System Prompts ────────────────────────────────────────

const CONTENT_STRATEGIST_PROMPT = `You are a Senior Content Strategist for an AI-powered digital agency.
You analyze real market trends and news to create high-performing content strategies.
Every content idea must be specific, timely, actionable, and tied to real data.
You never give generic advice. You output structured JSON only.`

const CONTENT_WRITER_PROMPT = `You are an expert content writer for an AI agency.
Write platform-optimized content that is bold, insightful, and value-first.
Every piece must teach something specific and end with a clear call to action.`

// ─── Phase 1: Research (Trends + News) ─────────────────────

async function phaseResearch(
  supabase: SupabaseClient,
  userId: string,
  trace: string[]
): Promise<{ trends: TrendData[]; news: NewsArticle[] }> {
  trace.push('[Phase 1] Starting market research')

  const [trends, news] = await Promise.all([
    fetchGoogleTrends('US', 15).catch((e) => {
      trace.push(`  Google Trends: ${e.message}`)
      return [] as TrendData[]
    }),
    getNewsForContentResearch(10).catch((e) => {
      trace.push(`  News API: ${e.message}`)
      return [] as NewsArticle[]
    }),
  ])

  trace.push(`  Google Trends: ${trends.length} trending topics`)
  trace.push(`  News Articles: ${news.length} relevant articles`)

  // Store raw data in Company Brain
  if (trends.length > 0) {
    await storeMemory(supabase, userId, {
      category: 'market_research',
      content: { source: 'google_trends', data: trends, timestamp: new Date().toISOString() },
      tags: ['market_research', 'trends'],
    })
  }

  if (news.length > 0) {
    await storeMemory(supabase, userId, {
      category: 'market_research',
      content: { source: 'news_api', data: news, timestamp: new Date().toISOString() },
      tags: ['market_research', 'news'],
    })
  }

  return { trends, news }
}

// ─── Phase 2: Ideation (AI generates content concepts) ─────

async function phaseIdeation(
  supabase: SupabaseClient,
  userId: string,
  trends: TrendData[],
  news: NewsArticle[],
  trace: string[]
): Promise<ContentIdea[]> {
  trace.push('[Phase 2] Generating content ideas from real data')

  const trendText = trends
    .slice(0, 10)
    .map((t) => `[${t.source}] ${t.keyword} — ${t.traffic}`)
    .join('\n')

  const newsText = news
    .slice(0, 8)
    .map((n) => `[${n.category}] ${n.title}`)
    .join('\n')

  if (!trendText && !newsText) {
    trace.push('  No trend or news data — skipping AI ideation')
    return []
  }

  const prompt = `Generate 8 content ideas for Inlight Agency OS (an AI agency operating system) based on these REAL trending topics and news:

TRENDING TOPICS (Google Trends):
${trendText || '(none available — use general AI agency topics)'}

RECENT NEWS:
${newsText || '(none available — use general technology topics)'}

For each idea output a JSON object in this array:
{
  "title": "Compelling content title",
  "body": "2-3 sentence description of the content",
  "contentType": "blog|social_media|ad_copy|email|landing_page",
  "platform": "linkedin|twitter|facebook|blog|email",
  "topic": "topic keyword",
  "category": "ai|automation|saas|marketing|agency|startup|business|technology",
  "sourceRef": "what inspired this idea",
  "score": 0-100 predicted performance
}

Output ONLY the JSON array. No other text.`

  const result = await executeAgentTask(supabase, userId, null, prompt, {
    systemPrompt: CONTENT_STRATEGIST_PROMPT,
  })

  let ideas: ContentIdea[] = []
  try {
    const match = result.response?.match(/\[[\s\S]*\]/)
    if (match) {
      ideas = JSON.parse(match[0]).map((i: any) => ({
        ...i,
        suggestedImage: null,
      }))
    }
  } catch {
    trace.push('  Failed to parse AI content ideas JSON')
  }

  trace.push(`  Generated ${ideas.length} content ideas from AI`)
  return ideas
}

// ─── Phase 3: Image Selection (Unsplash + Pexels) ──────────

async function phaseImages(
  ideas: ContentIdea[],
  trace: string[]
): Promise<ContentIdea[]> {
  trace.push('[Phase 3] Selecting stock images for content')

  const enriched = await Promise.all(
    ideas.map(async (idea) => {
      try {
        const images = await getImagesForTopic(idea.topic, idea.category, 1)
        if (images.length > 0) {
          return { ...idea, suggestedImage: images[0] }
        }
      } catch {
        // No image available — proceed without one
      }
      return idea
    })
  )

  const withImages = enriched.filter((i) => i.suggestedImage !== null)
  trace.push(`  Images found for ${withImages.length}/${enriched.length} ideas`)

  return enriched
}

// ─── Phase 4: Content Generation ──────────────────────────

async function phaseContentGeneration(
  supabase: SupabaseClient,
  userId: string,
  ideas: ContentIdea[],
  trace: string[]
): Promise<ContentIdea[]> {
  trace.push('[Phase 4] Generating full content')

  const CONTENT_TYPES_PROMPT: Record<string, string> = {
    blog: 'Write a complete blog post. Include: headline, introduction, 3-5 subheadings with body, conclusion, and a CTA. SEO-optimized, 800-1200 words.',
    social_media: 'Write a complete social media post. Include: hook (1st line), body with line breaks, and 3-5 hashtags. Max 1500 characters. Platform-specific tone.',
    ad_copy: 'Write compelling ad copy. Include: headline, body, value proposition, and call to action. Conversion-focused, punchy, benefit-driven.',
    email: 'Write a complete email. Include: subject line, preheader, body, and CTA button text. Personalized, engaging, action-oriented.',
    landing_page: 'Write complete landing page copy. Include: hero headline, subheadline, 3 benefit sections with features, social proof, FAQ, and CTA. Persuasive, benefit-focused.',
  }

  const published: ContentIdea[] = []

  for (const idea of ideas) {
    try {
      const imageText = idea.suggestedImage
        ? `\n\nSuggested image: ${idea.suggestedImage.alt} (${idea.suggestedImage.url})\nCredit: ${idea.suggestedImage.photographer} — ${idea.suggestedImage.photographerUrl}`
        : ''

      const typePrompt = CONTENT_TYPES_PROMPT[idea.contentType] || CONTENT_TYPES_PROMPT.blog
      const sources = []
      if (trendsMatched(idea)) sources.push('Google Trends')
      if (idea.sourceRef?.includes('news')) sources.push('News API')

      const prompt = `Create content based on:\n\nTopic: ${idea.topic}\nTitle: ${idea.title}\nDescription: ${idea.body}\nPlatform: ${idea.platform}\nCategory: ${idea.category}\nData sources: ${sources.join(', ') || 'General knowledge'}\n\n${typePrompt}\n\nWrite the complete content now.${imageText}`

      const result = await executeAgentTask(supabase, userId, null, prompt, {
        systemPrompt: CONTENT_WRITER_PROMPT,
      })

      const contentBody = result.response || ''

      // Store in content_requests table
      const { data: request } = await supabase
        .from('content_requests')
        .insert([{
          user_id: userId,
          title: idea.title,
          description: idea.body,
          content_type: idea.contentType,
          platform: idea.platform,
          generated_content: contentBody,
          status: 'draft',
          word_count: contentBody.split(/\s+/).length,
          score: idea.score,
          metadata: {
            topic: idea.topic,
            category: idea.category,
            sourceRef: idea.sourceRef,
            imageUrl: idea.suggestedImage?.url || null,
            photographer: idea.suggestedImage?.photographer || null,
            imageSource: idea.suggestedImage?.source || null,
          },
        }])
        .select('id')
        .single()

      if (request) {
        // Create approval request
        await supabase.from('agent_approval_requests').insert([{
          user_id: userId,
          agent_id: null,
          action: 'content_action',
          target_type: 'content_request',
          target_id: request.id,
          summary: `Content for approval: "${idea.title}" (${idea.contentType})`,
          justification: `Generated from ${sources.join(' + ') || 'AI strategy'}. Score: ${idea.score}/100.`,
          impact: 'medium',
          proposed_change: {
            title: idea.title,
            contentType: idea.contentType,
            platform: idea.platform,
            wordCount: contentBody.split(/\s+/).length,
          },
          current_state: {},
          task_id: null,
          status: 'pending',
        }])

        published.push(idea)
        trace.push(`  ✓ ${idea.contentType}: "${idea.title.slice(0, 50)}..."`)
      }
    } catch (e: any) {
      trace.push(`  ✗ Failed: "${idea.title}" — ${e.message}`)
    }
  }

  trace.push(`  Published ${published.length}/${ideas.length} content pieces to approval queue`)
  return published
}

// ─── Phase 5: Calendar Scheduling ──────────────────────────

async function phaseCalendar(
  supabase: SupabaseClient,
  userId: string,
  ideas: ContentIdea[],
  trace: string[]
): Promise<CalendarDay[]> {
  trace.push('[Phase 5] Building content calendar')

  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const weekStart = monday.toISOString().split('T')[0]

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const platforms = ['linkedin', 'linkedin', 'linkedin', 'linkedin', 'linkedin']
  const contentTypes = ['social_media', 'blog', 'social_media', 'email', 'social_media']

  const calendar: CalendarDay[] = []

  for (let i = 0; i < days.length; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]

    const dayIdea = ideas[i % ideas.length] || null
    const items: CalendarItem[] = []

    if (dayIdea) {
      items.push({
        title: dayIdea.title,
        platform: platforms[i],
        contentType: contentTypes[i],
        status: 'draft',
        imageUrl: dayIdea.suggestedImage?.url || null,
        sourceRef: dayIdea.sourceRef,
        score: dayIdea.score,
      })
    }

    // Store calendar entry
    await supabase.from('content_factory_calendar').upsert({
      user_id: userId,
      week_start: weekStart,
      day_of_week: i + 1,
      platform: platforms[i],
      content_type: contentTypes[i],
      title: dayIdea?.title || `${days[i]} post`,
      status: 'scheduled',
    }, { onConflict: 'user_id, week_start, day_of_week, platform', ignoreDuplicates: false })

    calendar.push({
      date: dateStr,
      dayLabel: days[i],
      items,
    })
  }

  // Store weekly plan
  await supabase.from('content_factory_weekly_plans').upsert({
    user_id: userId,
    week_start: weekStart,
    plan: { days: calendar.map((d) => ({ date: d.date, items: d.items })) },
    status: 'active',
  }, { onConflict: 'user_id, week_start', ignoreDuplicates: false })

  trace.push(`  Calendar built: ${calendar.length} days starting ${weekStart}`)
  return calendar
}

// ─── Phase 6: Summary & Logging ───────────────────────────

async function phaseSummary(
  supabase: SupabaseClient,
  userId: string,
  ctx: WorkflowContext
): Promise<void> {
  const memorySummary = {
    workflowVersion: '1.0',
    trendsFound: ctx.trends.length,
    newsArticles: ctx.news.length,
    imagesFound: ctx.contentIdeas.filter((i) => i.suggestedImage).length,
    ideasGenerated: ctx.contentIdeas.length,
    contentPublished: ctx.publishedContent.length,
    calendarDaysScheduled: ctx.calendarDays.length,
    approvalItems: ctx.approvalQueue.length,
    errors: ctx.errors.length,
    durationMs: ctx.durationMs,
    completedAt: new Date().toISOString(),
  }

  await storeMemory(supabase, userId, {
    category: 'workflow_output',
    content: {
      stepLabel: 'content_workflow_run',
      workflowName: 'Automated Content Pipeline',
      output: `Completed: ${memorySummary.contentPublished} pieces, ${memorySummary.calendarDaysScheduled} calendar days, ${memorySummary.approvalItems} awaiting approval`,
      summary: memorySummary,
    },
    tags: ['content', 'workflow', 'automated', `published:${memorySummary.contentPublished}`],
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId,
    command_id: null,
    action: '[ContentWorkflow] Pipeline completed',
    module: 'content',
    status: ctx.errors.length > 0 ? 'failed' : 'success',
    message: [
      `${ctx.publishedContent.length} pieces | ${ctx.calendarDays.length} days`,
      `${ctx.trends.length} trends | ${ctx.news.length} news | ${ctx.contentIdeas.filter((i) => i.suggestedImage).length} images`,
      `${ctx.approvalQueue.length} awaiting approval`,
      `${(ctx.durationMs / 1000).toFixed(1)}s`,
    ].join(' | '),
  }])
}

// ─── Main Pipeline ─────────────────────────────────────────

export async function runContentWorkflow(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkflowContext> {
  const startTime = Date.now()
  const trace: string[] = []
  const errors: string[] = []

  const ctx: WorkflowContext = {
    trends: [],
    news: [],
    images: [],
    contentIdeas: [],
    publishedContent: [],
    calendarDays: [],
    approvalQueue: [],
    errors,
    durationMs: 0,
    trace,
  }

  try {
    // Phase 1: Research
    const research = await phaseResearch(supabase, userId, trace)
    ctx.trends = research.trends
    ctx.news = research.news
  } catch (e: any) {
    errors.push(`Research: ${e.message}`)
    trace.push(`  ERROR: ${e.message}`)
  }

  try {
    // Phase 2: Ideation
    ctx.contentIdeas = await phaseIdeation(supabase, userId, ctx.trends, ctx.news, trace)
  } catch (e: any) {
    errors.push(`Ideation: ${e.message}`)
    trace.push(`  ERROR: ${e.message}`)
  }

  if (ctx.contentIdeas.length > 0) {
    try {
      // Phase 3: Images
      ctx.contentIdeas = await phaseImages(ctx.contentIdeas, trace)
      ctx.images = ctx.contentIdeas
        .filter((i) => i.suggestedImage)
        .map((i) => i.suggestedImage!)
    } catch (e: any) {
      errors.push(`Images: ${e.message}`)
      trace.push(`  ERROR: ${e.message}`)
    }

    try {
      // Phase 4: Content Generation
      ctx.publishedContent = await phaseContentGeneration(supabase, userId, ctx.contentIdeas, trace)
      ctx.approvalQueue = ctx.publishedContent.map((i) => ({
        id: `approval_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: i.title,
        contentType: i.contentType,
        platform: i.platform,
        body: i.body,
        imageUrl: i.suggestedImage?.url || null,
        score: i.score,
        sources: [i.sourceRef, 'AI Generated'].filter(Boolean),
      }))
    } catch (e: any) {
      errors.push(`Content Generation: ${e.message}`)
      trace.push(`  ERROR: ${e.message}`)
    }

    try {
      // Phase 5: Calendar
      ctx.calendarDays = await phaseCalendar(supabase, userId, ctx.contentIdeas, trace)
    } catch (e: any) {
      errors.push(`Calendar: ${e.message}`)
      trace.push(`  ERROR: ${e.message}`)
    }
  } else {
    trace.push('[SKIP] No content ideas generated — skipping images, content, and calendar')
  }

  // Phase 6: Summary
  ctx.durationMs = Date.now() - startTime
  trace.push(`[Complete] ${(ctx.durationMs / 1000).toFixed(1)}s total`)

  try {
    await phaseSummary(supabase, userId, ctx)
  } catch (e: any) {
    errors.push(`Summary: ${e.message}`)
  }

  ctx.errors = errors
  return ctx
}

// ─── Helper ────────────────────────────────────────────────

function trendsMatched(idea: ContentIdea): boolean {
  const trendKeywords = ['trend', 'google', 'rising', 'popular']
  return trendKeywords.some((kw) => idea.sourceRef?.toLowerCase().includes(kw))
}
