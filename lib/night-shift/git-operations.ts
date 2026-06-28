import { execSync } from 'child_process'
import type { GitBranch, GitCommit, GitPullRequest, GitMergeResult, GitRollbackResult, GitCheck } from './types'

export class GitOperations {
  private rootDir: string

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd()
  }

  gitExec(args: string): string {
    return execSync(`git ${args}`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 30000 }).trim()
  }

  async getCurrentBranch(): Promise<string> {
    return this.gitExec('rev-parse --abbrev-ref HEAD')
  }

  async listBranches(): Promise<GitBranch[]> {
    const output = this.gitExec('branch -a --format="%(refname:short)|%(objectname)|%(upstream:track)|%(creatordate:iso8601)"')
    const lines = output.split('\n').filter(Boolean)
    const defaultBranch = await this.getDefaultBranch()

    return lines.map((line) => {
      const [ref, sha, track, date] = line.split('|')
      const name = ref.replace('origin/', '')
      return {
        name,
        sha,
        isDefault: name === defaultBranch || name === 'HEAD',
        isProtected: name === defaultBranch || name === 'main' || name === 'master' || name === 'production',
        createdAt: date || null,
        lastCommit: null,
      }
    }).filter((b) => !b.name.includes('HEAD ->'))
  }

  async createBranch(name: string, baseBranch?: string): Promise<GitBranch> {
    const base = baseBranch || (await this.getDefaultBranch())
    this.gitExec(`checkout -b "${name}" "${base}"`)
    const sha = this.gitExec('rev-parse HEAD')
    this.gitExec(`checkout "${base}"`)
    return { name, sha, isDefault: false, isProtected: false, createdAt: new Date().toISOString(), lastCommit: sha }
  }

  async commit(message: string, files?: string[]): Promise<GitCommit> {
    if (files && files.length > 0) {
      for (const f of files) {
        this.gitExec(`add "${f}"`)
      }
    } else {
      this.gitExec('add -A')
    }
    this.gitExec(`commit --allow-empty -m "${message.replace(/"/g, '\\"')}"`)
    const sha = this.gitExec('rev-parse HEAD')
    const date = this.gitExec('log -1 --format=%cI')
    return { sha, message, author: 'Night Shift', date, files: this.gitExec('diff-tree --no-commit-id --name-only -r HEAD').split('\n').filter(Boolean) }
  }

  async push(branch: string, remote = 'origin'): Promise<void> {
    this.gitExec(`push ${remote} "${branch}"`)
  }

  async pull(branch: string, remote = 'origin'): Promise<void> {
    this.gitExec(`pull ${remote} "${branch}"`)
  }

  async hasChanges(): Promise<boolean> {
    const status = this.gitExec('status --porcelain')
    return status.length > 0
  }

  async getDiffSummary(): Promise<string> {
    return this.gitExec('diff --stat')
  }

  async mergeBranch(source: string, target: string): Promise<GitMergeResult> {
    const current = await this.getCurrentBranch()
    try {
      this.gitExec(`checkout "${target}"`)
      this.gitExec(`pull origin "${target}"`)
      const result = this.gitExec(`merge --no-edit "${source}"`)
      const sha = this.gitExec('rev-parse HEAD')
      this.gitExec(`push origin "${target}"`)
      this.gitExec(`checkout "${current}"`)
      return { success: true, prId: null, sha, mergedAt: new Date().toISOString(), error: null }
    } catch (e: any) {
      this.gitExec('merge --abort')
      this.gitExec(`checkout "${current}"`)
      return { success: false, prId: null, sha: null, mergedAt: null, error: e.message }
    }
  }

  async createPullRequest(params: {
    title: string
    description?: string
    sourceBranch: string
    targetBranch: string
  }): Promise<GitPullRequest> {
    const prBody = params.description ? `-m "${params.title}" --body "${params.description.replace(/"/g, '\\"')}"` : `-m "${params.title}"`
    const output = this.gitExec(`push origin "${params.sourceBranch}" 2>&1`)
    let prId: number | string = Date.now()

    try {
      const ghOutput = this.gitExec(`gh pr create --base "${params.targetBranch}" --head "${params.sourceBranch}" ${prBody} 2>&1`)
      const urlMatch = ghOutput.match(/https:\/\/github\.com\/.*\/pull\/(\d+)/)
      if (urlMatch) prId = parseInt(urlMatch[1])
    } catch {
      const encoded = Buffer.from(JSON.stringify({
        title: params.title,
        body: params.description || '',
        head: params.sourceBranch,
        base: params.targetBranch,
      })).toString('base64')
      this.gitExec(`push origin "${params.sourceBranch}"`)
    }

    return {
      id: prId,
      title: params.title,
      description: params.description || null,
      sourceBranch: params.sourceBranch,
      targetBranch: params.targetBranch,
      state: 'open',
      mergeable: true,
      checks: [],
      createdAt: new Date().toISOString(),
    }
  }

  async mergePullRequest(prId: number | string, method: 'merge' | 'squash' | 'rebase' = 'squash'): Promise<GitMergeResult> {
    try {
      const flag = method === 'squash' ? '--squash' : method === 'rebase' ? '--rebase' : ''
      const output = this.gitExec(`gh pr merge ${prId} ${flag} 2>&1`)
      const sha = this.gitExec('rev-parse HEAD')
      return { success: true, prId, sha, mergedAt: new Date().toISOString(), error: null }
    } catch {
      const prInfo = this.gitExec(`gh pr view ${prId} --json baseRefName,headRefName 2>&1`)
      try {
        const info = JSON.parse(prInfo)
        return this.mergeBranch(info.headRefName, info.baseRefName)
      } catch {
        return { success: false, prId, sha: null, mergedAt: null, error: 'Failed to merge PR' }
      }
    }
  }

  async softRollback(commitHash: string, reason: string): Promise<GitRollbackResult> {
    const fromSha = this.gitExec('rev-parse HEAD')
    try {
      this.gitExec(`revert --no-edit ${commitHash}`)
      const toSha = this.gitExec('rev-parse HEAD')
      return { success: true, fromSha, toSha, reason, filesRestored: 0, timestamp: new Date().toISOString() }
    } catch (e: any) {
      return { success: false, fromSha, toSha: commitHash, reason, filesRestored: 0, timestamp: new Date().toISOString() }
    }
  }

  async hardRollback(commitHash: string, reason: string): Promise<GitRollbackResult> {
    const fromSha = this.gitExec('rev-parse HEAD')
    try {
      this.gitExec(`reset --hard ${commitHash}`)
      this.gitExec('push origin --force-with-lease')
      return { success: true, fromSha, toSha: commitHash, reason, filesRestored: 0, timestamp: new Date().toISOString() }
    } catch (e: any) {
      return { success: false, fromSha, toSha: commitHash, reason, filesRestored: 0, timestamp: new Date().toISOString() }
    }
  }

  async getCommitLog(limit = 20): Promise<GitCommit[]> {
    const output = this.gitExec(`log --oneline --format="%H|%s|%an|%cI" -${limit}`)
    return output.split('\n').filter(Boolean).map((line) => {
      const [sha, message, author, date] = line.split('|')
      return { sha, message, author, date, files: [] }
    })
  }

  async checkMergeConflicts(branch: string, target = 'main'): Promise<{ hasConflicts: boolean; files: string[] }> {
    const current = await this.getCurrentBranch()
    try {
      this.gitExec(`checkout "${target}"`)
      this.gitExec(`merge --no-commit --no-ff "${branch}" 2>&1`)
      const conflicts = this.gitExec('diff --name-only --diff-filter=U').split('\n').filter(Boolean)
      this.gitExec('merge --abort')
      this.gitExec(`checkout "${current}"`)
      return { hasConflicts: conflicts.length > 0, files: conflicts }
    } catch {
      this.gitExec('merge --abort 2>&1 || true')
      this.gitExec(`checkout "${current}"`)
      return { hasConflicts: true, files: ['unknown'] }
    }
  }

  async stash(): Promise<void> {
    this.gitExec('stash')
  }

  async stashPop(): Promise<void> {
    this.gitExec('stash pop')
  }

  async getStatus(): Promise<{ branch: string; changes: number; ahead: number; behind: number }> {
    const branch = await this.getCurrentBranch()
    const changes = parseInt(this.gitExec('status --porcelain | wc -l').trim() || '0')
    let ahead = 0; let behind = 0
    try {
      const tracking = this.gitExec('rev-list --count --left-right HEAD...@{upstream} 2>&1')
      const parts = tracking.split('\t')
      if (parts.length === 2) {
        ahead = parseInt(parts[0]) || 0
        behind = parseInt(parts[1]) || 0
      }
    } catch { /* no upstream */ }
    return { branch, changes, ahead, behind }
  }

  private getDefaultBranch(): string {
    try {
      const remote = this.gitExec('symbolic-ref refs/remotes/origin/HEAD 2>&1')
      return remote.replace('refs/remotes/origin/', '')
    } catch {
      return this.gitExec('rev-parse --abbrev-ref HEAD')
    }
  }
}
