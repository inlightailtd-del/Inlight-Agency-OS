import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { type ArchitectPlan, type PlannerTask, AGENT_SYSTEM_PROMPTS } from './types'

export class PlannerAgent {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async createTasks(plan: ArchitectPlan): Promise<PlannerTask[]> {
    const prompt = `Break this implementation plan into specific executable tasks:

PLAN TITLE: ${plan.title}
OVERVIEW: ${plan.overview}

COMPONENTS:
${plan.components.map(c => `  - ${c.name} (priority ${c.priority}, dependencies: ${c.dependencies.join(', ') || 'none'}): ${c.description}`).join('\n')}

PHASES:
${plan.phases.map(p => `  Phase ${p.phase}: ${p.name} - ${p.description}`).join('\n')}

RISKS: ${plan.risks.join(', ') || 'None identified'}

Output a JSON array of tasks with this exact structure:
[
  {
    "title": "Short task title",
    "description": "What to do and how to do it",
    "agentType": "backend|frontend|database|integrations|automation",
    "priority": 1-5,
    "dependencies": ["other task title or empty"],
    "estimatedMinutes": 15-120
  }
]

RULES:
- Database migrations always come first
- Backend APIs before frontend pages
- Keep tasks focused (15-60 min each)
- Prefer smaller tasks over larger ones
- Use consistent agent types`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: AGENT_SYSTEM_PROMPTS.planner,
    })

    const tasks = this.extractTasks(result.response || '')
    
    // Store in development memory
    await this.supabase.from('development_memory').insert([{
      user_id: this.userId,
      type: 'plan',
      name: `Tasks: ${plan.title}`,
      description: `${tasks.length} tasks generated`,
      content: { tasks, planTitle: plan.title, createdAt: new Date().toISOString() },
      tags: ['development', 'tasks', 'plan'],
      status: 'active',
    }])

    return tasks
  }

  private extractTasks(response: string): PlannerTask[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed.map((t: any, i: number) => ({
          id: `task-${i + 1}`,
          planTitle: 'Generated Plan',
          title: t.title || t.name || `Task ${i + 1}`,
          description: t.description || '',
          agentType: t.agentType || 'backend',
          priority: t.priority || 3,
          dependencies: t.dependencies || [],
          estimatedMinutes: t.estimatedMinutes || 30,
          status: 'pending' as const,
        }))
      }
    } catch {}
    
    return []
  }
}
