import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { type ArchitectPlan, AGENT_SYSTEM_PROMPTS } from './types'

export class ArchitectAgent {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async createPlan(goal: string, context?: string): Promise<ArchitectPlan> {
    const prompt = `Create a detailed implementation plan for this goal:

GOAL: ${goal}

${context ? `CONTEXT:\n${context}\n` : ''}

First, analyze what already exists in Inlight Agency OS that can be reused:
- The queue system (lib/queue/) handles job processing
- The integration SDK (lib/integrations/) handles provider connections
- The AI execution system (lib/ai/execution) runs agent tasks
- The memory system (lib/ai/memory) stores persistent data
- The execution_logs table tracks all operations
- Each department has an engine (lib/outreach/engine.ts, lib/video/engine.ts, etc.)
- Each department has a dashboard (app/dashboard/outreach/, etc.)
- Each department has an API endpoint pattern (app/api/outreach/run/)

Output a JSON plan with this exact structure:
{
  "title": "Plan title",
  "overview": "High-level approach",
  "components": [
    { "name": "component-name", "description": "what it does", "priority": 1-5, "dependencies": ["other-component"] }
  ],
  "phases": [
    { "phase": 1, "name": "Foundation", "description": "what this phase achieves", "components": ["component-name"] }
  ],
  "estimatedComplexity": "low|medium|high",
  "risks": ["risk description"]
}

IMPORTANT: Use the existing Inlight Agency OS architecture patterns. Do not create new frameworks. Extend what exists.`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: AGENT_SYSTEM_PROMPTS.architect,
    })

    const plan = this.extractPlan(result.response || '')
    
    await this.supabase.from('development_memory').insert([{
      user_id: this.userId,
      type: 'plan',
      name: plan.title,
      description: goal,
      content: { plan, goal, createdAt: new Date().toISOString() },
      tags: ['development', 'architecture', 'plan', ...plan.components.map(c => c.name)],
      status: 'active',
    }])

    return plan
  }

  private extractPlan(response: string): ArchitectPlan {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) return JSON.parse(jsonMatch[0])
    } catch {}
    
    return {
      goal: 'Parse failed',
      title: 'Plan',
      overview: response.substring(0, 500),
      components: [],
      phases: [{ phase: 1, name: 'Implementation', description: 'See AI output', components: [] }],
      estimatedComplexity: 'medium',
      risks: [],
    }
  }
}
