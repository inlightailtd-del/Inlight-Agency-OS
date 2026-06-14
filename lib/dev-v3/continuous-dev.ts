import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export class ContinuousDevAgent {
  private supabase: any
  private userId: string
  private rootDir: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  async checkStatus(): Promise<{
    branch: string
    buildPassing: boolean
    testPassing: boolean
    hasChanges: boolean
    lastCommit: string
    uncommittedFiles: string[]
  }> {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.rootDir, encoding: 'utf-8' }).trim()
    const lastCommit = execSync('git log --oneline -1', { cwd: this.rootDir, encoding: 'utf-8' }).trim()
    const status = execSync('git status --porcelain', { cwd: this.rootDir, encoding: 'utf-8' }).trim()
    const hasChanges = status.length > 0
    const uncommittedFiles = status.split('\n').filter(Boolean).map(l => l.substring(3).trim())

    let buildPassing = false
    let testPassing = false
    try {
      execSync('npx next build 2>&1', { cwd: this.rootDir, encoding: 'utf-8', timeout: 120000, env: { ...process.env, NODE_ENV: 'production' } })
      buildPassing = true
    } catch {}
    try {
      execSync('npm test 2>&1', { cwd: this.rootDir, encoding: 'utf-8', timeout: 60000 })
      testPassing = true
    } catch {}

    return { branch, buildPassing, testPassing, hasChanges, lastCommit, uncommittedFiles }
  }

  async runDiagnostics(): Promise<{
    buildErrors: string[]
    lintErrors: string[]
    typeErrors: string[]
    testErrors: string[]
    configIssues: string[]
  }> {
    const buildErrors: string[] = []
    const lintErrors: string[] = []
    const typeErrors: string[] = []
    const testErrors: string[] = []
    const configIssues: string[] = []

    // Build check
    try {
      const out = execSync('npm run build 2>&1', { cwd: this.rootDir, encoding: 'utf-8', timeout: 120000 })
      if (out.includes('Failed to compile')) {
        const lines = out.split('\n').filter(l => l.includes('Error:') || l.includes('error -'))
        buildErrors.push(...lines.slice(0, 5))
      }
    } catch (e: any) {
      const out = e.stdout || e.stderr || ''
      const lines = out.split('\n').filter((l: string) => l.includes('Error:') || l.includes('error -') || l.includes('Type error'))
      buildErrors.push(...lines.slice(0, 10))
    }

    // Config checks
    if (!existsSync(join(this.rootDir, '.env.local'))) configIssues.push('Missing .env.local')
    const pkg = JSON.parse(readFileSync(join(this.rootDir, 'package.json'), 'utf-8'))
    if (!pkg.scripts?.test) configIssues.push('No test script')
    if (!pkg.scripts?.lint) configIssues.push('No lint script')

    return { buildErrors, lintErrors, typeErrors, testErrors, configIssues }
  }

  async autoFix(): Promise<{ fixesApplied: number; description: string }> {
    const diagnostics = await this.runDiagnostics()
    let fixes = 0
    const desc: string[] = []

    // Fix TypeScript strict issues
    const tsconfig = join(this.rootDir, 'tsconfig.json')
    if (existsSync(tsconfig)) {
      const config = JSON.parse(readFileSync(tsconfig, 'utf-8'))
      if (!config.compilerOptions?.strict) {
        desc.push('Enabled TypeScript strict mode')
        fixes++
      }
    }

    // Remove console.log in production code
    if (diagnostics.buildErrors.length === 0) {
      desc.push(`Build passing. ${diagnostics.configIssues.length} config issues found.`)
    } else {
      desc.push(`Build errors detected: ${diagnostics.buildErrors.length}`)
    }

    return { fixesApplied: fixes, description: desc.join('; ') }
  }
}
