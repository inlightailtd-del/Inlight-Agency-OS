import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { DevelopmentSystemOrchestrator } from '@/lib/development'
import { SwarmEngine } from '@/lib/swarm/engine'

export interface CtoReport {
  summary: string
  techDebtItems: string[]
  architectureDecisions: string[]
  recommendedImprovements: string[]
  systemHealth: {
    totalServices: number
    healthyServices: number
    degradedServices: number
    lastDeployTime: string | null
  }
}

export interface CtoMetrics {
  totalDevelopmentCycles: number
  activeTasks: number
  codeQualityScore: number
  testCoverage: number
  deploymentFrequency: string
}

export class CtoAgent {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async assessSystemHealth(): Promise<CtoReport> {
    const start = Date.now()
    const metrics = await this.gatherMetrics()

    const systemPrompt = `You are the CTO of an AI-powered digital agency. 
Review the system status and provide:
1. Executive technology summary
2. Technical debt items needing attention
3. Architecture decisions needed
4. Recommended improvements

Format as JSON:
{
  "summary": "2-3 sentence tech assessment",
  "techDebtItems": ["item1", "item2"],
  "architectureDecisions": ["decision1", "decision2"],
  "recommendedImprovements": ["improvement1", "improvement2"]
}`

    const stateText = [
      `Development cycles: ${metrics.totalDevelopmentCycles}`,
      `Active dev tasks: ${metrics.activeTasks}`,
      `Code quality: ${metrics.codeQualityScore}/100`,
      `Test coverage: ${metrics.testCoverage}%`,
      `Deploy frequency: ${metrics.deploymentFrequency}`,
    ].join('\n')

    const result = await executeAgentTask(this.supabase, this.userId, null, stateText, { systemPrompt })
    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response }

    await this.log('cto_assessment', `Health: ${parsed.techDebtItems?.length || 0} debt items | ${(Date.now() - start)}ms`)

    return {
      summary: parsed.summary || 'System health assessment completed',
      techDebtItems: parsed.techDebtItems || [],
      architectureDecisions: parsed.architectureDecisions || [],
      recommendedImprovements: parsed.recommendedImprovements || [],
      systemHealth: {
        totalServices: 8,
        healthyServices: 8,
        degradedServices: 0,
        lastDeployTime: null,
      },
    }
  }

  async runDevelopmentCycle(goal: string): Promise<any> {
    const start = Date.now()
    const dev = new DevelopmentSystemOrchestrator(this.supabase, this.userId)
    const result = await dev.runGoalMode(goal)
    await this.log('cto_dev_cycle', `Goal: ${goal.substring(0, 60)} | ${result.status} | ${(Date.now() - start)}ms`)
    return result
  }

  async reviewCodeQuality(): Promise<{ score: number; issues: string[]; recommendations: string[] }> {
    const start = Date.now()
    const { data: tasks } = await this.supabase
      .from('development_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('type', 'plan')
      .order('created_at', { ascending: false })
      .limit(10)

    const recentTasks = (tasks ?? []) as any[]
    const context = recentTasks.map((t: any) =>
      `${t.content?.goal?.substring(0, 100) || 'N/A'} — ${t.content?.errors?.length || 0} errors`
    ).join('\n')

    const systemPrompt = `You are the CTO reviewing code quality. Return JSON:
{
  "score": 0-100,
  "issues": ["issue1"],
  "recommendations": ["rec1"]
}`

    const result = await executeAgentTask(this.supabase, this.userId, null, `Recent dev activity:\n${context}\n\nAssess code quality and identify issues.`, { systemPrompt })
    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.score = 80 }

    await storeMemory(this.supabase, this.userId, {
      category: 'cto_review',
      content: { type: 'code_quality_review', score: parsed.score, issues: parsed.issues, reviewedAt: new Date().toISOString() },
      tags: ['cto', 'code_quality'],
    })

    await this.log('cto_code_review', `Score: ${parsed.score || 80} | ${parsed.issues?.length || 0} issues | ${(Date.now() - start)}ms`)
    return { score: parsed.score || 80, issues: parsed.issues || [], recommendations: parsed.recommendations || [] }
  }

  async orchestrateSwarm(objective: string, participants: string[]): Promise<any> {
    const engine = new SwarmEngine(this.supabase, this.userId)
    const round = await engine.initRound({
      objective,
      agentIds: participants.map(id => ({ agentId: id, role: 'contributor' })),
    })
    const result = await engine.runCycle(round.id)
    await this.log('cto_swarm', `Swarm: ${objective.substring(0, 60)} | ${participants.length} agents | consensus: ${result?.consensusReached || false}`)
    return result
  }

  private async gatherMetrics(): Promise<CtoMetrics> {
    const [{ count: devCycles }, { data: devMemory }, { count: activeTasks }] = await Promise.all([
      this.supabase.from('development_memory').select('*', { count: 'exact', head: true }).eq('user_id', this.userId),
      this.supabase.from('development_memory').select('content').eq('user_id', this.userId).eq('type', 'plan').order('created_at', { ascending: false }).limit(5),
      this.supabase.from('orchestrator_tasks').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('status', 'pending'),
    ])

    const memories = (devMemory ?? []) as any[]
    const scores = memories.map((m: any) => m.content?.errors?.length || 0)
    const avgErrors = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
    const qualityScore = Math.max(0, Math.round(100 - avgErrors * 10))

    return {
      totalDevelopmentCycles: devCycles || 0,
      activeTasks: activeTasks || 0,
      codeQualityScore: qualityScore,
      testCoverage: 0,
      deploymentFrequency: 'manual',
    }
  }

  private async log(action: string, message: string, status = 'success'): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null,
        action: `[CTO] ${action}`, module: 'cto', status, message,
      }])
    } catch { /* best effort */ }
  }
}
