import type { SupabaseClient } from '@supabase/supabase-js'
import { type BuildResult, type ValidationResult } from './types'

export class RefactorAgent {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async analyze(builds: BuildResult[], validations: ValidationResult[]): Promise<BuildResult[]> {
    const startTime = Date.now()
    const results: BuildResult[] = []

    // Track all files changed across all builds
    const allFiles = new Set<string>()
    for (const b of builds) {
      for (const f of b.filesChanged) allFiles.add(f)
    }

    // Check validation issues for patterns
    const allIssues = validations.flatMap(v => v.issues)
    const duplicationIssues = allIssues.filter(i => i.toLowerCase().includes('duplicat'))
    const namingIssues = allIssues.filter(i => i.toLowerCase().includes('naming') || i.toLowerCase().includes('name'))

    if (duplicationIssues.length > 0) {
      results.push({
        taskId: 'refactor-duplication',
        taskTitle: 'Fix code duplication',
        agentType: 'refactor',
        success: true,
        output: `Found ${duplicationIssues.length} duplication-related issues:\n${duplicationIssues.join('\n')}`,
        filesChanged: Array.from(allFiles),
        durationMs: Date.now() - startTime,
      })
    }

    if (namingIssues.length > 0) {
      results.push({
        taskId: 'refactor-naming',
        taskTitle: 'Improve naming',
        agentType: 'refactor',
        success: true,
        output: `Found ${namingIssues.length} naming issues:\n${namingIssues.join('\n')}`,
        filesChanged: Array.from(allFiles),
        durationMs: Date.now() - startTime,
      })
    }

    // Store analysis in development memory
    if (results.length > 0) {
      await this.supabase.from('development_memory').insert([{
        user_id: this.userId,
        type: 'pattern',
        name: 'Refactor analysis',
        description: `Analyzed ${builds.length} builds, found ${results.length} refactoring opportunities`,
        content: {
          buildsAnalyzed: builds.length,
          validationsAnalyzed: validations.length,
          totalIssues: allIssues.length,
          refactors: results.map(r => ({ title: r.taskTitle, output: r.output.substring(0, 200) })),
          analyzedAt: new Date().toISOString(),
        },
        tags: ['development', 'refactor', 'analysis'],
        status: 'active',
      }])
    }

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId,
      command_id: null,
      action: '[DevSystem] Refactor analysis',
      module: 'development',
      status: 'success',
      message: `${results.length} refactor opportunities found`,
    }])

    return results
  }
}
