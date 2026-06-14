import { BaseContentFactoryModule, type ContentIdea } from './types'
import { executeAgentTask } from '@/lib/ai/execution'
import { HookEngine } from '@/lib/reels/hook-engine'
import { ScriptEngine } from '@/lib/reels/script-engine'

const CAROUSEL_TEMPLATES = [
  { slides: 5, style: 'numbered-list', title: 'X Ways to Y' },
  { slides: 4, style: 'comparison', title: 'Before/After: Z' },
  { slides: 6, style: 'step-by-step', title: 'How to W in X Steps' },
  { slides: 3, style: 'stat-driven', title: 'X Statistics That Prove Y' },
]

const REEL_SCRIPTS = [
  { duration: 15, hookType: 'curiosity', structure: 'hook → insight → CTA' },
  { duration: 30, hookType: 'problem', structure: 'problem → solution → proof → CTA' },
  { duration: 60, hookType: 'story', structure: 'story → lesson → application → CTA' },
]

export class PostWriter extends BaseContentFactoryModule {
  async writePosts(ideas: ContentIdea[], count = 5): Promise<ContentIdea[]> {
    await this.log('Post writing started', `Writing ${count} LinkedIn posts`)
    const hookEngine = new HookEngine(this.supabase, this.userId)

    const written: ContentIdea[] = []
    for (const idea of ideas.slice(0, count)) {
      const hooks = await hookEngine.generateHooks(idea.topic, 3)
      const bestHook = hooks[0]

      const prompt = `Write a complete LinkedIn post based on this content idea:

TOPIC: ${idea.topic}
TITLE: ${idea.title}
HOOK: ${bestHook?.hookText || idea.hook}

Write the full post including:
- Attention-grabbing first line
- Body with insights and value
- Line breaks for readability
- CTA that drives engagement
- 3-5 relevant hashtags

Keep it professional yet conversational. Max 1500 characters.`

      const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
        systemPrompt: `You write high-engagement LinkedIn posts for an AI agency. Bold, insightful, value-first. Every post must teach something specific.`,
      })

      const post: ContentIdea = {
        ...idea,
        contentType: 'post',
        platform: 'linkedin',
        hook: bestHook?.hookText || idea.hook,
        body: result.response || idea.body,
        caption: result.response || '',
        score: bestHook?.score || idea.score,
      }

      await this.supabase.from('content_factory_ideas').insert([{
        user_id: this.userId,
        title: idea.title, topic: idea.topic, category: idea.category,
        content_type: 'post', platform: 'linkedin',
        hook: post.hook, body: post.body, caption: post.caption,
        hashtags: post.hashtags, source: idea.source, source_ref: idea.sourceRef || '',
        score: post.score, status: 'draft',
      }])

      written.push(post)
    }

    await this.log('Posts written', `${written.length} LinkedIn posts created`)
    return written
  }
}

export class CarouselCreator extends BaseContentFactoryModule {
  async createCarousels(ideas: ContentIdea[], count = 5): Promise<ContentIdea[]> {
    await this.log('Carousel creation started', `Creating ${count} carousel concepts`)
    const created: ContentIdea[] = []

    for (let i = 0; i < Math.min(count, ideas.length); i++) {
      const idea = ideas[i]
      const template = CAROUSEL_TEMPLATES[i % CAROUSEL_TEMPLATES.length]

      const prompt = `Create a LinkedIn carousel (${template.slides} slides) about:

TOPIC: ${idea.topic}
STYLE: ${template.style}
TITLE: ${template.title.replace('X', String(template.slides)).replace('Y', idea.category).replace('Z', idea.topic)}

For each slide provide:
- Slide headline (max 8 words)
- Key point (1-2 sentences)
- Visual description (for designer)

Also provide:
- Caption for the post
- 5 hashtags

Output as JSON.`

      const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
        systemPrompt: `You create high-performance LinkedIn carousels. Each slide must deliver one clear idea. Carousels should be scannable, valuable, and shareable.`,
      })

      created.push({
        ...idea,
        contentType: 'carousel',
        platform: 'linkedin',
        body: result.response || idea.body,
        caption: idea.caption,
        score: idea.score,
      })
    }

    await this.log('Carousels created', `${created.length} carousel concepts`)
    return created
  }
}

export class ReelScriptWriter extends BaseContentFactoryModule {
  async writeReelScripts(ideas: ContentIdea[], count = 3): Promise<ContentIdea[]> {
    await this.log('Reel script writing started', `Writing ${count} reel scripts`)
    const scriptEngine = new ScriptEngine(this.supabase, this.userId)
    const scripts = await scriptEngine.generateScripts(ideas[0]?.topic || 'AI automation', count)

    const created: ContentIdea[] = scripts.map(s => ({
      title: s.title,
      topic: s.topic,
      category: s.category as string,
      contentType: 'reel' as const,
      platform: 'linkedin',
      hook: s.hookText,
      body: s.bodyText,
      caption: s.caption,
      hashtags: s.hashtags,
      source: 'ai',
      sourceRef: `hook:${s.hookType}`,
      score: s.predictedPerformance,
    }))

    for (const script of created) {
      await this.supabase.from('content_factory_ideas').insert([{
        user_id: this.userId, title: script.title, topic: script.topic, category: script.category,
        content_type: 'reel', platform: script.platform,
        hook: script.hook, body: script.body, caption: script.caption,
        hashtags: script.hashtags, source: script.source, source_ref: script.sourceRef || '',
        score: script.score, status: 'draft',
      }])
    }

    await this.log('Reel scripts written', `${created.length} scripts (${scripts.map(s => s.durationSeconds + 's').join(', ')})`)
    return created
  }
}
