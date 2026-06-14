import { BaseBusinessModule } from './types'
import { storeMemory } from '@/lib/ai/memory'
import { executeAgentTask } from '@/lib/ai/execution'

export class BusinessLearningEngine extends BaseBusinessModule {
  async extractLessons(cycleData: Record<string, any>, industry: string): Promise<{ lessonsStored: number; recommendations: string[] }> {
    const prompt = `Analyze this business development cycle and extract actionable lessons:

INDUSTRY: ${industry}
CYCLE DATA: ${JSON.stringify(cycleData).substring(0, 2000)}

Output JSON:
{
  "lessons": [
    { "lesson": "specific lesson", "actionable": "what to do", "category": "market|offer|website|content|revenue" }
  ],
  "recommendations": ["specific recommendation"]
}
Focus on what worked, what didn't, and what should be done next. Be specific.`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: `You are a Business Growth Analyst. You extract actionable lessons from business data. Every lesson must lead to a specific action.`,
    })

    let lessons: any[] = []
    let recommendations: string[] = []
    try { const m = result.response?.match(/\{[\s\S]*\}/); if (m) { const p = JSON.parse(m[0]); lessons = p.lessons || []; recommendations = p.recommendations || [] } } catch {}

    let lessonsStored = 0
    for (const lesson of lessons) {
      await storeMemory(this.supabase, this.userId, {
        category: 'business_lesson',
        content: { type: 'business_lesson', lesson: lesson.lesson, actionable: lesson.actionable, category: lesson.category, industry, createdAt: new Date().toISOString() },
        tags: ['business', 'lesson', lesson.category || 'general', industry.toLowerCase().replace(/\s+/g, '-')],
      })
      lessonsStored++
    }

    await this.storeBrain('cycle_summary', { cycleData, lessons, recommendations, analyzedAt: new Date().toISOString() }, ['learning', industry.toLowerCase().replace(/\s+/g, '-')])
    await this.log('Business lessons extracted', `${lessonsStored} lessons, ${recommendations.length} recommendations`)
    return { lessonsStored, recommendations }
  }
}
