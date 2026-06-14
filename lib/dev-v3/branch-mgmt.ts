import { execSync } from 'child_process'
import type { BranchInfo } from './types'

export class BranchManagementEngine {
  private rootDir: string
  private supabase: any
  private userId: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  getCurrentBranch(): string {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.rootDir, encoding: 'utf-8' }).trim()
  }

  async createBranch(name: string, base = 'main'): Promise<BranchInfo> {
    execSync(`git checkout ${base}`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 10000 })
    execSync(`git checkout -b ${name}`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 10000 })

    const info: BranchInfo = { branchName: name, baseBranch: base, status: 'active', commits: 0 }
    await this.storeBranch(info)
    return info
  }

  async mergeBranch(branch: string, deleteAfter = true): Promise<{ success: boolean; conflict: boolean }> {
    try {
      execSync(`git checkout main`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 10000 })
      execSync(`git merge ${branch} --no-edit`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 15000 })
      await this.updateBranch(branch, 'merged')
      if (deleteAfter) execSync(`git branch -d ${branch}`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 5000 })
      return { success: true, conflict: false }
    } catch (e: any) {
      const conflict = (e.stderr || '').includes('conflict')
      if (conflict) await this.updateBranch(branch, 'conflicted')
      return { success: false, conflict }
    }
  }

  async listBranches(): Promise<string[]> {
    return execSync('git branch', { cwd: this.rootDir, encoding: 'utf-8' }).trim().split('\n').map(b => b.trim().replace('* ', ''))
  }

  async getBranchDiff(branch: string): Promise<{ filesChanged: number; additions: number; deletions: number }> {
    try {
      const base = execSync(`git merge-base ${branch} main`, { cwd: this.rootDir, encoding: 'utf-8' }).trim()
      const output = execSync(`git diff --shortstat ${base}..${branch}`, { cwd: this.rootDir, encoding: 'utf-8' }).trim()
      const files = parseInt(output.match(/(\d+)\s+file/)![1]) || 0
      const add = parseInt(output.match(/(\d+)\s+insertion/)![1]) || 0
      const del = parseInt(output.match(/(\d+)\s+deletion/)![1]) || 0
      return { filesChanged: files, additions: add, deletions: del }
    } catch { return { filesChanged: 0, additions: 0, deletions: 0 } }
  }

  private async storeBranch(info: BranchInfo) {
    await this.supabase.from('dev_v3_branches').insert([{
      user_id: this.userId, branch_name: info.branchName,
      base_branch: info.baseBranch, status: 'active', commits: 0,
    }]).catch(() => {})
  }

  private async updateBranch(name: string, status: string) {
    await this.supabase.from('dev_v3_branches')
      .update({ status, merged_at: new Date().toISOString() })
      .eq('branch_name', name).catch(() => {})
  }
}
