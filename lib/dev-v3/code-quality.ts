import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'

export interface QualityReport {
  filePath: string
  qualityScore: number
  issues: { type: string; line?: number; message: string }[]
  loc: number
  complexity: number
}

export class CodeQualityEngine {
  private supabase: any
  private userId: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  analyze(paths: string[]): QualityReport[] {
    const reports: QualityReport[] = []
    for (const path of paths) {
      const fullPath = join(process.cwd(), path)
      if (!existsSync(fullPath)) continue
      const report = this.analyzeFile(path, fullPath)
      if (report) reports.push(report)
    }
    return reports
  }

  analyzeAll(): { reports: QualityReport[]; avgScore: number; totalIssues: number } {
    const dirs = ['lib', 'app', 'components']
    const files: { rel: string; full: string }[] = []
    for (const dir of dirs) {
      const full = join(process.cwd(), dir)
      if (existsSync(full)) files.push(...this.walk(full))
    }

    const reports = files.map(f => this.analyzeFile(f.rel, f.full)).filter(Boolean) as QualityReport[]
    const avgScore = reports.length ? Math.round(reports.reduce((s, r) => s + r.qualityScore, 0) / reports.length * 10) / 10 : 0
    const totalIssues = reports.reduce((s, r) => s + r.issues.length, 0)
    return { reports, avgScore, totalIssues }
  }

  private analyzeFile(relPath: string, fullPath: string): QualityReport | null {
    try {
      const content = readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')
      const issues: QualityReport['issues'] = []
      let complexity = 1

      // Check for issues
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNum = i + 1

        if (line.length > 200) issues.push({ type: 'style', line: lineNum, message: 'Line exceeds 200 characters' })
        if (line.includes('console.log')) issues.push({ type: 'debug', line: lineNum, message: 'Console.log left in code' })
        if (line.includes('TODO') || line.includes('FIXME')) issues.push({ type: 'todo', line: lineNum, message: 'Unresolved TODO/FIXME' })
        if (line.match(/any\s*[;=)]/) || line.match(/:\s*any\b/)) issues.push({ type: 'typescript', line: lineNum, message: 'Usage of `any` type' })
        if (line.includes('// @ts-ignore') || line.includes('// @ts-expect-error')) issues.push({ type: 'typescript', line: lineNum, message: 'TypeScript suppression comment' })
        if (line.match(/catch\s*\(.*\)\s*\{\s*\}/) || line.match(/catch\s*\{\s*\}/)) issues.push({ type: 'error_handling', line: lineNum, message: 'Empty catch block' })
        if (line.match(/function\s+\w+\s*\([^)]{0,5}\)/)) issues.push({ type: 'design', line: lineNum, message: 'Very short function signature - consider naming' })

        complexity += (line.match(/\bif\b|\bfor\b|\bwhile\b|\bcatch\b|\bcase\b/g) || []).length
      }

      // Calculate score (0-10)
      let score = 10
      score -= issues.length * 0.5
      score -= Math.max(0, (lines.length - 200) * 0.02) // penalty for long files
      score -= Math.max(0, (complexity - 20) * 0.1) // penalty for complexity
      score = Math.max(0, Math.min(10, score))
      score = Math.round(score * 10) / 10

      return { filePath: relPath, qualityScore: score, issues, loc: lines.length, complexity }
    } catch { return null }
  }

  private walk(dir: string): { rel: string; full: string }[] {
    const results: { rel: string; full: string }[] = []
    try {
      const entries = require('fs').readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        const full = join(dir, e.name)
        if (e.isDirectory()) {
          if (!['node_modules', '.next', '.git'].includes(e.name)) results.push(...this.walk(full))
        } else if (['.ts', '.tsx'].includes(extname(e.name))) {
          results.push({ rel: full.replace(process.cwd() + '\\', '').replace(/\\/g, '/'), full })
        }
      }
    } catch {}
    return results
  }
}
