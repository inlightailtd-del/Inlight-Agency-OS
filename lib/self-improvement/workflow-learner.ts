import { BaseSelfImprovementModule, type WorkflowPattern } from './types'

export class WorkflowLearner extends BaseSelfImprovementModule {
  async analyzeWorkflows(): Promise<WorkflowPattern[]> {
    await this.log('workflow_analysis_started', 'Analyzing workflow execution patterns')

    const { data: executions } = await this.supabase
      .from('agent_executions')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(200)

    const execs = (executions ?? []) as any[]
    if (execs.length === 0) return []

    const byType = this.groupByWorkflowType(execs)
    const patterns: WorkflowPattern[] = []

    for (const [workflowType, items] of Object.entries(byType)) {
      const total = items.length
      const completed = items.filter((i) => i.status === 'completed').length
      const successRate = Math.round((completed / total) * 100)
      const avgDuration = Math.round(items.reduce((s, i) => s + (i.duration_ms || 0), 0) / total)
      const avgTokens = Math.round(items.reduce((s, i) => s + (i.tokens_used || 0), 0) / total)

      if (avgDuration > 30000) {
        patterns.push(this.makePattern(workflowType, `High duration (${avgDuration}ms avg) — consider parallelization or timeout reduction`, total, avgDuration, successRate, 'medium'))
      }
      if (successRate < 70) {
        patterns.push(this.makePattern(workflowType, `Low success rate (${successRate}%) — review error patterns and add fallbacks`, total, avgDuration, successRate, 'high'))
      }
      if (avgTokens > 4000) {
        patterns.push(this.makePattern(workflowType, `High token usage (${avgTokens} avg) — optimize prompts for brevity`, total, avgDuration, successRate, 'medium'))
      }
      if (total > 10 && successRate > 90) {
        patterns.push(this.makePattern(workflowType, `Consistently high performance (${successRate}%, ${total} runs) — candidate for delegation automation`, total, avgDuration, successRate, 'low'))
      }
    }

    for (const p of patterns) {
      await this.storeBrain('workflow_pattern', p, ['workflow_pattern', p.workflowType, p.impact])
    }

    await this.log('workflow_analysis_completed', `${patterns.length} patterns found across ${Object.keys(byType).length} workflow types`)
    return patterns
  }

  async getOptimizationIdeas(): Promise<{ workflowType: string; idea: string; impact: string }[]> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'self_improvement_workflow_pattern')
      .not('content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    const patterns = ((data ?? []) as any[]).map((r) => r.content as WorkflowPattern).filter(Boolean)
    return patterns
      .filter((p) => !p.applied)
      .map((p) => ({
        workflowType: p.workflowType,
        idea: p.optimization ?? p.pattern,
        impact: p.impact,
      }))
  }

  async markApplied(patternId: string): Promise<void> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('id, content')
      .eq('user_id', this.userId)
      .eq('id', patternId)
      .limit(1) as any

    if (data?.length) {
      const content = data[0].content as WorkflowPattern
      content.applied = true
      await this.supabase.from('agent_memory').update({ content }).eq('id', data[0].id)
    }
  }

  private groupByWorkflowType(execs: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {}
    for (const exec of execs) {
      const type = exec.metadata?.workflowType || exec.metadata?.stepType || 'general'
      if (!groups[type]) groups[type] = []
      groups[type].push(exec)
    }
    return groups
  }

  private makePattern(
    workflowType: string, pattern: string, frequency: number,
    avgDurationMs: number, successRate: number, impact: 'high' | 'medium' | 'low'
  ): WorkflowPattern {
    return {
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
      workflowType,
      pattern,
      frequency,
      avgDurationMs,
      successRate,
      optimization: this.suggestOptimization(pattern, impact),
      impact,
      applied: false,
      detectedAt: new Date().toISOString(),
    }
  }

  private suggestOptimization(pattern: string, impact: string): string {
    if (pattern.includes('High duration')) return 'Reduce timeout, implement streaming, or split into parallel subtasks'
    if (pattern.includes('Low success rate')) return 'Add retry logic, improve error handling, validate inputs before execution'
    if (pattern.includes('High token usage')) return 'Shorten system prompts, reduce context window, use cheaper model for subtasks'
    if (pattern.includes('high performance')) return 'Create optimized fast-path, bypass approval for known-good patterns'
    return 'Review and optimize based on pattern analysis'
  }
}
