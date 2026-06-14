import { BaseReelsModule, type Hook, type HookType } from './types'

const HOOK_TEMPLATES: Record<HookType, string[]> = {
  curiosity: [
    'Nobody tells you this about {topic}',
    'The {topic} secret they don\'t want you to know',
    'I tried {topic} for 30 days. Here\'s what happened',
    'Why {topic} is broken (and how to fix it)',
    '{number} reasons why {topic} is failing',
    'What if I told you {topic} is actually simple?',
    'The {topic} strategy that took us from $0 to ${revenue}',
    'Everything you know about {topic} is wrong',
  ],
  authority: [
    'As an {industry} expert, here\'s the truth about {topic}',
    'I\'ve spent {years} years in {topic}. Here\'s what matters',
    'The {topic} framework used by top {industry} agencies',
    'After analyzing {number} {industry} campaigns, here\'s the pattern',
    'My {topic} playbook (took {years} years to perfect)',
    'What top 1% of {industry} professionals know about {topic}',
    'The data-driven approach to {topic} (with proof)',
  ],
  problem: [
    'Stop wasting time on {topic}',
    'Is {topic} costing you {amount}?',
    'The {topic} mistake {percentage}% of agencies make',
    'If you\'re still doing {old_way}, you\'re losing money',
    'Why your {topic} strategy isn\'t working',
    'The hardest part about {topic} (and how to solve it)',
    'This {topic} problem is killing your growth',
  ],
  story: [
    'We tried {topic}. It failed. Here\'s what we learned',
    'From zero to {result} using {topic} in {timeframe}',
    'The {topic} experiment that changed everything',
    'I almost gave up on {topic}. Then this happened',
    'How we used {topic} to {achieve} in {timeframe}',
    'The day {topic} saved our agency',
    'A {topic} story that will change how you work',
  ],
  shock: [
    '{percentage}% of {industry} will be replaced by {topic} by 2027',
    'This {topic} statistic will shock you',
    '{topic} is growing {multiplier}x faster than expected',
    'The {topic} bubble is about to burst',
    '{number}M jobs affected by {topic} — here\'s what to do',
    'You\'re not ready for what {topic} can do now',
    'The biggest {topic} revelation of 2026',
  ],
}

const TOPICS = [
  'AI automation', 'AI agents', 'content creation', 'digital marketing',
  'lead generation', 'SaaS growth', 'agency scaling', 'AI tools',
  'workflow automation', 'business growth', 'AI marketing', 'video content',
  'social media growth', 'email outreach', 'sales automation',
]

const TOPIC_CONTEXT: Record<string, { number: number; revenue: string; years: number; industry: string; percentage: number; amount: string; oldWay: string; multiplier: number; result: string; timeframe: string; achieve: string }> = {
  'AI automation': { number: 7, revenue: '$100K', years: 10, industry: 'agency', percentage: 73, amount: '$50K/year', oldWay: 'manual processes', multiplier: 4, result: '10x productivity', timeframe: '6 months', achieve: 'automate 90% of workflows' },
  'AI agents': { number: 5, revenue: '$1M', years: 5, industry: 'tech', percentage: 68, amount: '$100K/year', oldWay: 'hiring more staff', multiplier: 5, result: '24/7 operations', timeframe: '3 months', achieve: 'deploy AI agents at scale' },
  'content creation': { number: 10, revenue: '$50K', years: 8, industry: 'marketing', percentage: 80, amount: '$30K/year', oldWay: 'manual content writing', multiplier: 3, result: '5x content output', timeframe: '30 days', achieve: 'generate content automatically' },
  'digital marketing': { number: 8, revenue: '$500K', years: 12, industry: 'marketing', percentage: 65, amount: '$200K/year', oldWay: 'traditional advertising', multiplier: 3.5, result: '3x ROI', timeframe: '90 days', achieve: 'double our conversion rate' },
  'lead generation': { number: 6, revenue: '$250K', years: 7, industry: 'sales', percentage: 70, amount: '$75K/year', oldWay: 'cold calling', multiplier: 4, result: '500+ leads/month', timeframe: '60 days', achieve: 'generate leads on autopilot' },
  'SaaS growth': { number: 9, revenue: '$1M', years: 15, industry: 'SaaS', percentage: 60, amount: '$500K/year', oldWay: 'manual onboarding', multiplier: 3, result: '200% growth', timeframe: '12 months', achieve: 'scale to $10M ARR' },
  'agency scaling': { number: 5, revenue: '$2M', years: 10, industry: 'agency', percentage: 75, amount: '$300K/year', oldWay: 'hiring more people', multiplier: 4, result: '3x revenue', timeframe: '6 months', achieve: 'scale without hiring' },
  'AI tools': { number: 12, revenue: '$150K', years: 3, industry: 'tech', percentage: 55, amount: '$40K/year', oldWay: 'expensive software', multiplier: 6, result: '10x efficiency', timeframe: '14 days', achieve: 'implement AI tools' },
  'workflow automation': { number: 8, revenue: '$100K', years: 8, industry: 'operations', percentage: 72, amount: '$80K/year', oldWay: 'manual workflows', multiplier: 5, result: '40h saved/week', timeframe: '30 days', achieve: 'automate all workflows' },
  'business growth': { number: 7, revenue: '$1M', years: 10, industry: 'business', percentage: 62, amount: '$250K/year', oldWay: 'traditional growth', multiplier: 3.5, result: 'double revenue', timeframe: '12 months', achieve: 'achieve 10x growth' },
  'AI marketing': { number: 6, revenue: '$300K', years: 4, industry: 'marketing', percentage: 78, amount: '$60K/year', oldWay: 'manual marketing', multiplier: 5, result: '4x engagement', timeframe: '45 days', achieve: 'run AI-powered campaigns' },
  'video content': { number: 5, revenue: '$80K', years: 6, industry: 'media', percentage: 85, amount: '$20K/year', oldWay: 'hiring videographers', multiplier: 4, result: '1M views/month', timeframe: '60 days', achieve: 'produce viral videos' },
  'social media growth': { number: 8, revenue: '$150K', years: 7, industry: 'social media', percentage: 69, amount: '$45K/year', oldWay: 'manual posting', multiplier: 3, result: '100K followers', timeframe: '90 days', achieve: 'grow social presence' },
  'email outreach': { number: 4, revenue: '$200K', years: 5, industry: 'sales', percentage: 64, amount: '$50K/year', oldWay: 'mass emails', multiplier: 4.5, result: '40% reply rate', timeframe: '30 days', achieve: 'automate outreach' },
  'sales automation': { number: 6, revenue: '$500K', years: 8, industry: 'sales', percentage: 71, amount: '$150K/year', oldWay: 'manual sales process', multiplier: 3, result: '3x conversion', timeframe: '60 days', achieve: 'automate our sales pipeline' },
}

export class HookEngine extends BaseReelsModule {
  async generateHooks(topic?: string, count = 10): Promise<Hook[]> {
    const hooks: Hook[] = []
    const selectedTopic = topic || TOPICS[Math.floor(Math.random() * TOPICS.length)]
    const context = TOPIC_CONTEXT[selectedTopic] || TOPIC_CONTEXT['AI automation']

    for (const [type, templates] of Object.entries(HOOK_TEMPLATES)) {
      const template = templates[Math.floor(Math.random() * templates.length)]

      const hookText = template
        .replace(/{topic}/g, selectedTopic)
        .replace(/{number}/g, String(context.number))
        .replace(/{revenue}/g, context.revenue)
        .replace(/{years}/g, String(context.years))
        .replace(/{industry}/g, context.industry)
        .replace(/{percentage}/g, String(context.percentage))
        .replace(/{amount}/g, context.amount)
        .replace(/{old_way}/g, context.oldWay)
        .replace(/{multiplier}/g, String(context.multiplier))
        .replace(/{result}/g, context.result)
        .replace(/{timeframe}/g, context.timeframe)
        .replace(/{achieve}/g, context.achieve)

      const score = this.calculateScore(type as HookType, hookText)
      hooks.push({
        hookText,
        hookType: type as HookType,
        score,
        source: 'ai',
        category: selectedTopic,
        topics: [selectedTopic, context.industry, 'agency'],
      })
    }

    // Sort by score descending
    hooks.sort((a, b) => b.score - a.score)

    // Store top hooks
    const topHooks = hooks.slice(0, count)
    for (const hook of topHooks) {
      const { error } = await this.supabase.from('reels_hooks').upsert({
        user_id: this.userId,
        hook_text: hook.hookText,
        hook_type: hook.hookType,
        score: hook.score,
        source: 'ai',
        category: hook.category,
        topics: hook.topics || [],
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      if (error && !error.message?.includes('duplicate')) {
        console.error('Hook store error:', error.message)
      }
    }

    await this.log('Hooks generated', `${topHooks.length} hooks created for "${selectedTopic}", top score: ${topHooks[0]?.score}`)

    return topHooks
  }

  private calculateScore(type: HookType, text: string): number {
    let base = 50

    // Type bonuses
    const typeBonuses: Record<HookType, number> = {
      curiosity: 20,
      authority: 15,
      problem: 18,
      story: 12,
      shock: 22,
    }
    base += typeBonuses[type]

    // Length optimization (7-15 words is sweet spot for reels)
    const wordCount = text.split(' ').length
    if (wordCount >= 7 && wordCount <= 15) base += 10
    else if (wordCount < 7) base -= 5
    else base -= 10

    // Number hook bonus
    if (/\d+/.test(text)) base += 5

    // Question hook bonus
    if (text.includes('?')) base += 5

    // Emotional trigger bonus
    const emotionalWords = ['secret', 'shock', 'mistake', 'stop', 'wasting', 'broken', 'failing', 'dying', 'nobody', 'truth']
    if (emotionalWords.some(w => text.toLowerCase().includes(w))) base += 8

    // Personal pronoun bonus
    if (/I|we|my|our/i.test(text)) base += 5

    // Check existing performance data for similar hooks
    base += this.getHookTypePerformanceBonus(type)

    return Math.min(99, Math.max(1, Math.round(base)))
  }

  private getHookTypePerformanceBonus(type: HookType): number {
    // This would use actual performance data from reels_analytics
    // For now, returns a small variance
    return Math.round(Math.random() * 10) - 5
  }

  async getTopHooks(limit = 20): Promise<Hook[]> {
    const { data } = await this.supabase
      .from('reels_hooks')
      .select('*')
      .eq('user_id', this.userId)
      .order('score', { ascending: false })
      .limit(limit)

    return (data || []).map(d => ({
      hookText: d.hook_text,
      hookType: d.hook_type as HookType,
      score: d.score,
      source: d.source,
      category: d.category,
      topics: d.topics || [],
    }))
  }
}
