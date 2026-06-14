import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

interface ImprovementSignal {
  type: 'pattern' | 'antipattern' | 'suggestion'
  context: string
  priority: 'low' | 'medium' | 'high'
}

export class SelfImprovementLoop {
  private supabase: any
  private userId: string
  private rootDir: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  async analyzeAndImprove(): Promise<{ signalsFound: number; improvementsMade: number; recommendations: string[] }> {
    const signals = await this.collectSignals()
    const recommendations: string[] = []

    // Analyze patterns from past cycles
    const { data: cycles } = await this.supabase
      .from('dev_cycles')
      .select('*')
      .eq('user_id', this.userId)
      .order('started_at', { ascending: false })
      .limit(20)

    const cycleErrors = ((cycles as any[]) || []).filter(c => c.status === 'failed')
    if (cycleErrors.length > 3) {
      recommendations.push(`High failure rate: ${cycleErrors.length}/${(cycles as any[])?.length || 1} cycles failed. Review process.`)
    }

    // Analyze RCA patterns
    const { data: rcas } = await this.supabase
      .from('dev_rca')
      .select('category, root_cause')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(50)

    const categoryCount: Record<string, number> = {}
    for (const r of (rcas as any[]) || []) {
      categoryCount[r.category] = (categoryCount[r.category] || 0) + 1
    }
    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]
    if (topCategory && topCategory[1] > 3) {
      recommendations.push(`Frequent ${topCategory[0]} errors (${topCategory[1]} occurrences). Consider preventative measures.`)
    }

    // Analyze ADR quality
    const { data: adrs } = await this.supabase
      .from('dev_adr')
      .select('status')
      .eq('user_id', this.userId)
    const adrCount = (adrs as any[])?.length || 0
    if (adrCount < 3) {
      recommendations.push('Low ADR count. Consider recording more architecture decisions for context.')
    }

    // Analyze git commit patterns
    const { data: commits } = await this.supabase
      .from('dev_git_commits')
      .select('message, status')
      .eq('user_id', this.userId)
      .limit(20)

    const failedCommits = ((commits as any[]) || []).filter(c => c.status === 'failed').length
    if (failedCommits > 2) {
      recommendations.push(`${failedCommits} failed commits. Check git configuration.`)
    }

    // Store improvements
    if (recommendations.length > 0) {
      await this.supabase.from('agent_memory').insert([{
        user_id: this.userId, agent_id: null,
        category: 'dev_v2_improvements',
        content: {
          timestamp: new Date().toISOString(),
          recommendations,
          signalsFound: signals.length,
          cycleFailureRate: cycleErrors.length / Math.max((cycles as any[])?.length || 1, 1),
          topErrorCategory: topCategory?.[0] || 'none',
        },
        tags: ['dev-v2', 'self-improvement', 'automated'],
      }])

      // Apply improvements (update swarm agent instructions)
      for (const rec of recommendations) {
        if (rec.includes('failure') || rec.includes('error')) {
          // Tighten debugger agent
          await this.supabase.from('dev_swarm_agents')
            .update({ temperature: 0.3, max_iterations: 5 })
            .eq('user_id', this.userId)
            .eq('role', 'debugger')
        }
        if (rec.includes('ADR')) {
          // Make architect more detailed
          await this.supabase.from('dev_swarm_agents')
            .update({ instructions: 'Design architecture, analyze requirements, produce implementation plans. Always include ADR context.' })
            .eq('user_id', this.userId)
            .eq('role', 'architect')
        }
      }
    }

    return {
      signalsFound: signals.length,
      improvementsMade: recommendations.length,
      recommendations,
    }
  }

  async getStatus(): Promise<{ totalCycles: number; failedCycles: number; totalRcas: number; topErrors: string[]; improvements: string[] }> {
    const [cycles, rcas, memory] = await Promise.all([
      this.supabase.from('dev_cycles').select('status').eq('user_id', this.userId),
      this.supabase.from('dev_rca').select('category').eq('user_id', this.userId),
      this.supabase.from('agent_memory').select('content').eq('user_id', this.userId).eq('category', 'dev_v2_improvements').order('created_at', { ascending: false }).limit(1),
    ])

    const topErrors = ((rcas.data as any[]) || []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.category] = (acc[r.category] || 0) + 1; return acc
    }, {})

    const prevImprovements = (memory.data as any[])?.[0]?.content?.recommendations || []

    return {
      totalCycles: (cycles.data as any[])?.length || 0,
      failedCycles: (cycles.data as any[])?.filter(c => c.status === 'failed').length || 0,
      totalRcas: (rcas.data as any[])?.length || 0,
      topErrors: Object.entries(topErrors).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`),
      improvements: prevImprovements,
    }
  }

  private async collectSignals(): Promise<ImprovementSignal[]> {
    const signals: ImprovementSignal[] = []

    try {
      // Check if tsconfig has strict mode
      const tsConfig = join(this.rootDir, 'tsconfig.json')
      if (existsSync(tsConfig)) {
        const config = JSON.parse(readFileSync(tsConfig, 'utf-8'))
        if (!config.compilerOptions?.strict) {
          signals.push({ type: 'suggestion', context: 'TypeScript strict mode not enabled', priority: 'medium' })
        }
      }

      // Check for test files
      const testFiles = this.glob('**/*.test.*')
      if (testFiles.length < 3) {
        signals.push({ type: 'suggestion', context: `Only ${testFiles.length} test files found`, priority: 'medium' })
      }

      // Check .env.local exists
      if (!existsSync(join(this.rootDir, '.env.local'))) {
        signals.push({ type: 'antipattern', context: 'No .env.local file', priority: 'high' })
      }
    } catch {}

    return signals
  }

  private glob(pattern: string): string[] {
    try {
      const { execSync } = require('child_process')
      const output = execSync(`dir /b /s "${this.rootDir}\\${pattern.replace(/\//g, '\\')}"`, { encoding: 'utf-8', timeout: 5000 })
      return output.trim().split('\n').filter(Boolean)
    } catch { return [] }
  }
}
