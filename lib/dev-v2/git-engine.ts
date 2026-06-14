import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { GitCommit } from './types'

export class GitEngine {
  private rootDir: string
  private supabase: any
  private userId: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  async status(): Promise<{ branch: string; modified: string[]; staged: string[]; untracked: string[] }> {
    const branch = this.run('git rev-parse --abbrev-ref HEAD').trim()
    const modified = this.run('git diff --name-only').trim().split('\n').filter(Boolean)
    const staged = this.run('git diff --cached --name-only').trim().split('\n').filter(Boolean)
    const untracked = this.run('git ls-files --others --exclude-standard').trim().split('\n').filter(Boolean)
    return { branch, modified, staged, untracked }
  }

  async diff(): Promise<{ path: string; additions: number; deletions: number }[]> {
    const output = this.run('git diff --numstat').trim()
    if (!output) return []
    return output.split('\n').map(line => {
      const [add, del, ...pathParts] = line.split('\t')
      return { path: pathParts.join('\t'), additions: parseInt(add) || 0, deletions: parseInt(del) || 0 }
    })
  }

  async commit(commit: GitCommit): Promise<{ hash: string; success: boolean; error?: string }> {
    try {
      // Stage all changes
      this.run('git add .')
      // Check if there's anything to commit
      const status = this.run('git status --porcelain').trim()
      if (!status) return { hash: '', success: false, error: 'Nothing to commit' }

      // Count additions/deletions
      const diff = await this.diff()
      const additions = diff.reduce((s, f) => s + f.additions, 0)
      const deletions = diff.reduce((s, f) => s + f.deletions, 0)
      const filesChanged = diff.map(f => f.path)

      // Author config
      const author = commit.authorName || 'Inlight ASE v2'
      const email = commit.authorEmail || 'ase@inlight.ai'

      // Commit
      this.run(`git -c user.name="${author}" -c user.email="${email}" commit -m "${commit.message}"`)
      this.run('git push origin HEAD', { ignoreError: true })

      const hash = this.run('git rev-parse HEAD').trim()

      // Store in DB
      await this.supabase.from('dev_git_commits').insert([{
        user_id: this.userId,
        cycle_id: commit.cycleId || null,
        branch: commit.branch || 'main',
        message: commit.message,
        files_changed: filesChanged,
        additions,
        deletions,
        status: 'committed',
        hash,
        author_name: author,
        author_email: email,
      }])

      return { hash, success: true }
    } catch (e: any) {
      return { hash: '', success: false, error: e.message }
    }
  }

  async getHistory(count = 20): Promise<{ hash: string; message: string; author: string; date: string; files: string[] }[]> {
    const output = this.run(`git log --oneline --name-only -${count} --format="HASH:%h%nMSG:%s%nAUTH:%an%nDATE:%ad"`).trim()
    const commits: any[] = []
    const blocks = output.split('HASH:').filter(Boolean)
    for (const block of blocks) {
      const [hash, msg, auth, date, ...files] = block.split('\n').map(l => l.trim()).filter(Boolean)
      commits.push({ hash, message: msg || '', author: auth || '', date: date || '', files: files.filter(f => f && !f.startsWith('MSG:') && !f.startsWith('AUTH:') && !f.startsWith('DATE:')) })
    }
    return commits
  }

  async getFileHistory(filePath: string): Promise<{ hash: string; message: string; date: string }[]> {
    const output = this.run(`git log --oneline --format="HASH:%h%nMSG:%s%nDATE:%ad" -- "${filePath}"`).trim()
    if (!output) return []
    const commits: any[] = []
    const blocks = output.split('HASH:').filter(Boolean)
    for (const block of blocks) {
      const [hash, msg, date] = block.split('\n').map(l => l.trim()).filter(Boolean)
      commits.push({ hash, message: msg || '', date: date || '' })
    }
    return commits
  }

  async getBlame(filePath: string): Promise<{ line: number; author: string; date: string; content: string }[]> {
    if (!existsSync(join(this.rootDir, filePath))) return []
    const output = this.run(`git blame --line-porcelain "${filePath}"`).trim()
    return output.split('\n').filter(l => l.startsWith('author ')).map((_, i) => ({
      line: i + 1, author: '', date: '', content: ''
    }))
  }

  private run(cmd: string, opts: { ignoreError?: boolean } = {}): string {
    try {
      return execSync(cmd, { cwd: this.rootDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (e: any) {
      if (opts.ignoreError) return ''
      throw new Error(`Git: ${e.stderr || e.message}`)
    }
  }
}
