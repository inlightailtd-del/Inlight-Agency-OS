import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { type PlannerTask, type ValidationResult } from './types'

export class ValidatorAgent {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async validate(task: PlannerTask, buildOutput: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []

    const buildResult = await this.runBuildCheck(task, buildOutput)
    results.push(buildResult)

    const lintResult = await this.runLintCheck(task, buildOutput)
    results.push(lintResult)

    const securityResult = await this.runSecurityCheck(task, buildOutput)
    results.push(securityResult)

    return results
  }

  private async runBuildCheck(task: PlannerTask, output: string): Promise<ValidationResult> {
    const startTime = Date.now()
    const issues: string[] = []

    if (output.includes("from 'react'") && !output.includes("'use client'")) {
      issues.push('Missing "use client" directive in component using React hooks')
    }
    if (output.includes(' any ')) issues.push('Avoid using "any" type')
    if (output.includes('@ts-ignore') || output.includes('@ts-nocheck')) issues.push('TypeScript ignore directives should not be used')
    if (output.includes('./') && output.includes('../../')) issues.push('Deep relative imports — use @/ alias instead')

    return {
      taskId: task.id,
      check: 'build',
      success: issues.length === 0,
      output: issues.length > 0 ? issues.join('\n') : 'No build issues found',
      durationMs: Date.now() - startTime,
      issues,
    }
  }

  private async runLintCheck(task: PlannerTask, output: string): Promise<ValidationResult> {
    const startTime = Date.now()
    const issues: string[] = []

    if (output.includes('console.log')) issues.push('Remove console.log statements before production')
    if (output.length > 2000 && task.estimatedMinutes < 10) issues.push('Output is large for estimated time — may indicate over-engineering')
    if (output.includes('function') && output.includes('function') && (output.match(/function/g) || []).length > 5) {
      issues.push('Consider extracting helper functions to separate files')
    }

    return {
      taskId: task.id,
      check: 'lint',
      success: issues.length === 0,
      output: issues.length > 0 ? issues.join('\n') : 'Lint check passed',
      durationMs: Date.now() - startTime,
      issues,
    }
  }

  private async runSecurityCheck(task: PlannerTask, output: string): Promise<ValidationResult> {
    const startTime = Date.now()
    const issues: string[] = []

    if (output.includes('process.env')) issues.push('Verify env vars are server-only (not NEXT_PUBLIC_)')
    if (output.includes('dangerouslySetInnerHTML')) issues.push('XSS risk: dangerouslySetInnerHTML')
    if (output.includes('innerHTML')) issues.push('XSS risk: innerHTML')
    if (output.includes('eval(')) issues.push('Security risk: eval()')

    return {
      taskId: task.id,
      check: 'security',
      success: issues.length === 0,
      output: issues.length > 0 ? `Found ${issues.length} issues: ${issues.join(', ')}` : 'Security check passed',
      durationMs: Date.now() - startTime,
      issues,
    }
  }
}
