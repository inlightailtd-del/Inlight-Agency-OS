import { execSync } from 'child_process'

export class BrowserAutomationEngine {
  private supabase: any
  private userId: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async capture(url: string): Promise<{ title: string; text: string; links: string[]; success: boolean }> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } })
      const html = await response.text()
      const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || ''
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 2000)
      const links = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)].map(m => m[1]).slice(0, 20)
      return { title, text, links, success: true }
    } catch (e: any) {
      return { title: '', text: `Error: ${e.message}`, links: [], success: false }
    }
  }

  async searchDocs(query: string): Promise<{ url: string; title: string; snippet: string }[]> {
    // Search MDN, React, Next.js docs
    const sources = [
      { name: 'MDN', url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query)}` },
      { name: 'Next.js', url: `https://nextjs.org/search?q=${encodeURIComponent(query)}` },
    ]
    const results: { url: string; title: string; snippet: string }[] = []
    for (const src of sources) {
      const captured = await this.capture(src.url)
      if (captured.success) {
        results.push({ url: src.url, title: captured.title, snippet: captured.text.substring(0, 300) })
      }
    }
    return results
  }

  async checkPage(url: string): Promise<{ statusCode: number; loadTimeMs: number; issues: string[] }> {
    const start = Date.now()
    const issues: string[] = []
    let statusCode = 0
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      statusCode = response.status
      if (statusCode >= 400) issues.push(`HTTP ${statusCode}`)
      const text = await response.text()
      if (!text.includes('</html>')) issues.push('Incomplete HTML')
      if (text.includes('404')) issues.push('Contains 404 reference')
    } catch (e: any) {
      issues.push(e.message)
    }
    return { statusCode, loadTimeMs: Date.now() - start, issues }
  }
}
