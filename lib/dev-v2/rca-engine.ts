import type { RCA } from './types'

export class RootCauseAnalysisEngine {
  private supabase: any
  private userId: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async analyze(
    symptom: string,
    stacktrace: string,
    context: { buildOutput?: string; testOutput?: string; filesChanged?: string[]; phase?: string }
  ): Promise<RCA> {
    const category = this.classify(symptom, stacktrace, context)
    const rootCause = this.extractRootCause(symptom, stacktrace, context)
    const severity = this.assessSeverity(symptom, stacktrace)
    const impact = this.assessImpact(category, context)
    const fix = this.suggestFix(rootCause, category, context)
    const prevention = this.suggestPrevention(rootCause, category)

    const rca: RCA = {
      cycleId: context.phase || 'auto',
      symptom,
      rootCause,
      impact,
      severity,
      category,
      stacktrace: stacktrace?.substring(0, 2000),
      fix,
      fixStatus: 'pending',
      prevention,
    }

    // Store
    await this.supabase.from('dev_rca').insert([{
      user_id: this.userId,
      cycle_id: context.phase || null,
      symptom,
      root_cause: rootCause,
      impact,
      severity,
      category,
      stacktrace: stacktrace?.substring(0, 2000) || null,
      fix,
      fix_status: 'pending',
      prevention,
    }])

    return rca
  }

  async getHistory(limit = 20): Promise<RCA[]> {
    const { data } = await this.supabase
      .from('dev_rca')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return ((data as any[]) || []).map(d => ({
      id: d.id,
      cycleId: d.cycle_id,
      symptom: d.symptom,
      rootCause: d.root_cause,
      impact: d.impact,
      severity: d.severity,
      category: d.category,
      stacktrace: d.stacktrace,
      fix: d.fix,
      fixStatus: d.fix_status,
      prevention: d.prevention,
    }))
  }

  async getPatterns(): Promise<{ pattern: string; count: number; category: string }[]> {
    const { data } = await this.supabase
      .from('dev_rca')
      .select('category, root_cause')
      .eq('user_id', this.userId)
    const recs = (data as any[]) || []
    const patternCount: Record<string, { count: number; category: string }> = {}
    for (const r of recs) {
      const key = r.root_cause?.substring(0, 80) || 'unknown'
      if (!patternCount[key]) patternCount[key] = { count: 0, category: r.category || 'unknown' }
      patternCount[key].count++
    }
    return Object.entries(patternCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([pattern, info]) => ({ pattern, count: info.count, category: info.category }))
  }

  private classify(symptom: string, stacktrace: string, context: any): RCA['category'] {
    const text = `${symptom} ${stacktrace}`.toLowerCase()
    if (text.includes('type error') || text.includes('typescript') || text.includes('type ') && text.includes('not assignable')) return 'build'
    if (text.includes('test') || text.includes('assert') || text.includes('expect')) return 'test'
    if (text.includes('cannot find module') || text.includes('module not found') || text.includes('import')) return 'build'
    if (text.includes('runtime') || text.includes('undefined is not') || text.includes('cannot read properties')) return 'runtime'
    if (text.includes('lint') || text.includes('eslint')) return 'build'
    if (text.includes('timeout') || text.includes('connection') || text.includes('network')) return 'config'
    return 'logic'
  }

  private extractRootCause(symptom: string, stacktrace: string, context: any): string {
    const text = `${stacktrace} ${context.buildOutput || ''} ${context.testOutput || ''} ${symptom}`
    const lines = text.split('\n').filter(l => l.trim())

    // Try to find the actual error message
    const errorPatterns = [/Error:\s*(.+)/i, /error\s*TS\d+:\s*(.+)/i, /error\s*:\s*(.+)/i, /FAIL\s+(.+)/i, /SyntaxError:\s*(.+)/i]
    for (const pattern of errorPatterns) {
      const match = text.match(pattern)
      if (match) return match[1].trim().substring(0, 200)
    }

    // Use the first meaningful line of stacktrace
    if (lines.length > 0) return lines[0].substring(0, 200)

    return symptom.substring(0, 200)
  }

  private assessSeverity(symptom: string, stacktrace: string): RCA['severity'] {
    const text = `${symptom} ${stacktrace}`.toLowerCase()
    if (text.includes('security') || text.includes('crash') || text.includes('data loss') || text.includes('critical')) return 'critical'
    if (text.includes('cannot') || text.includes('error') || text.includes('fail') || text.includes('broken')) return 'high'
    if (text.includes('warning') || text.includes('deprecat') || text.includes('minor')) return 'low'
    return 'medium'
  }

  private assessImpact(category: string, context: any): string {
    const impacts: Record<string, string> = {
      build: 'Build/compilation failure — code cannot compile',
      test: 'Test failure — logic or behavior verification failed',
      runtime: 'Runtime error — application crashes during execution',
      logic: 'Logic error — incorrect behavior or output',
      config: 'Configuration error — environment or setup issue',
    }
    return impacts[category] || 'Unknown impact'
  }

  private suggestFix(rootCause: string, category: string, context: any): string {
    const fixes: Record<string, string> = {
      build: 'Fix type errors in affected files. Check imports, types, and function signatures.',
      test: 'Update test assertions to match actual behavior, or fix the implementation to match expected behavior.',
      runtime: 'Add null/undefined checks. Validate inputs before use. Wrap in try-catch.',
      logic: 'Review business logic. Add logging to trace execution path. Verify conditionals.',
      config: 'Check environment variables, file paths, and dependency versions.',
    }
    return fixes[category] || 'Investigate and fix the reported error'
  }

  private suggestPrevention(rootCause: string, category: string): string {
    const preventions: Record<string, string> = {
      build: 'Run `npm run build` before committing. Add type checks to CI pipeline.',
      test: 'Write tests alongside implementation. Use TDD for critical paths.',
      runtime: 'Add input validation, error boundaries, and defensive programming patterns.',
      logic: 'Write unit tests for complex logic. Add logging at decision points.',
      config: 'Document environment requirements. Add validation for configuration at startup.',
    }
    return preventions[category] || 'Add automated checks to catch this issue earlier'
  }
}
