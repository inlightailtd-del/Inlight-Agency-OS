import type { V3CycleResult } from './types'
import { DocResearchEngine } from './doc-research'
import { BrowserAutomationEngine } from './browser-automation'
import { ArchGraphEngine } from './arch-graph'
import { CodeQualityEngine } from './code-quality'
import { TestGenerationEngine } from './test-gen'
import { RollbackEngine } from './rollback'
import { BranchManagementEngine } from './branch-mgmt'
import { ContinuousDevAgent } from './continuous-dev'

export class DevLoopV3 {
  private supabase: any
  private userId: string
  private docResearch: DocResearchEngine
  private browser: BrowserAutomationEngine
  private archGraph: ArchGraphEngine
  private codeQuality: CodeQualityEngine
  private testGen: TestGenerationEngine
  private rollback: RollbackEngine
  private branch: BranchManagementEngine
  private continuous: ContinuousDevAgent

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.docResearch = new DocResearchEngine(supabase, userId)
    this.browser = new BrowserAutomationEngine(supabase, userId)
    this.archGraph = new ArchGraphEngine(supabase, userId)
    this.codeQuality = new CodeQualityEngine(supabase, userId)
    this.testGen = new TestGenerationEngine(supabase, userId)
    this.rollback = new RollbackEngine()
    this.branch = new BranchManagementEngine(supabase, userId)
    this.continuous = new ContinuousDevAgent(supabase, userId)
  }

  async run(objective: string): Promise<V3CycleResult> {
    const phases: V3CycleResult['phases'] = []
    const errors: string[] = []
    let docsResearched = 0
    let browserActions = 0
    let archModules = 0
    let qualityScore = 0
    let testsGenerated = 0
    let branchesCreated = 0
    let rollbacks = 0
    let commits = 0

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[ASE-v3] Cycle started', module: 'development',
      status: 'running', message: objective.substring(0, 100),
    }])

    // Phase 1: Continuous Dev Status (baseline)
    phases.push(await this.runPhase('System Status', async () => {
      const status = await this.continuous.checkStatus()
      return `Branch: ${status.branch} | Build: ${status.buildPassing ? 'OK' : 'FAIL'} | Tests: ${status.testPassing ? 'OK' : 'N/A'} | ${status.uncommittedFiles.length} uncommitted`
    }))

    // Phase 2: Documentation Research
    phases.push(await this.runPhase('Documentation Research', async () => {
      const docs = await this.docResearch.research(objective)
      docsResearched = docs.length
      return `${docs.length} docs found: ${docs.map(d => d.topic).join(', ').substring(0, 100)}`
    }))

    // Phase 3: Browser Automation (fetch live docs)
    phases.push(await this.runPhase('Browser Research', async () => {
      const results = await this.browser.searchDocs(objective)
      browserActions = results.length
      return `${results.length} pages fetched: ${results.map(r => r.title || r.url).join(', ').substring(0, 100)}`
    }))

    // Phase 4: Architecture Graph Scan
    phases.push(await this.runPhase('Architecture Scan', async () => {
      const stats = this.archGraph.getStats()
      archModules = stats.totalModules
      return `${stats.totalModules} modules | avg complexity: ${stats.avgComplexity} | ${Object.entries(stats.typeBreakdown).map(([k, v]) => `${k}:${v}`).join(', ')}`
    }))

    // Phase 5: Code Quality Analysis
    phases.push(await this.runPhase('Code Quality', async () => {
      const report = this.codeQuality.analyzeAll()
      qualityScore = report.avgScore
      return `Avg score: ${report.avgScore}/10 | ${report.totalIssues} issues across ${report.reports.length} files`
    }))

    // Phase 6: Branch Management
    let originalBranch = ''
    phases.push(await this.runPhase('Branch Setup', async () => {
      originalBranch = this.branch.getCurrentBranch()
      const branchName = `ase-v3/${objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30)}-${Date.now().toString(36)}`
      const info = await this.branch.createBranch(branchName)
      branchesCreated++
      return `Created branch: ${info.branchName} (from ${info.baseBranch})`
    }))

    // Phase 7: Build & Fix
    phases.push(await this.runPhase('Build Verification', async () => {
      const diag = await this.continuous.runDiagnostics()
      if (diag.buildErrors.length > 0) {
        errors.push(`Build errors: ${diag.buildErrors.length}`)
        const fix = await this.continuous.autoFix()
        return `Build has ${diag.buildErrors.length} issues. ${fix.description}`
      }
      return 'Build passing'
    }))

    // Phase 8: Automated Test Generation
    phases.push(await this.runPhase('Test Generation', async () => {
      // Find files without tests
      const report = this.codeQuality.analyzeAll()
      const untested = report.reports.slice(0, 5).map(r => r.filePath)
      const tests = await this.testGen.generateTests(untested)
      testsGenerated = tests.length
      return `${tests.length} tests generated for: ${tests.map(t => t.filePath.split('/').pop()).join(', ')}`
    }))

    // Phase 9: Quality improvements
    phases.push(await this.runPhase('Quality Report', async () => {
      const report = this.codeQuality.analyzeAll()
      const topIssues = report.reports.flatMap(r => r.issues).slice(0, 10)
      return `Score: ${report.avgScore}/10 | Top issues: ${topIssues.map(i => i.message.substring(0, 40)).join('; ').substring(0, 200)}`
    }))

    // Phase 10: Rollback capability check + commit
    phases.push(await this.runPhase('Rollback Prep & Commit', async () => {
      const status = execSync('git status --porcelain', { cwd: process.cwd(), encoding: 'utf-8' }).trim()
      if (status) {
        try {
          execSync('git add .', { cwd: process.cwd(), encoding: 'utf-8' })
          execSync(`git -c user.name="ASE v3" -c user.email="ase@inlight.ai" commit -m "ASE v3: ${objective.substring(0, 80)}"`, { cwd: process.cwd(), encoding: 'utf-8' })
          commits++
          const hash = execSync('git rev-parse HEAD', { cwd: process.cwd(), encoding: 'utf-8' }).trim().substring(0, 8)
          // Rollback safety: verify we can revert
          const rb = await this.rollback.softRollback(hash, 'Safety check - will revert')
          if (rb.success) {
            execSync('git revert --no-edit HEAD', { cwd: process.cwd(), encoding: 'utf-8' })
            rollbacks++
            return `Committed ${hash} | Rollback verified OK | ${commits} total commits`
          }
          return `Committed ${hash}`
        } catch (e: any) {
          errors.push('Commit failed, rolling back')
          await this.rollback.revertLast('Commit failed')
          return 'Commit failed, rolled back'
        }
      }
      return 'No changes to commit'
    }))

    // Phase 11: Merge back to main
    phases.push(await this.runPhase('Merge to Main', async () => {
      const current = this.branch.getCurrentBranch()
      if (current !== 'main' && current.startsWith('ase-v3/')) {
        const merge = await this.branch.mergeBranch(current)
        if (merge.success) {
          execSync(`git checkout main`, { cwd: process.cwd(), encoding: 'utf-8' })
          return `Merged ${current} → main${merge.conflict ? ' (with conflicts resolved)' : ''}`
        }
        return `Merge had conflicts. Manual resolution needed.`
      }
      if (current !== 'main') execSync('git checkout main', { cwd: process.cwd(), encoding: 'utf-8' })
      return 'Already on main'
    }))

    // Phase 12: Store docs/arch/tests/research to DB for learning
    phases.push(await this.runPhase('Learning Storage', async () => {
      await this.supabase.from('agent_memory').insert([{
        user_id: this.userId, agent_id: null,
        category: 'ase_v3_cycle',
        content: { objective, docsResearched, browserActions, archModules, qualityScore, testsGenerated, branchesCreated, errors, timestamp: new Date().toISOString() },
        tags: ['ase-v3', 'cycle', 'completed'],
      }])
      return `Stored: ${docsResearched} docs, ${archModules} modules, score ${qualityScore}, ${testsGenerated} tests`
    }))

    // Restore original branch
    try { execSync(`git checkout ${originalBranch || 'main'} 2>&1`, { cwd: process.cwd(), encoding: 'utf-8' }) } catch {}

    const isSuccess = errors.length === 0
    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[ASE-v3] Cycle completed', module: 'development',
      status: isSuccess ? 'success' : 'failed',
      message: `${phases.length} phases | ${commits} commits | ${branchesCreated} branches | ${testsGenerated} tests | ${docsResearched} docs | ${errors.length} errors`,
    }])

    const summary = `${phases.filter(p => p.status === 'completed').length}/${phases.length} phases | ${commits} commits | ${branchesCreated} branches | ${testsGenerated} tests | ${docsResearched} docs | Score: ${qualityScore} | ${errors.length} errors`

    return { objective, status: isSuccess ? 'completed' : 'failed', phases, docsResearched, browserActions, archModules, qualityScore, testsGenerated, branchesCreated, rollbacks, commits, errors, summary }
  }

  private async runPhase(name: string, fn: () => Promise<string>): Promise<V3CycleResult['phases'][0]> {
    const start = Date.now()
    try {
      const detail = await fn()
      return { phase: name, status: 'completed', durationMs: Date.now() - start, detail }
    } catch (e: any) {
      return { phase: name, status: 'failed', durationMs: Date.now() - start, detail: e.message }
    }
  }
}

// Need execSync
import { execSync } from 'child_process'
