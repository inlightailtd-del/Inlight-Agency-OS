import { execSync } from 'child_process'
import type { SwarmAgent, SwarmTask, V2CycleResult } from './types'
import { GitEngine } from './git-engine'
import { RepoGraphEngine } from './repo-graph'
import { RootCauseAnalysisEngine } from './rca-engine'
import { ADREngine } from './adr-engine'
import { ToolOrchestrationEngine } from './tool-orchestrator'

export class DevLoopV2 {
  private supabase: any
  private userId: string
  private git: GitEngine
  private graph: RepoGraphEngine
  private rca: RootCauseAnalysisEngine
  private adr: ADREngine
  private tools: ToolOrchestrationEngine

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.git = new GitEngine(supabase, userId)
    this.graph = new RepoGraphEngine(supabase, userId)
    this.rca = new RootCauseAnalysisEngine(supabase, userId)
    this.adr = new ADREngine(supabase, userId)
    this.tools = new ToolOrchestrationEngine(supabase, userId)
  }

  async run(objective: string, mode: 'full' | 'quick' | 'fix' | 'feature' | 'refactor' = 'full'): Promise<V2CycleResult> {
    const cycleId = `v2-${Date.now()}`
    const phases: V2CycleResult['phases'] = []
    const errors: string[] = []

    await this.supabase.from('dev_cycles').insert([{
      user_id: this.userId, objective, mode, status: 'running',
      started_at: new Date().toISOString(),
    }])

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[ASE-v2] Cycle started', module: 'development',
      status: 'running', message: `Mode: ${mode} | ${objective.substring(0, 100)}`,
    }])

    switch (mode) {
      case 'quick':
        return this.runQuick(cycleId, objective)
      case 'fix':
        return this.runFix(cycleId, objective)
      default:
        return this.runFull(cycleId, objective)
    }
  }

  private async runQuick(cycleId: string, objective: string): Promise<V2CycleResult> {
    const phases: V2CycleResult['phases'] = []
    const errors: string[] = []

    // Phase 1: Git status
    phases.push(await this.runPhase('Git Status', async () => {
      const status = await this.git.status()
      return `Branch: ${status.branch}, ${status.modified.length} modified, ${status.staged.length} staged, ${status.untracked.length} untracked`
    }))

    // Phase 2: Build check
    phases.push(await this.runPhase('Build Check', async () => {
      const buildResult = await this.tools.execute('run_build', {})
      return buildResult.success ? 'BUILD PASSED' : `BUILD FAILED: ${buildResult.output.substring(0, 200)}`
    }))

    // Phase 3: Git history
    phases.push(await this.runPhase('Recent Commits', async () => {
      const history = await this.git.getHistory(5)
      return history.map(h => `${h.hash} ${h.message.substring(0, 60)}`).join(' | ')
    }))

    await this.logCycleComplete(cycleId, objective, phases, errors, 0, 0)
    return this.buildResult(objective, phases, errors, 0, 0)
  }

  private async runFix(cycleId: string, objective: string): Promise<V2CycleResult> {
    const phases: V2CycleResult['phases'] = []
    const errors: string[] = []

    phases.push(await this.runPhase('Git Status', async () => {
      const status = await this.git.status()
      return `Branch: ${status.branch}, ${status.modified.length} modified`
    }))

    phases.push(await this.runPhase('Build Attempt', async () => {
      const result = await this.tools.execute('run_build', {})
      if (!result.success) {
        const rcaResult = await this.rca.analyze('Build failure', result.output, { buildOutput: result.output, phase: cycleId })
        errors.push(`Build failed: ${rcaResult.rootCause.substring(0, 100)}`)
        return `FAILED: ${rcaResult.rootCause.substring(0, 200)}`
      }
      return 'PASSED'
    }))

    phases.push(await this.runPhase('Git Commit Fixes', async () => {
      const status = await this.git.status()
      const hasChanges = status.modified.length > 0 || status.untracked.length > 0
      if (hasChanges) {
        const commit = await this.git.commit({ message: `ASE v2 fix: ${objective.substring(0, 60)}`, branch: status.branch, filesChanged: status.modified, additions: 0, deletions: 0, status: 'committed', cycleId })
        if (commit.success) return `Committed: ${commit.hash}`
        return commit.error || 'Commit failed'
      }
      return 'No changes'
    }))

    let adrsCreated = 0
    if (errors.length > 0) {
      await this.adr.createFromDecision(`Fix: ${objective.substring(0, 80)}`, `Fix cycle with ${errors.length} errors`, `Applied fix for build errors`, ['ase-v2', 'fix'])
      adrsCreated++
    }

    await this.logCycleComplete(cycleId, objective, phases, errors, 0, adrsCreated)
    return this.buildResult(objective, phases, errors, 0, adrsCreated)
  }

  private async runFull(cycleId: string, objective: string): Promise<V2CycleResult> {
    const phases: V2CycleResult['phases'] = []
    const errors: string[] = []
    let commits = 0
    let adrsCreated = 0

    // Phase 1: Git status
    phases.push(await this.runPhase('Git Status', async () => {
      const status = await this.git.status()
      return `Branch: ${status.branch}, ${status.modified.length} modified`
    }))

    // Phase 2: Build check
    let buildPassing = false
    phases.push(await this.runPhase('Build Check', async () => {
      const result = await this.tools.execute('run_build', {})
      buildPassing = result.success
      return buildPassing ? 'PASSED' : 'FAILED'
    }))

    if (!buildPassing) {
      phases.push(await this.runPhase('Build Fix', async () => {
        const result = await this.tools.execute('run_build', {})
        if (!result.success) {
          const rcaResult = await this.rca.analyze('Build failure', result.output, { buildOutput: result.output, phase: cycleId })
          errors.push(rcaResult.rootCause.substring(0, 100))
          return `Attempted fix: ${rcaResult.fix}`
        }
        return 'Build fixed'
      }))
    }

    // Phase 3: Git history
    phases.push(await this.runPhase('Recent Commits', async () => {
      const history = await this.git.getHistory(5)
      return history.map(h => h.message.substring(0, 60)).join(' | ')
    }))

    // Phase 4: Commit if changes
    phases.push(await this.runPhase('Git Commit', async () => {
      const status = await this.git.status()
      if (status.modified.length > 0 || status.untracked.length > 0) {
        const result = await this.git.commit({ message: `ASE v2: ${objective.substring(0, 60)}`, branch: status.branch, filesChanged: [...status.modified, ...status.untracked], additions: 0, deletions: 0, status: 'committed', cycleId })
        if (result.success) { commits++; return `Committed: ${result.hash}` }
        return result.error || 'Failed'
      }
      return 'No changes'
    }))

    // Phase 5: ADR
    await this.adr.createFromDecision(objective.substring(0, 100), `Full ASE v2 cycle. Errors: ${errors.length}`, `Completed with ${buildPassing ? 'passing' : 'failing'} build`, ['ase-v2', 'full'])
    adrsCreated++

    // Phase 6: Store lessons
    if (errors.length > 0) {
      await this.supabase.from('agent_memory').insert([{
        user_id: this.userId, agent_id: null, category: 'dev_v2_lessons',
        content: { cycleId, objective, errors, timestamp: new Date().toISOString() },
        tags: ['dev-v2', 'lesson', 'automated'],
      }])
    }

    await this.logCycleComplete(cycleId, objective, phases, errors, commits, adrsCreated)
    return this.buildResult(objective, phases, errors, commits, adrsCreated)
  }

  private async runPhase(name: string, fn: () => Promise<string>): Promise<V2CycleResult['phases'][0]> {
    const start = Date.now()
    try {
      const detail = await fn()
      return { phase: name, status: 'completed', durationMs: Date.now() - start, detail }
    } catch (e: any) {
      return { phase: name, status: 'failed', durationMs: Date.now() - start, detail: e.message }
    }
  }

  private async logCycleComplete(cycleId: string, objective: string, phases: any[], errors: string[], commits: number, adrsCreated: number) {
    const isSuccess = errors.length === 0
    await this.supabase.from('dev_cycles')
      .update({ status: isSuccess ? 'completed' : 'failed', execution_log: phases, errors, commit_count: commits, completed_at: new Date().toISOString() })
      .eq('user_id', this.userId).eq('started_at', new Date().toISOString().split('.')[0] + '%').is('completed_at', null)

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[ASE-v2] Cycle completed', module: 'development',
      status: isSuccess ? 'success' : 'failed',
      message: `${phases.filter(p => p.status === 'completed').length}/${phases.length} phases | ${commits} commits | ${adrsCreated} ADRs | ${errors.length} errors`,
    }])
  }

  private buildResult(objective: string, phases: any[], errors: string[], commits: number, adrsCreated: number): V2CycleResult {
    const isSuccess = errors.length === 0
    return {
      objective, status: isSuccess ? 'completed' : 'failed', cycles: 1, commits,
      filesChanged: phases.length, adrsCreated, rcasLogged: errors.length, errors,
      summary: `${phases.filter(p => p.status === 'completed').length}/${phases.length} phases | ${commits} commits | ${adrsCreated} ADRs | ${errors.length} errors`,
      phases,
    }
  }
}
