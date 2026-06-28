import type { SupabaseClient } from '@supabase/supabase-js'
import type { DaemonConfig, GitBranch, GitMergeResult } from './types'
import { NightShiftEngine } from './night-shift'
import { GitOperations } from './git-operations'
import { NightShiftDaemon } from './daemon'
import { NightShiftMonitor } from './monitoring'
import { processNextJob } from '@/lib/queue/worker'

export interface RuntimeCycleResult {
  loopNumber: number
  jobsProcessed: number
  goalsProcessed: number
  branchesCreated: number
  prsMerged: number
  rollbacksPerformed: number
  errors: string[]
  durationMs: number
}

export class NightShiftRuntime {
  private engine: NightShiftEngine
  private git: GitOperations
  private daemon: NightShiftDaemon
  private monitor: NightShiftMonitor
  private lastBranchPrefix = 'night-shift'

  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {
    this.engine = new NightShiftEngine(supabase, userId)
    this.git = new GitOperations()
    this.daemon = new NightShiftDaemon(supabase, userId)
    this.monitor = this.daemon.getMonitor()
  }

  async start(config?: Partial<DaemonConfig>): Promise<void> {
    if (config) await this.daemon.setConfig(config)
    this.daemon.onLoop(async () => {
      await this.runCycle()
    })
    await this.daemon.start()
  }

  async stop(): Promise<void> {
    await this.daemon.stop()
  }

  async pause(): Promise<void> {
    await this.daemon.pause()
  }

  async resume(): Promise<void> {
    await this.daemon.resume()
  }

  getDaemon(): NightShiftDaemon { return this.daemon }
  getEngine(): NightShiftEngine { return this.engine }
  getGit(): GitOperations { return this.git }
  getMonitor(): NightShiftMonitor { return this.monitor }

  async runCycle(): Promise<RuntimeCycleResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let jobsProcessed = 0
    let goalsProcessed = 0
    let branchesCreated = 0
    let prsMerged = 0
    let rollbacksPerformed = 0

    try {
      const jobResult = await processNextJob(this.supabase)
      if (jobResult.processed) jobsProcessed++
    } catch (e: any) {
      errors.push(`Queue: ${e.message}`)
    }

    try {
      const goal = await this.engine.getNext()
      if (goal) {
        await this.engine.runCycle()
        goalsProcessed++

        if (this.daemon.getState().config.gitAutoSync) {
          try {
            const branchName = `${this.lastBranchPrefix}/goal-${goal.objective?.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now()}`
            const branch = await this.git.createBranch(branchName)
            branchesCreated++

            const hasChanges = await this.git.hasChanges()
            if (hasChanges) {
              await this.git.commit(`Night Shift: ${goal.objective?.slice(0, 60)}`)
              await this.git.push(branchName)

              if (this.daemon.getState().config.autoMergeEnabled) {
                const check = await this.git.checkMergeConflicts(branchName)
                if (!check.hasConflicts) {
                  const mergeResult = await this.git.mergeBranch(branchName, 'main')
                  if (mergeResult.success) {
                    prsMerged++
                    await this.engine.log('pr_merged', `PR merged: ${branchName} → main`)
                  } else {
                    errors.push(`Merge failed for ${branchName}: ${mergeResult.error}`)
                  }
                }
              }
            } else {
              const currentBranch = await this.git.getCurrentBranch()
              try {
                await this.git.gitExec(`branch -D "${branchName}"`)
              } catch { /* ignore */ }
            }
          } catch (e: any) {
            errors.push(`Git: ${e.message}`)
          }
        }
      }
    } catch (e: any) {
      errors.push(`Goals: ${e.message}`)
    }

    if (this.daemon.getState().config.autoRollbackEnabled) {
      const consecutiveErrors = this.monitor.getConsecutiveErrors()
      if (consecutiveErrors >= 3) {
        try {
          const recentCommits = await this.git.getCommitLog(3)
          if (recentCommits.length > 0) {
            const lastGood = recentCommits[recentCommits.length - 1]
            const rollback = await this.git.softRollback(lastGood.sha, `Auto-rollback after ${consecutiveErrors} consecutive errors`)
            if (rollback.success) rollbacksPerformed++
          }
        } catch (e: any) {
          errors.push(`Rollback: ${e.message}`)
        }
      }
    }

    return {
      loopNumber: this.daemon.getState().totalLoops,
      jobsProcessed,
      goalsProcessed,
      branchesCreated,
      prsMerged,
      rollbacksPerformed,
      errors,
      durationMs: Date.now() - startTime,
    }
  }
}
