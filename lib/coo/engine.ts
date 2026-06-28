import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { runDailyGrowthExecution, type DailyExecutionResult } from '@/lib/execution'
import { runCeoAssessment } from '@/lib/ceo/ceo'

export interface CooReport {
  summary: string
  dailyOpsStatus: string
  bottlenecks: string[]
  resourceAllocations: string[]
  processImprovements: string[]
  metrics: CooMetrics
}

export interface CooMetrics {
  totalTasksCompleted: number
  pendingTasks: number
  failedTasks: number
  activeAgents: number
  queueDepth: number
  avgTaskCompletionTime: number
  uptimeHours: number
}

export class CooAgent {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async assessOperations(): Promise<CooReport> {
    const start = Date.now()
    const metrics = await this.gatherMetrics()

    const systemPrompt = `You are the COO of an AI-powered digital agency.
Review the operational status and provide:
1. Executive operations summary
2. Daily operations status
3. Bottlenecks identified
4. Resource allocation recommendations
5. Process improvements

Format as JSON:
{
  "summary": "2-3 sentence ops assessment",
  "dailyOpsStatus": "status of daily operations",
  "bottlenecks": ["bottleneck1"],
  "resourceAllocations": ["allocation1"],
  "processImprovements": ["improvement1"]
}`

    const stateText = [
      `Tasks completed: ${metrics.totalTasksCompleted}`,
      `Pending: ${metrics.pendingTasks}`,
      `Failed: ${metrics.failedTasks}`,
      `Active agents: ${metrics.activeAgents}`,
      `Queue depth: ${metrics.queueDepth}`,
      `Avg completion: ${metrics.avgTaskCompletionTime}min`,
      `Uptime: ${metrics.uptimeHours}h`,
    ].join('\n')

    const result = await executeAgentTask(this.supabase, this.userId, null, stateText, { systemPrompt })
    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response }

    await storeMemory(this.supabase, this.userId, {
      category: 'coo_assessment',
      content: { type: 'operations_report', metrics, bottlenecks: parsed.bottlenecks, assessedAt: new Date().toISOString() },
      tags: ['coo', 'operations', 'assessment'],
    })

    await this.log('coo_assessment', `Bottlenecks: ${parsed.bottlenecks?.length || 0} | ${(Date.now() - start)}ms`)
    return {
      summary: parsed.summary || 'Operations assessment completed',
      dailyOpsStatus: parsed.dailyOpsStatus || '',
      bottlenecks: parsed.bottlenecks || [],
      resourceAllocations: parsed.resourceAllocations || [],
      processImprovements: parsed.processImprovements || [],
      metrics,
    }
  }

  async runDailyExecution(): Promise<DailyExecutionResult> {
    const start = Date.now()
    const result = await runDailyGrowthExecution(this.supabase, this.userId)
    await this.log('coo_daily_execution', `Content: ${result.contentGenerated} | Published: ${result.linkedinPublished + result.facebookPublished + result.instagramPublished + result.xPublished + result.youtubePublished} | Leads: ${result.leadsGenerated} | ${(Date.now() - start)}ms`)
    return result
  }

  async runCeoCycle(): Promise<any> {
    const start = Date.now()
    const result = await runCeoAssessment(this.supabase, this.userId)
    await this.log('coo_ceo_cycle', `${result.insights.length} insights, ${result.decisions.length} decisions | ${(Date.now() - start)}ms`)
    return result
  }

  async allocateResources(taskDescription: string, priority: string): Promise<{ assignedTo: string; estimatedCompletion: string; reasoning: string }> {
    const systemPrompt = `You are the COO allocating resources. Return JSON:
{
  "assignedTo": "agent type or department",
  "estimatedCompletion": "estimated time",
  "reasoning": "why this allocation"
}`

    const context = await this.gatherMetrics()
    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Task: ${taskDescription} | Priority: ${priority} | Queue depth: ${context.queueDepth} | Active agents: ${context.activeAgents} | Pending tasks: ${context.pendingTasks}`,
      { systemPrompt }
    )
    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.assignedTo = 'operations' }

    await this.log('coo_resource_allocation', `Task: ${taskDescription.substring(0, 60)} → ${parsed.assignedTo}`)
    return {
      assignedTo: parsed.assignedTo || 'operations',
      estimatedCompletion: parsed.estimatedCompletion || '1 hour',
      reasoning: parsed.reasoning || 'Based on current workload',
    }
  }

  async runFullOpsCycle(): Promise<{
    operations: CooReport
    dailyExecution: DailyExecutionResult | null
    ceoAssessment: any | null
    errors: string[]
  }> {
    const errors: string[] = []
    const operations = await this.assessOperations()
    let dailyExecution: DailyExecutionResult | null = null
    let ceoAssessment: any | null = null

    try { dailyExecution = await this.runDailyExecution() }
    catch (e: any) { errors.push(`Daily execution: ${e.message}`) }

    try { ceoAssessment = await this.runCeoCycle() }
    catch (e: any) { errors.push(`CEO cycle: ${e.message}`) }

    return { operations, dailyExecution, ceoAssessment, errors }
  }

  private async gatherMetrics(): Promise<CooMetrics> {
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const [tasksResult, { count: pendingTasks }, { count: failedTasks }, { data: agents }, { data: jobs }, execLogs] = await Promise.all([
      this.supabase.from('orchestrator_tasks').select('id').eq('user_id', this.userId).gte('created_at', today.toISOString()),
      this.supabase.from('orchestrator_tasks').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('status', 'pending'),
      this.supabase.from('orchestrator_tasks').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('status', 'failed'),
      this.supabase.from('agents').select('id, status').eq('user_id', this.userId),
      this.supabase.from('execution_logs').select('id').eq('user_id', this.userId).eq('module', 'queue').gte('created_at', today.toISOString()),
      this.supabase.from('execution_logs').select('duration_ms').eq('user_id', this.userId).eq('module', 'development').limit(20).order('created_at', { ascending: false }),
    ])

    const logs = (execLogs.data ?? []) as any[]
    const avgTime = logs.length
      ? Math.round(logs.reduce((s: number, l: any) => s + (l.duration_ms || 0), 0) / logs.length / 60000)
      : 0

    const allTasks = (tasksResult.data ?? []) as any[]

    return {
      totalTasksCompleted: allTasks.length,
      pendingTasks: pendingTasks || 0,
      failedTasks: failedTasks || 0,
      activeAgents: ((agents ?? []) as any[]).filter((a: any) => a.status === 'active').length,
      queueDepth: (jobs ?? []).length,
      avgTaskCompletionTime: avgTime,
      uptimeHours: 24,
    }
  }

  private async log(action: string, message: string, status = 'success'): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null,
        action: `[COO] ${action}`, module: 'coo', status, message,
      }])
    } catch { /* best effort */ }
  }
}
