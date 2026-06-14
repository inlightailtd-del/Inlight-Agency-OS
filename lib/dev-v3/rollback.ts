import { execSync } from 'child_process'
import type { RollbackResult } from './types'

export class RollbackEngine {
  private rootDir: string

  constructor() {
    this.rootDir = process.cwd()
  }

  async softRollback(commitHash: string, reason: string): Promise<RollbackResult> {
    try {
      execSync(`git revert --no-edit ${commitHash}`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 15000 })
      return { commitHash, reason, success: true }
    } catch (e: any) {
      return { commitHash, reason, success: false }
    }
  }

  async hardRollback(commitHash: string, reason: string): Promise<RollbackResult> {
    try {
      execSync(`git reset --hard ${commitHash}`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 10000 })
      return { commitHash, reason, success: true }
    } catch (e: any) {
      return { commitHash, reason, success: false }
    }
  }

  async revertLast(reason: string): Promise<RollbackResult> {
    try {
      const hash = execSync('git rev-parse HEAD', { cwd: this.rootDir, encoding: 'utf-8' }).trim()
      return this.softRollback(hash, reason)
    } catch (e: any) {
      return { commitHash: '', reason, success: false }
    }
  }

  async restoreFile(filePath: string, commitHash?: string): Promise<boolean> {
    try {
      const ref = commitHash ? `${commitHash}` : 'HEAD'
      execSync(`git checkout ${ref} -- "${filePath}"`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 10000 })
      return true
    } catch { return false }
  }
}
