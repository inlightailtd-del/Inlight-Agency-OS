import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'
import { executeAgentTask } from '@/lib/ai/execution'

export interface ImprovementReport {
  failuresAnalyzed: number
  successesAnalyzed: number
  patternsFound: { type: string; description: string; action: string }[]
  recommendations: string[]
  storedLessons: number
}

export class SelfImprovementEngine {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async analyze(): Promise<ImprovementReport> {
    // Gather recent development history
    const [failures, successes, plans] = await Promise.all([
      this.supabase.from('development_memory')
        .select('name, description, content, created_at')
        .eq('user_id', this.userId)
        .eq('type', 'failure')
        .order('created_at', { ascending: false })
        .limit(10),

      this.supabase.from('development_memory')
        .select('name, description, content, created_at')
        .eq('user_id', this.userId)
        .in('type', ['success_pattern', 'fix'])
        .order('created_at', { ascending: false })
        .limit(10),

      this.supabase.from('development_memory')
        .select('name, description, content, created_at')
        .eq('user_id', this.userId)
        .eq('type', 'plan')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    // Also check execution logs for dev system activity
    const { data: logs } = await this.supabase
      .from('execution_logs')
      .select('action, status, message, created_at')
      .filter('action', 'ilike', '%DevSystem%')
      .order('created_at', { ascending: false })
      .limit(20)

    const prompt = `Analyze this development history and produce improvement recommendations:

RECENT FAILURES (${failures.data?.length || 0}):
${(failures.data || []).map(f => `  - ${f.name}: ${f.description}`).join('\n')}

RECENT SUCCESSES (${successes.data?.length || 0}):
${(successes.data || []).map(s => `  - ${s.name}: ${s.description}`).join('\n')}

RECENT PLANS (${plans.data?.length || 0}):
${(plans.data || []).map(p => `  - ${p.name}: ${p.description}`).join('\n')}

RECENT LOGS (${logs?.length || 0}):
${(logs || []).slice(0, 10).map(l => `  [${l.status}] ${l.action} — ${(l.message || '').substring(0, 100)}`).join('\n')}

Output improvement analysis as JSON:
{
  "patternsFound": [
    { "type": "recurring_failure|repeating_success|missed_opportunity|architecture_insight", "description": "pattern description", "action": "what to do about it" }
  ],
  "recommendations": ["recommendation1", "recommendation2"],
  "summary": "Brief overall assessment"
}`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: `You are a Continuous Improvement Engineer. You analyze development patterns and produce actionable recommendations. You focus on systematic improvements, not one-off fixes. Your goal is to make the development system itself better over time.`,
    })

    let analysis: { patternsFound: any[]; recommendations: string[]; summary: string } | null = null
    try {
      const match = result.response?.match(/\{[\s\S]*\}/)
      if (match) analysis = JSON.parse(match[0])
    } catch {}

    const patterns = analysis?.patternsFound || []
    const recommendations = analysis?.recommendations || []

    // Store lessons
    let storedLessons = 0
    for (const pattern of patterns) {
      await storeMemory(this.supabase, this.userId, {
        category: 'development_improvement',
        content: {
          type: 'improvement_pattern',
          patternType: pattern.type,
          description: pattern.description,
          action: pattern.action,
          analyzedAt: new Date().toISOString(),
        },
        tags: ['development', 'self-improvement', pattern.type],
      })
      storedLessons++
    }

    // Store improvement report
    await this.supabase.from('development_memory').insert([{
      user_id: this.userId,
      type: 'pattern',
      name: 'Self-Improvement Analysis',
      description: `${storedLessons} patterns found, ${recommendations.length} recommendations`,
      content: {
        cyclesAnalyzed: (failures.data?.length || 0) + (successes.data?.length || 0),
        patternsFound: patterns,
        recommendations,
        summary: analysis?.summary || '',
        analyzedAt: new Date().toISOString(),
      },
      tags: ['development', 'self-improvement', 'analysis'],
      status: 'active',
    }])

    return {
      failuresAnalyzed: failures.data?.length || 0,
      successesAnalyzed: successes.data?.length || 0,
      patternsFound: patterns,
      recommendations,
      storedLessons,
    }
  }
}
