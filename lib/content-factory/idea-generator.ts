import { BaseContentFactoryModule, type ContentIdea } from './types'
import { fetchGoogleTrends, fetchRedditTrends, fetchYouTubeTrending } from '@/lib/business/data-sources'
import { executeAgentTask } from '@/lib/ai/execution'

export class ContentIdeaGenerator extends BaseContentFactoryModule {
  async generate(count = 10): Promise<ContentIdea[]> {
    await this.log('Content idea generation started', 'Scanning Google Trends + Reddit + YouTube')

    // REAL DATA: Google Trends
    const trends = await fetchGoogleTrends('US', 15)
    await this.storeBrain('raw_trends', { trends }, ['trends'])

    // REAL DATA: Reddit discussions
    const discussions = await fetchRedditTrends(['artificial', 'technology', 'Entrepreneur', 'marketing', 'agency'], 3)
    await this.storeBrain('raw_discussions', { discussions }, ['discussions'])

    // REAL DATA: YouTube trending
    const videos = await fetchYouTubeTrending(10)

    const allSources = [
      ...trends.map(t => ({ keyword: t.keyword, source: 'google_trends', ref: t.traffic })),
      ...discussions.map(d => ({ keyword: d.keyword, source: 'reddit', ref: d.traffic })),
      ...videos.map(v => ({ keyword: v.keyword, source: 'youtube', ref: v.traffic })),
    ].filter(s => s.keyword.length > 5)

    // Use AI to generate content ideas from real trend data
    const prompt = `Generate ${count} content ideas for Inlight Agency OS (AI automation agency) based on these REAL trending topics:

TRENDING TOPICS:
${allSources.slice(0, 25).map((s, i) => `${i+1}. [${s.source}] ${s.keyword}`).join('\n')}

For each idea output a JSON object:
{
  "title": "Post title/hook",
  "topic": "topic category",
  "category": "ai|automation|business|marketing|technology",
  "contentType": "post|carousel|reel",
  "platform": "linkedin|facebook|instagram|x",
  "hook": "The hook sentence",
  "body": "Main content body (2-3 sentences)",
  "caption": "Full caption with line breaks",
  "hashtags": ["#tag1", "#tag2"],
  "source": "which source this came from",
  "score": 0-100 predicted performance
}

Output as JSON array. Make each idea specific, actionable, and tied to the real trending topics above. Include a mix of content types.`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: `You are a Senior Content Strategist for an AI agency. You create high-performing content ideas based on real market trends. Every idea must be specific, timely, and actionable. You never give generic advice.`,
    })

    let ideas: ContentIdea[] = []
    try {
      const match = result.response?.match(/\[[\s\S]*\]/)
      if (match) ideas = JSON.parse(match[0])
    } catch {}

    // Fallback: if AI returned empty, generate from trend data directly
    if (ideas.length === 0 && trends.length > 0) {
      ideas = trends.slice(0, count).map((t, i) => ({
        title: t.keyword,
        topic: t.category,
        category: t.category,
        contentType: i % 3 === 0 ? 'post' as const : i % 3 === 1 ? 'carousel' as const : 'reel' as const,
        platform: 'linkedin',
        hook: `The truth about ${t.keyword} nobody talks about`,
        body: `${t.keyword} is transforming how agencies operate. Here's what you need to know. From ${t.source}.`,
        caption: `${t.keyword}\n\nThis trend is gaining traction. Here's what it means for AI agencies.\n\n#AIAgency #${t.category}`,
        hashtags: ['#AIAgency', `#${t.category}`],
        source: t.source,
        sourceRef: t.traffic || t.source,
        score: Math.min(99, 50 + i * 5),
      }))
    }

    // Store in database
    let stored = 0
    for (const idea of ideas.slice(0, count)) {
      await this.supabase.from('content_factory_ideas').insert([{
        user_id: this.userId,
        title: idea.title,
        topic: idea.topic || 'general',
        category: idea.category || 'general',
        content_type: idea.contentType || 'post',
        platform: idea.platform || 'linkedin',
        hook: idea.hook || idea.title,
        body: idea.body || '',
        caption: idea.caption || '',
        hashtags: idea.hashtags || [],
        source: idea.source || 'ai',
        source_ref: idea.sourceRef || '',
        score: Math.min(99, Math.max(1, idea.score || 50)),
        status: 'draft',
      }])
      stored++
    }

    await this.log('Content ideas generated',
      `${stored} ideas from ${trends.length} Google Trends, ${discussions.length} Reddit threads, ${videos.length} YouTube videos`)

    return ideas.slice(0, count)
  }
}
