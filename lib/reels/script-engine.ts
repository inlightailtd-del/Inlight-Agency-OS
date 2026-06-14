import { BaseReelsModule, type Script, type HookType, type ReelDuration, type ReelTone, type ReelCategory } from './types'
import { HookEngine } from './hook-engine'
import { TrendScanner } from './trend-scanner'

const DURATION_OPTIONS: ReelDuration[] = [15, 30, 60]
const TONE_OPTIONS: ReelTone[] = ['professional', 'casual', 'urgent', 'inspirational', 'humorous']

const SCRIPT_TEMPLATES: Record<ReelDuration, { hookPct: number; bodyPct: number; ctaPct: number; wordCount: number }> = {
  15: { hookPct: 40, bodyPct: 40, ctaPct: 20, wordCount: 30 },
  30: { hookPct: 30, bodyPct: 50, ctaPct: 20, wordCount: 60 },
  60: { hookPct: 20, bodyPct: 60, ctaPct: 20, wordCount: 120 },
}

const CAPTION_TEMPLATES = [
  'This changes everything for {topic}. 🚀\n\n{body}\n\nFollow @inlight_agency for more {topic} insights.',
  'Stop doing {topic} the old way. ⚡️\n\n{body}\n\nSave this for later! 📌',
  '{hook}\n\nHere\'s the truth about {topic} 👇\n{body}\n\n#AIAgency #{topic_tag}',
  'I wish I knew this about {topic} sooner.\n\n{body}\n\nTag someone who needs to see this 👥',
]

const HASHTAG_POOL = [
  '#AIAgency', '#AIAutomation', '#AI', '#ArtificialIntelligence',
  '#Automation', '#DigitalAgency', '#MarketingAgency', '#AITools',
  '#BusinessGrowth', '#AIBusiness', '#FutureOfWork', '#Innovation',
  '#TechTrends', '#AIMarketing', '#MachineLearning', '#SaaS',
  '#GrowthHacking', '#ContentCreation', '#VideoMarketing', '#Reels',
  '#AIAgents', '#WorkflowAutomation', '#SmartAutomation', '#AITrends',
]

export class ScriptEngine extends BaseReelsModule {
  async generateScripts(topic?: string, count = 5): Promise<Script[]> {
    const trendScanner = new TrendScanner(this.supabase, this.userId)
    const hookEngine = new HookEngine(this.supabase, this.userId)

    // Get top trends to inform topic selection
    const trends = await trendScanner.getTopOpportunities(10)
    const topicToUse = topic || (trends.length > 0
      ? trends[Math.floor(Math.random() * Math.min(trends.length, 5))].keyword
      : 'AI automation')

    // Get top hooks
    const hooks = await hookEngine.getTopHooks(20)
    if (hooks.length < 5) {
      const newHooks = await hookEngine.generateHooks(topicToUse, 10)
      hooks.push(...newHooks)
    }

    // Check topic scores for optimization
    const { data: topicScores } = await this.supabase
      .from('reels_topic_scores')
      .select('topic, performance_score')
      .eq('user_id', this.userId)
      .order('performance_score', { ascending: false })
      .limit(5)

    const bestTopic = topicScores?.[0]?.topic || topicToUse
    const scripts: Script[] = []

    for (let i = 0; i < count; i++) {
      const durationIndex = i % DURATION_OPTIONS.length
      const duration = DURATION_OPTIONS[durationIndex]
      const toneIndex = i % TONE_OPTIONS.length
      const tone = TONE_OPTIONS[toneIndex]
      const hook = hooks[i % hooks.length]

      const script = this.buildScript(
        i === 0 ? bestTopic : trends[i % trends.length]?.keyword || topicToUse,
        duration,
        tone,
        hook,
        i
      )

      scripts.push(script)

      // Store in database
      const { error } = await this.supabase.from('reels_scripts').insert([{
        user_id: this.userId,
        title: script.title,
        topic: script.topic,
        category: script.category,
        duration_seconds: script.durationSeconds,
        hook_text: script.hookText,
        hook_type: script.hookType,
        body_text: script.bodyText,
        cta_text: script.ctaText,
        caption: script.caption,
        hashtags: script.hashtags,
        tone: script.tone,
        hook_score: script.hookScore,
        predicted_performance: script.predictedPerformance,
        status: 'draft',
      }])

      if (error) console.error('Script insert error:', error.message)
    }

    await this.log('Scripts generated', `${scripts.length} scripts created for topic "${topicToUse}"`)

    return scripts
  }

  private buildScript(topic: string, duration: ReelDuration, tone: ReelTone, hook: any, index: number): Script {
    const template = SCRIPT_TEMPLATES[duration]
    const topicName = topic

    // Hook comes from our engine
    const hookText = hook.hookText || `The truth about ${topicName} nobody talks about`

    // Body depends on duration and tone
    const body = this.generateBody(topicName, duration, tone, index)

    // CTA varies
    const cta = this.generateCTA(tone, index)

    // Caption
    const caption = this.buildCaption(hookText, body, topicName)

    // Hashtags
    const hashtags = this.selectHashtags(topicName, tone)

    // Category from topic
    const category = this.inferCategory(topicName)

    return {
      title: `${topicName} — ${duration}s Reel ${index + 1}`,
      topic: topicName,
      category,
      durationSeconds: duration,
      hookText,
      hookType: hook.hookType || 'curiosity',
      bodyText: body,
      ctaText: cta,
      caption,
      hashtags,
      tone,
      hookScore: hook.score || 70,
      predictedPerformance: Math.round((hook.score || 70) * (duration === 30 ? 1.1 : 1.0)),
    }
  }

  private generateBody(topic: string, duration: ReelDuration, tone: ReelTone, index: number): string {
    const bodies: Record<string, string[]> = {
      'Why this matters': [
        `${topic} is transforming how agencies operate. Here's why: First, it eliminates repetitive work. Second, it scales without headcount. Third, it runs 24/7.`,
        `The landscape of ${topic} has shifted dramatically. Companies using automation are seeing 3-5x efficiency gains. Manual processes are becoming obsolete.`,
        `Here's what ${topic} actually looks like in practice: Automated workflows handle 80% of routine tasks. AI agents manage customer interactions. Your team focuses on strategy.`,
      ],
      'How to implement': [
        `Implementing ${topic} doesn't require a massive budget. Start with one workflow: identify your most repetitive task, map the automation, deploy the AI agent, measure the results.`,
        `Step 1: Audit your current processes. Step 2: Identify automation opportunities. Step 3: Deploy AI agents. Step 4: Monitor and optimize. Results come in weeks, not months.`,
        `The ${topic} implementation framework: Discover bottlenecks. Design solutions. Deploy automation. Scale what works. Most agencies see ROI within 30 days.`,
      ],
      'Results and proof': [
        `Real ${topic} results: 400% increase in output, 60% reduction in costs, 24/7 operations without overtime. This isn't future tech — it's happening now.`,
        `Agencies using ${topic} report: 3x client capacity, 50% higher margins, zero increase in headcount. The math is simple.`,
        `The data on ${topic} is clear: early adopters are growing 2.5x faster than competitors. The gap will only widen.`,
      ],
    }

    const categories = Object.keys(bodies)
    const category = categories[index % categories.length]
    const options = bodies[category]
    const body = options[index % options.length]

    // Adjust length based on duration
    if (duration === 15) return body.split('. ').slice(0, 2).join('. ') + '.'
    if (duration === 30) return body
    return body + '\n\n' + bodies[Object.keys(bodies)[(index + 1) % categories.length]][(index + 1) % 3]
  }

  private generateCTA(tone: ReelTone, index: number): string {
    const ctas: Record<string, string[]> = {
      professional: ['Follow for more industry insights.', 'Share this with your team.', 'Book a consultation to learn more.'],
      casual: ['Drop a comment if you agree!', 'Tag someone who needs to see this.', 'Save this for your strategy session.'],
      urgent: ['Don\'t get left behind. Start today.', 'Time is running out. Act now.', 'Your competitors already are.'],
      inspirational: ['The future is here. Be part of it.', 'Start building your AI agency today.', 'Transform your business now.'],
      humorous: ['Your future self will thank you.', 'Don\'t be the last to know about this.', 'Yes, it\'s really this good.'],
    }

    return ctas[tone]?.[index % 3] || ctas.professional[0]
  }

  private buildCaption(hook: string, body: string, topic: string): string {
    const template = CAPTION_TEMPLATES[Math.floor(Math.random() * CAPTION_TEMPLATES.length)]
    return template
      .replace(/{hook}/g, hook)
      .replace(/{body}/g, body)
      .replace(/{topic}/g, topic)
      .replace(/{topic_tag}/g, topic.replace(/\s+/g, ''))
  }

  private selectHashtags(topic: string, tone: ReelTone): string[] {
    const selected = new Set<string>()
    selected.add('#Reels')

    if (tone === 'professional') selected.add('#BusinessGrowth')
    if (tone === 'casual') selected.add('#TechTrends')
    if (tone === 'urgent') selected.add('#FutureOfWork')
    if (tone === 'inspirational') selected.add('#Innovation')
    if (tone === 'humorous') selected.add('#ContentCreation')

    // Add topic-relevant hashtags
    const lower = topic.toLowerCase()
    const tagMap: Record<string, string> = {
      ai: '#AI', automation: '#Automation', agency: '#AIAgency',
      marketing: '#AIMarketing', saas: '#SaaS', content: '#ContentCreation',
      business: '#BusinessGrowth', digital: '#DigitalAgency',
    }
    for (const [key, tag] of Object.entries(tagMap)) {
      if (lower.includes(key)) selected.add(tag)
    }

    // Fill remaining with random from pool
    const remaining = Math.min(5, 10 - selected.size)
    const pool = HASHTAG_POOL.filter(h => !selected.has(h))
    for (let i = 0; i < remaining && i < pool.length; i++) {
      selected.add(pool[Math.floor(Math.random() * pool.length)])
    }

    return Array.from(selected).slice(0, 10)
  }

  private inferCategory(topic: string): ReelCategory {
    const lower = topic.toLowerCase()
    if (lower.includes('ai') || lower.includes('machine learning') || lower.includes('intelligence')) return 'ai'
    if (lower.includes('automation') || lower.includes('workflow')) return 'automation'
    if (lower.includes('saas') || lower.includes('software')) return 'saas'
    if (lower.includes('marketing') || lower.includes('content') || lower.includes('social')) return 'marketing'
    if (lower.includes('agency') || lower.includes('business') || lower.includes('growth')) return 'agency'
    return 'general'
  }
}
