import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'
import { type BuildResult, type ValidationResult } from './types'

export class LearnerEngine {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async extractLessons(
    builds: BuildResult[],
    validations: ValidationResult[],
    goal: string
  ): Promise<number> {
    let lessonsStored = 0

    // Successful patterns
    for (const build of builds.filter(b => b.success).slice(0, 3)) {
      await this.store('success_pattern', {
        title: `Pattern: ${build.taskTitle}`,
        description: `Successfully built using ${build.agentType} agent in ${(build.durationMs / 1000).toFixed(1)}s`,
        agentType: build.agentType,
        files: build.filesChanged,
      }, ['development', 'success', build.agentType, 'pattern'])
      lessonsStored++
    }

    // Failures
    for (const build of builds.filter(b => !b.success).slice(0, 3)) {
      await this.store('failure', {
        title: `Failure: ${build.taskTitle}`,
        description: build.error || 'Unknown error',
        agentType: build.agentType,
      }, ['development', 'failure', build.agentType])
      lessonsStored++
    }

    // Validation fixes
    for (const v of validations.filter(v => !v.success).slice(0, 3)) {
      await this.store('fix', {
        title: `${v.check} fix for task ${v.taskId}`,
        description: v.issues.join('; ') || v.output.substring(0, 200),
        checkType: v.check,
      }, ['development', 'fix', v.check])
      lessonsStored++
    }

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId,
      command_id: null,
      action: '[DevSystem] Lessons extracted',
      module: 'development',
      status: 'success',
      message: `${lessonsStored} lessons from ${builds.length} builds and ${validations.length} validations`,
    }])

    return lessonsStored
  }

  private async store(type: string, content: Record<string, any>, tags: string[]) {
    await storeMemory(this.supabase, this.userId, {
      category: `development_${type}`,
      content: { ...content, storedAt: new Date().toISOString() },
      tags,
    })

    await this.supabase.from('development_memory').insert([{
      user_id: this.userId,
      type,
      name: content.title || 'Lesson',
      description: content.description || '',
      content,
      tags,
      status: 'active',
    }])
  }
}
