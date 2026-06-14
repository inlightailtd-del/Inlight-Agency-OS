import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'

export interface ContentIdea {
  title: string
  topic: string
  category: string
  contentType: 'post' | 'carousel' | 'reel'
  platform: string
  hook: string
  body: string
  caption: string
  hashtags: string[]
  source: string
  sourceRef: string
  score: number
}

export interface WeeklyPlan {
  weekStart: string
  days: { dayOfWeek: number; platform: string; contentType: string; title: string }[]
}

export interface ContentFactoryResult {
  ideasGenerated: number
  postsCreated: number
  carouselsCreated: number
  reelsCreated: number
  calendarPublished: number
  analyticsCollected: number
  weeklyPlanCreated: boolean
  errors: string[]
  summary: string
}

export abstract class BaseContentFactoryModule {
  protected supabase: SupabaseClient
  protected userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  protected async log(action: string, message: string, status = 'success') {
    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: `[ContentFactory] ${action}`, module: 'content', status, message,
    }])
  }

  protected async storeBrain(category: string, content: Record<string, any>, tags: string[]) {
    await this.supabase.from('agent_memory').insert([{
      user_id: this.userId, agent_id: null,
      category: `cf_${category}`, content, tags: ['content-factory', ...tags],
    }])
  }
}
