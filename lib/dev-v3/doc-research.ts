import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { DocResearchResult } from './types'

export class DocResearchEngine {
  private supabase: any
  private userId: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async research(topic: string): Promise<DocResearchResult[]> {
    const results: DocResearchResult[] = []

    // 1. Search local docs
    results.push(...await this.searchLocalDocs(topic))
    // 2. Search npm registry
    results.push(...await this.searchNpm(topic))
    // 3. Search project docs
    results.push(...await this.searchProjectDocs(topic))

    // Store
    for (const r of results) {
      await this.supabase.from('dev_v3_docs').insert([{
        user_id: this.userId, topic: r.topic, url: r.url,
        summary: r.summary, relevance: r.relevance, source: 'web',
      }]).catch(() => {})
    }

    return results
  }

  private async searchLocalDocs(topic: string): Promise<DocResearchResult[]> {
    const results: DocResearchResult[] = []
    const docsDir = join(process.cwd(), 'docs')
    if (!existsSync(docsDir)) return results

    try {
      const files = execSync(`dir /b "${docsDir}\\*.md"`, { encoding: 'utf-8', timeout: 5000 }).trim().split('\n').filter(Boolean)
      for (const file of files.slice(0, 10)) {
        const content = readFileSync(join(docsDir, file.trim()), 'utf-8')
        if (content.toLowerCase().includes(topic.toLowerCase())) {
          results.push({
            topic,
            url: `/docs/${file.trim()}`,
            summary: content.split('\n').slice(0, 3).join(' ').substring(0, 200),
            relevance: 0.9,
          })
        }
      }
    } catch {}
    return results
  }

  private async searchNpm(topic: string): Promise<DocResearchResult[]> {
    try {
      const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(topic)}&size=3`, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      return (data.objects || []).map((o: any) => ({
        topic,
        url: `https://www.npmjs.com/package/${o.package.name}`,
        summary: o.package.description || '',
        relevance: Math.min(1, o.package.score?.final || 0.5),
      }))
    } catch { return [] }
  }

  private async searchProjectDocs(topic: string): Promise<DocResearchResult[]> {
    const results: DocResearchResult[] = []
    const patterns = ['README.md', 'CONTRIBUTING.md', 'DEVELOPMENT.md', 'CHANGELOG.md']
    for (const file of patterns) {
      const path = join(process.cwd(), file)
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8')
        if (content.toLowerCase().includes(topic.toLowerCase())) {
          results.push({ topic, url: `/${file}`, summary: content.split('\n').slice(0, 5).join(' ').substring(0, 200), relevance: 0.7 })
        }
      }
    }
    return results
  }
}
