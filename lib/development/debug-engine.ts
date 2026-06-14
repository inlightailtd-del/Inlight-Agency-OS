import { execSync } from 'child_process'
import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { ExecutionEngine, type FileOp } from './execution-engine'

export interface DebugCycle {
  attempt: number
  buildOutput: string
  error: string
  fix: string
  filesChanged: string[]
  success: boolean
}

export interface DebugResult {
  totalAttempts: number
  success: boolean
  cycles: DebugCycle[]
  finalBuildOutput: string
  errors: string[]
}

export class DebugEngine {
  private supabase: SupabaseClient
  private userId: string
  private executionEngine: ExecutionEngine

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.executionEngine = new ExecutionEngine(supabase, userId)
  }

  async debug(maxAttempts = 5): Promise<DebugResult> {
    const cycles: DebugCycle[] = []
    const errors: string[] = []
    let success = false

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let buildOutput = ''
      try {
        buildOutput = execSync('npm run build 2>&1', {
          cwd: process.cwd(), timeout: 120000, maxBuffer: 10 * 1024 * 1024,
        }).toString()
      } catch (e: any) {
        buildOutput = e.stdout?.toString() || e.stderr?.toString() || e.message || ''
      }

      if (buildOutput.includes('✓ Compiled successfully') && !buildOutput.includes('Failed to compile')) {
        cycles.push({ attempt, buildOutput, error: '', fix: 'No errors found', filesChanged: [], success: true })
        success = true
        break
      }

      const errorLine = this.extractBuildError(buildOutput)
      if (!errorLine) {
        cycles.push({ attempt, buildOutput, error: 'Could not extract error', fix: '', filesChanged: [], success: false })
        errors.push('Attempt ' + attempt + ': could not extract error')
        break
      }

      const fixResult = await this.getFix(errorLine, buildOutput)
      if (fixResult.files && fixResult.files.length > 0) {
        await this.executionEngine.execute(fixResult.files)
      }

      cycles.push({ attempt, buildOutput: buildOutput.substring(0, 1000), error: errorLine, fix: fixResult.explanation, filesChanged: fixResult.files?.map(f => f.path) || [], success: false })

      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null, action: '[DevSystem] Debug attempt ' + attempt,
        module: 'development', status: 'failed',
        message: `Error: ${errorLine.substring(0, 150)} | Fix: ${fixResult.explanation.substring(0, 100)}`,
      }])
    }

    if (!success) errors.push(`Debug failed after ${maxAttempts} attempts`)

    await this.supabase.from('development_memory').insert([{
      user_id: this.userId, type: errors.length > 0 ? 'failure' : 'fix',
      name: `Debug session: ${success ? 'resolved' : 'failed'} in ${cycles.length} attempts`,
      description: success ? 'Build errors successfully resolved' : 'Could not resolve build errors',
      content: { cycles: cycles.length, success, totalAttempts: cycles.length, completedAt: new Date().toISOString() },
      tags: ['development', 'debug', success ? 'success' : 'failure'], status: 'active',
    }])

    return { totalAttempts: cycles.length, success, cycles, finalBuildOutput: cycles[cycles.length - 1]?.buildOutput || '', errors }
  }

  private extractBuildError(output: string): string {
    // TypeScript errors
    const tsError = output.match(/Type error: (.+)/)
    if (tsError) return tsError[1].trim()

    // Module not found
    const moduleError = output.match(/Module not found: (.+)/)
    if (moduleError) return moduleError[1].trim()

    // Compilation errors
    const compileError = output.match(/Failed to compile[^]*?(Error:|error)/)
    if (compileError) return compileError[0].substring(0, 300).trim()

    // Generic error
    const genericError = output.match(/(?:Error|ERROR|error):\s*(.+)/)
    if (genericError) return genericError[1].substring(0, 300).trim()

    return output.substring(0, 300)
  }

  private async getFix(errorLine: string, buildOutput: string): Promise<{ explanation: string; files: FileOp[] }> {
    const prompt = `Fix this build error in Inlight Agency OS (Next.js 14, TypeScript, Supabase):

ERROR: ${errorLine}
BUILD OUTPUT (last 2000 chars):
${buildOutput.slice(-2000)}

Return a JSON fix plan:
{
  "explanation": "What caused the error and how to fix it",
  "files": [
    { "operation": "create|modify|delete", "path": "relative/file/path.ts", "content": "fixed code", "description": "brief description" }
  ]
}

CRITICAL RULES:
- Use @/ alias for imports
- Use TypeScript with proper types
- Add 'use client' for React hooks/state
- Match existing code patterns in this project`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: `You are a senior TypeScript/Next.js debug engineer. You analyze build errors and provide minimal, correct fixes. You understand common Next.js 14 patterns: 'use client' directives, App Router conventions, supabase-js imports, and Tailwind CSS usage.`,
    })

    try {
      const match = result.response?.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch {}

    return { explanation: 'Could not parse AI fix response', files: [] }
  }
}
