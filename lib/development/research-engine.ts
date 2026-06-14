import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'

export interface ResearchResult {
  topic: string
  recommendations: {
    technology: string
    description: string
    confidence: number
    reasoning: string
    alternatives: string[]
  }[]
  sources: string[]
}

export class ResearchEngine {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async research(topic: string, context?: string): Promise<ResearchResult> {
    const prompt = `Conduct thorough technology research on:

TOPIC: ${topic}
${context ? `CONTEXT: ${context}` : ''}

Provide technology recommendations for Inlight Agency OS (Next.js 14, Supabase, TypeScript). 

For each recommendation include:
- Technology/library name
- What it does
- Confidence score (0-100)
- Reasoning why it fits this codebase
- 2-3 alternatives considered

Also list sources of information.

Output as JSON:
{
  "topic": "${topic}",
  "recommendations": [
    { "technology": "name", "description": "what it does", "confidence": 85, "reasoning": "why", "alternatives": ["alt1", "alt2"] }
  ],
  "sources": ["source1", "source2"]
}

Focus on:
- TypeScript-first libraries
- Works with Next.js 14 App Router
- Works with Supabase
- Open source preferred
- Active maintenance (2025-2026)`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: `You are a senior technology research engineer. You evaluate technologies for fit, maturity, and maintainability within existing Next.js/Supabase ecosystems. You provide honest assessments including when to avoid a technology.`,
    })

    const research = this.extractJson(result.response || '')
    
    // Store in development memory
    await this.supabase.from('development_memory').insert([{
      user_id: this.userId,
      type: 'pattern',
      name: `Research: ${topic}`,
      description: (research?.recommendations?.length || 0) + ' recommendations generated',
      content: { research, topic, researchedAt: new Date().toISOString() },
      tags: ['development', 'research', topic.toLowerCase().replace(/\s+/g, '-')],
      status: 'active',
    }])

    return research || { topic, recommendations: [], sources: [] }
  }

  private extractJson(text: string): ResearchResult | null {
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch {}
    return null
  }
}
