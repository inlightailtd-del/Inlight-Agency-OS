import { BaseGrowthModule, type CompetitorTarget, type CompetitorSnapshot, type CompetitorDiff, type CompetitorProfile } from './types'

const DEFAULT_PAGES = ['/', '/pricing', '/features', '/about']

export class CompetitorScraper extends BaseGrowthModule {
  async addTarget(params: {
    name: string
    website: string
    pages?: string[]
    industry?: string
    notes?: string
  }): Promise<CompetitorTarget> {
    const { data, error } = await this.supabase.from('growth_competitor_targets').insert([{
      user_id: this.userId,
      name: params.name,
      website: params.website.replace(/\/$/, ''),
      pages: params.pages ?? DEFAULT_PAGES,
      industry: params.industry ?? null,
      notes: params.notes ?? null,
    }]).select('*').single()

    if (error) throw new Error(`Failed to add target: ${error.message}`)
    await this.log('competitor_target_added', `Added ${params.name} (${params.website})`)
    return data as CompetitorTarget
  }

  async scrapeTarget(targetId: string): Promise<CompetitorSnapshot[]> {
    const { data: target } = await this.supabase
      .from('growth_competitor_targets')
      .select('*')
      .eq('id', targetId)
      .eq('user_id', this.userId)
      .single()
    if (!target) throw new Error(`Target ${targetId} not found`)
    const t = target as CompetitorTarget

    const snapshots: CompetitorSnapshot[] = []
    for (const page of t.pages) {
      const url = `${t.website}${page}`
      try {
        const snap = await this.scrapePage(t.id, url)
        snapshots.push(snap)
      } catch {
        await this.log('scrape_failed', `Failed to scrape ${url}`, 'failed')
      }
    }

    await this.detectChanges(t.id, snapshots)
    await this.log('competitor_scraped', `Scraped ${t.name}: ${snapshots.length}/${t.pages.length} pages`)
    return snapshots
  }

  async scrapeAll(): Promise<{ targetId: string; name: string; pagesScraped: number }[]> {
    const { data: targets } = await this.supabase
      .from('growth_competitor_targets')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_active', true)

    const results: { targetId: string; name: string; pagesScraped: number }[] = []
    for (const target of (targets ?? []) as CompetitorTarget[]) {
      const snaps = await this.scrapeTarget(target.id)
      results.push({ targetId: target.id, name: target.name, pagesScraped: snaps.length })
    }
    return results
  }

  async getProfile(targetId: string): Promise<CompetitorProfile> {
    const { data: target } = await this.supabase
      .from('growth_competitor_targets')
      .select('*')
      .eq('id', targetId)
      .single()

    const { data: latest } = await this.supabase
      .from('growth_competitor_snapshots')
      .select('*')
      .eq('target_id', targetId)
      .order('detected_at', { ascending: false })
      .limit(1)

    const { data: diffs } = await this.supabase
      .from('growth_competitor_diffs')
      .select('*')
      .eq('target_id', targetId)
      .order('detected_at', { ascending: false })
      .limit(10)

    const snapshotList = (latest ?? []) as CompetitorSnapshot[]
    return {
      target: target as CompetitorTarget,
      latestSnapshot: snapshotList[0] ?? null,
      diffs: (diffs ?? []) as CompetitorDiff[],
      score: this.calculateScore(target as CompetitorTarget),
      lastScraped: snapshotList[0]?.detected_at ?? null,
    }
  }

  private async scrapePage(targetId: string, url: string): Promise<CompetitorSnapshot> {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
    const html = await r.text()

    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? null
    const desc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)?.[1] ?? null
    const h1s = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi))
      .map((m) => m[1].replace(/<[^>]*>/g, '').trim())
      .filter(Boolean)
      .slice(0, 10)

    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const pricingMentions = this.extractPricing(text)
    const featureMentions = this.extractFeatures(text)

    const ctaMatch = text.match(/(?:get started|sign up|buy now|start free|book a demo|contact sales|try free|subscribe)/i)

    const { data, error } = await this.supabase.from('growth_competitor_snapshots').insert([{
      target_id: targetId,
      user_id: this.userId,
      page_url: url,
      title,
      description: desc?.substring(0, 500) ?? null,
      headings: JSON.stringify(h1s),
      pricing_mentions: JSON.stringify(pricingMentions),
      feature_mentions: JSON.stringify(featureMentions),
      cta_text: ctaMatch?.[0] ?? null,
      raw_text_sample: text.substring(0, 1000),
    }]).select('*').single()

    if (error) throw new Error(`Failed to save snapshot: ${error.message}`)
    return data as CompetitorSnapshot
  }

  private extractPricing(text: string): { text: string; context: string }[] {
    const mentions: { text: string; context: string }[] = []
    const patterns = [
      /\$\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:\/mo|\/month|\/year|\/yr|per month|one-time|annually)/gi,
      /(?:starts? at|from|starting at|only)\s+\$\d+(?:,\d{3})*(?:\.\d{2})?/gi,
      /(?:free|basic|pro|enterprise|premium|starter|growth)\s*(?:plan|tier)?\s*\$\d+/gi,
    ]
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const idx = match.index ?? 0
        const before = text.substring(Math.max(0, idx - 60), idx)
        const after = text.substring(idx + match[0].length, idx + match[0].length + 60)
        mentions.push({
          text: match[0],
          context: `${before}${match[0]}${after}`.trim(),
        })
      }
    }
    return mentions.slice(0, 10)
  }

  private extractFeatures(text: string): { text: string; category: string }[] {
    const features: { text: string; category: string }[] = []
    const patterns = [
      { regex: /(?:feature|capabili|integrat|automation|workflow|pipeline)/gi, category: 'capability' },
      { regex: /(?:api|sdk|webhook|cli|plugin|extension)/gi, category: 'technical' },
      { regex: /(?:analytics|report|dashboard|insight|metric|kpi)/gi, category: 'analytics' },
      { regex: /(?:support|onboarding|training|documentation|community)/gi, category: 'support' },
      { regex: /(?:security|compliance|sso|encryption|audit|role|permission)/gi, category: 'security' },
    ]
    const seen = new Set<string>()
    for (const { regex, category } of patterns) {
      for (const match of text.matchAll(regex)) {
        const start = Math.max(0, (match.index ?? 0) - 40)
        const end = (match.index ?? 0) + match[0].length + 40
        const snippet = text.substring(start, end).trim()
        if (!seen.has(snippet)) {
          seen.add(snippet)
          features.push({ text: snippet, category })
        }
      }
    }
    return features.slice(0, 15)
  }

  private async detectChanges(targetId: string, currentSnapshots: CompetitorSnapshot[]): Promise<void> {
    const { data: previous } = await this.supabase
      .from('growth_competitor_snapshots')
      .select('*')
      .eq('target_id', targetId)
      .order('detected_at', { ascending: false })
      .limit(currentSnapshots.length)

    const prevMap = new Map<string, CompetitorSnapshot>()
    for (const snap of (previous ?? []) as CompetitorSnapshot[]) {
      if (!prevMap.has(snap.page_url)) prevMap.set(snap.page_url, snap)
    }

    for (const current of currentSnapshots) {
      const prev = prevMap.get(current.page_url)
      if (!prev) continue

      const changes: { field: string; from: string; to: string; significance: string }[] = []
      if (prev.title !== current.title) changes.push({ field: 'title', from: prev.title ?? '', to: current.title ?? '', significance: 'high' })
      if (prev.description !== current.description) changes.push({ field: 'description', from: prev.description ?? '', to: current.description ?? '', significance: 'medium' })
      if (prev.pricing_mentions !== current.pricing_mentions) changes.push({ field: 'pricing', from: JSON.stringify(prev.pricing_mentions), to: JSON.stringify(current.pricing_mentions), significance: 'high' })

      if (changes.length > 0) {
        const significance = changes.some((c) => c.significance === 'high') ? 'high' : 'medium'
        await this.supabase.from('growth_competitor_diffs').insert([{
          target_id: targetId,
          user_id: this.userId,
          previous_snapshot_id: prev.id,
          current_snapshot_id: current.id,
          changes: JSON.stringify(changes),
          significance,
        }])
        await this.log('competitor_change_detected', `${current.page_url}: ${changes.length} changes (${significance})`)
      }
    }
  }

  private calculateScore(target: CompetitorTarget): number {
    const hasPages = Math.min(target.pages.length / DEFAULT_PAGES.length, 1) * 30
    const hasIndustry = target.industry ? 20 : 0
    const hasNotes = target.notes ? 10 : 0
    return Math.round(hasPages + hasIndustry + hasNotes + 40)
  }
}
