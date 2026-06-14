import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { execSync } from 'child_process'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FileOp {
  operation: 'create' | 'modify' | 'delete'
  path: string
  content?: string
  description: string
}

export interface ExecutionResult {
  filesChanged: number
  buildSuccess: boolean
  lintSuccess: boolean
  buildOutput: string
  lintOutput: string
  errors: string[]
  durationMs: number
}

export class ExecutionEngine {
  private supabase: SupabaseClient
  private userId: string
  private rootDir: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  async execute(files: FileOp[]): Promise<ExecutionResult> {
    const startTime = Date.now()
    const errors: string[] = []

    // Phase 1: Write all files
    let filesChanged = 0
    for (const file of files) {
      try {
        const fullPath = join(this.rootDir, file.path)
        switch (file.operation) {
          case 'create':
          case 'modify':
            mkdirSync(dirname(fullPath), { recursive: true })
            writeFileSync(fullPath, file.content || '', 'utf-8')
            filesChanged++
            break
          case 'delete':
            if (existsSync(fullPath)) {
              const rm = await import('fs/promises')
              await rm.unlink(fullPath)
              filesChanged++
            }
            break
        }
      } catch (e: any) {
        errors.push(`File ${file.operation} failed for ${file.path}: ${e.message}`)
      }
    }

    // Phase 2: Run build
    let buildSuccess = false
    let buildOutput = ''
    try {
      buildOutput = execSync('npm run build 2>&1', {
        cwd: this.rootDir, timeout: 120000, maxBuffer: 10 * 1024 * 1024,
      }).toString()
      buildSuccess = !buildOutput.includes('Failed to compile') && buildOutput.includes('✓ Compiled successfully')
    } catch (e: any) {
      buildOutput = e.stdout?.toString() || e.stderr?.toString() || e.message || ''
      buildSuccess = !buildOutput.includes('Failed to compile') && buildOutput.includes('✓ Compiled successfully')
      if (!buildSuccess) errors.push('Build failed')
    }

    // Phase 3: Run lint
    let lintSuccess = false
    let lintOutput = ''
    try {
      lintOutput = execSync('npm run lint 2>&1', {
        cwd: this.rootDir, timeout: 60000, maxBuffer: 5 * 1024 * 1024,
      }).toString()
      lintSuccess = lintOutput.includes('No results found') || lintOutput.includes('All files pass')
    } catch (e: any) {
      lintOutput = e.stdout?.toString() || e.stderr?.toString() || e.message || ''
      lintSuccess = lintOutput.includes('No results found') || lintOutput.includes('All files pass')
      if (!lintSuccess) errors.push('Lint failed')
    }

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[DevSystem] Execution completed',
      module: 'development', status: buildSuccess ? 'success' : 'failed',
      message: `${filesChanged} files, build: ${buildSuccess ? '✓' : '✗'}, lint: ${lintSuccess ? '✓' : '✗'}, errors: ${errors.length}`,
    }])

    return {
      filesChanged,
      buildSuccess,
      lintSuccess,
      buildOutput: buildOutput.substring(0, 2000),
      lintOutput: lintOutput.substring(0, 1000),
      errors,
      durationMs: Date.now() - startTime,
    }
  }
}
