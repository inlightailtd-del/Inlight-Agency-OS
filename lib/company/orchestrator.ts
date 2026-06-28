import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { runCeoAssessment } from '@/lib/ceo/ceo'
import { CtoAgent } from '@/lib/cto/engine'
import { CmoAgent } from '@/lib/cmo/engine'
import { CooAgent } from '@/lib/coo/engine'
import { runFullSalesCycle } from '@/lib/sales/engine'
import { runFullMediaBuyingCycle } from '@/lib/media-buying/engine'
import { DesignerAgent } from '@/lib/designer/engine'
import { VideoEditorAgent } from '@/lib/video-editor/engine'
import { SupportAgent } from '@/lib/support/engine'
import { DevelopmentSystemOrchestrator } from '@/lib/development'
import {
  type CompanyState, type CompanyCycleResult, type CompanyPhaseResult,
  type CompanyReport, type ApprovalItem, type CompanyAgentRole,
} from './types'

const ALL_ROLES: CompanyAgentRole[] = [
  'ceo', 'cto', 'cmo', 'coo', 'sales',
  'developer', 'media_buyer', 'designer', 'video_editor', 'support',
]

export class AutonomousCompany {
  private state: CompanyState
  private cto: CtoAgent
  private cmo: CmoAgent
  private coo: CooAgent
  private designer: DesignerAgent
  private videoEditor: VideoEditorAgent
  private support: SupportAgent
  private onApproval: ((items: ApprovalItem[]) => Promise<void>) | null = null

  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {
    this.state = {
      id: `company-${Date.now()}`,
      status: 'initialized',
      startedAt: null,
      currentCycle: 0,
      totalCycles: 0,
      lastRunAt: null,
      lastApprovalCheckAt: null,
      errors: [],
      approvedActions: 0,
      pendingApprovals: 0,
    }
    this.cto = new CtoAgent(supabase, userId)
    this.cmo = new CmoAgent(supabase, userId)
    this.coo = new CooAgent(supabase, userId)
    this.designer = new DesignerAgent(supabase, userId)
    this.videoEditor = new VideoEditorAgent(supabase, userId)
    this.support = new SupportAgent(supabase, userId)
  }

  getState(): CompanyState { return this.state }

  onPendingApproval(handler: (items: ApprovalItem[]) => Promise<void>): void {
    this.onApproval = handler
  }

  async start(): Promise<CompanyState> {
    this.state.status = 'running'
    this.state.startedAt = new Date().toISOString()
    await this.log('company_started', 'Autonomous company orchestrator started')
    return this.state
  }

  async stop(): Promise<CompanyState> {
    this.state.status = 'stopped'
    await this.log('company_stopped', `Stopped after ${this.state.totalCycles} cycles`)
    return this.state
  }

  async runFullCycle(): Promise<CompanyCycleResult> {
    const cycleId = `cycle-${Date.now()}`
    const startedAt = new Date().toISOString()
    const errors: string[] = []
    const phases: CompanyPhaseResult[] = []
    const pendingApprovals: ApprovalItem[] = []

    this.state.currentCycle++
    this.state.totalCycles++

    // ─── Phase 1: COO — Daily Operations ─────────────────────
    phases.push(await this.runPhase('coo', 'daily_operations', async () => {
      return await this.coo.runDailyExecution()
    }, errors))

    // ─── Phase 2: CMO — Content & Growth ─────────────────────
    phases.push(await this.runPhase('cmo', 'content_growth', async () => {
      return await this.cmo.runContentCycle()
    }, errors))

    // ─── Phase 3: Sales — Pipeline Management ────────────────
    phases.push(await this.runPhase('sales', 'sales_pipeline', async () => {
      return await this.runSalesCycle()
    }, errors))

    // ─── Phase 4: Media Buyer — Ad Campaigns ─────────────────
    phases.push(await this.runPhase('media_buyer', 'ad_campaigns', async () => {
      return await this.runMediaBuyerCycle()
    }, errors))

    // ─── Phase 5: Designer — Visual Assets ───────────────────
    phases.push(await this.runPhase('designer', 'design_assessment', async () => {
      return await this.designer.assessDesignNeeds()
    }, errors))

    // ─── Phase 6: Video Editor — Video Production ────────────
    phases.push(await this.runPhase('video_editor', 'video_production', async () => {
      return await this.videoEditor.assessVideoPipeline()
    }, errors))

    // ─── Phase 7: Support — Ticket Processing ────────────────
    phases.push(await this.runPhase('support', 'support_cycle', async () => {
      return await this.support.runSupportCycle()
    }, errors))

    // ─── Phase 8: Developer — Code Improvements ──────────────
    phases.push(await this.runPhase('developer', 'development', async () => {
      return await this.runDeveloperCycle()
    }, errors))

    // ─── Phase 9: CTO — Technology Assessment ────────────────
    phases.push(await this.runPhase('cto', 'tech_assessment', async () => {
      return await this.cto.assessSystemHealth()
    }, errors))

    // ─── Phase 10: CEO — Strategic Assessment (with approvals) ──
    phases.push(await this.runPhase('ceo', 'strategic_assessment', async () => {
      return await this.runCeoPhase(pendingApprovals)
    }, errors))

    // Process any pending approvals
    if (pendingApprovals.length > 0) {
      this.state.pendingApprovals = pendingApprovals.length
      if (this.onApproval) {
        await this.onApproval(pendingApprovals)
      }
      await this.storePendingApprovals(pendingApprovals)
    }

    const completedAt = new Date().toISOString()
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()

    // Generate executive summary
    const summary = phases.map(p =>
      `[${p.agent}] ${p.phase}: ${p.status}${p.summary ? ` — ${p.summary}` : ''}`
    ).join('\n')

    // Store cycle memory
    await storeMemory(this.supabase, this.userId, {
      category: 'company_cycle',
      content: { type: 'autonomous_cycle', cycleId, phases: phases.map(p => ({ agent: p.agent, phase: p.phase, status: p.status })), errors: errors.slice(0, 20), durationMs, completedAt },
      tags: ['company', 'cycle', `cycle_${this.state.totalCycles}`],
    })

    await this.log('company_cycle', `Cycle ${this.state.totalCycles}: ${phases.filter(p => p.status === 'completed').length}/${phases.length} phases | ${(durationMs / 1000).toFixed(1)}s`)

    return {
      cycleId, startedAt, completedAt, durationMs, phases,
      summary, errors, pendingApprovals,
    }
  }

  async generateReport(): Promise<CompanyReport> {
    const today = new Date().toISOString().split('T')[0]
    const start = Date.now()

    const [ceoResult, ctoReport, cmoReport, cooReport, supportReport,
      designerReport, videoReport] = await Promise.all([
      this.safeRun(() => runCeoAssessment(this.supabase, this.userId)),
      this.safeRun(() => this.cto.assessSystemHealth()),
      this.safeRun(() => this.cmo.assessMarketingPerformance()),
      this.safeRun(() => this.coo.assessOperations()),
      this.safeRun(() => this.support.assessSupportPerformance()),
      this.safeRun(() => this.designer.assessDesignNeeds()),
      this.safeRun(() => this.videoEditor.assessVideoPipeline()),
    ])

    const topIssues: string[] = []
    if (cooReport?.bottlenecks) topIssues.push(...cooReport.bottlenecks.slice(0, 3))
    if (ctoReport?.techDebtItems) topIssues.push(...ctoReport.techDebtItems.slice(0, 3))
    if (cmoReport?.campaignInsights) topIssues.push(...cmoReport.campaignInsights.slice(0, 3))
    if (supportReport?.commonIssues) topIssues.push(...supportReport.commonIssues.slice(0, 3))

    const report: CompanyReport = {
      reportDate: today,
      period: 'daily',
      totalCycles: this.state.totalCycles,
      completedPhases: 0,
      failedPhases: 0,
      pendingApprovals: this.state.pendingApprovals,
      approvedActions: this.state.approvedActions,
      ceoSummary: ceoResult?.summary || '',
      ctoSummary: ctoReport?.summary || '',
      cmoSummary: cmoReport?.summary || '',
      cooSummary: cooReport?.summary || '',
      salesSummary: '',
      devSummary: '',
      mediaBuyerSummary: '',
      designerSummary: designerReport?.summary || '',
      videoEditorSummary: videoReport?.summary || '',
      supportSummary: supportReport?.summary || '',
      topIssues: [...new Set(topIssues)].slice(0, 10),
      recommendedActions: [
        ...(ceoResult?.decisions || []).slice(0, 3).map((d: any) => d.description),
      ],
      generatedAt: new Date().toISOString(),
    }

    await storeMemory(this.supabase, this.userId, {
      category: 'company_report',
      content: { type: 'daily_company_report', report, generatedAt: report.generatedAt },
      tags: ['company', 'report', today],
    })

    await this.log('company_report', `Report generated | ${(Date.now() - start)}ms`)
    return report
  }

  async runRole(role: CompanyAgentRole, action: string, params?: any): Promise<any> {
    switch (role) {
      case 'ceo': return runCeoAssessment(this.supabase, this.userId)
      case 'cto': return this.cto.assessSystemHealth()
      case 'cmo': return this.cmo.assessMarketingPerformance()
      case 'coo': return this.coo.assessOperations()
      case 'sales': return this.runSalesCycle()
      case 'developer': return this.runDeveloperCycle()
      case 'media_buyer': return this.runMediaBuyerCycle()
      case 'designer': return this.designer.assessDesignNeeds()
      case 'video_editor': return this.videoEditor.assessVideoPipeline()
      case 'support': return this.support.assessSupportPerformance()
      default: throw new Error(`Unknown role: ${role}`)
    }
  }

  private async runPhase(
    agent: CompanyAgentRole, phase: string,
    fn: () => Promise<any>, errors: string[]
  ): Promise<CompanyPhaseResult> {
    const start = Date.now()
    try {
      const result = await fn()
      const durationMs = Date.now() - start
      return {
        phase, agent, status: 'completed', durationMs,
        summary: (result as any)?.summary || '',
      }
    } catch (e: any) {
      const durationMs = Date.now() - start
      errors.push(`${agent}/${phase}: ${e.message}`)
      return {
        phase, agent, status: 'failed', durationMs,
        summary: '', error: e.message,
      }
    }
  }

  private async runSalesCycle(): Promise<any> {
    return await runFullSalesCycle(this.supabase, this.userId)
  }

  private async runMediaBuyerCycle(): Promise<any> {
    return await runFullMediaBuyingCycle(this.supabase, this.userId)
  }

  private async runDeveloperCycle(): Promise<any> {
    const { data: goals } = await this.supabase
      .from('night_shift_goals')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'queued')
      .order('priority', { ascending: true })
      .limit(3)

    const items = (goals ?? []) as any[]
    if (items.length === 0) return { summary: 'No queued development goals' }

    const dev = new DevelopmentSystemOrchestrator(this.supabase, this.userId)
    let completed = 0
    for (const goal of items.slice(0, 1)) {
      try {
        await dev.runGoalMode(goal.objective)
        await this.supabase.from('night_shift_goals').update({ status: 'completed' }).eq('id', goal.id)
        completed++
      } catch (e: any) {
        await this.supabase.from('night_shift_goals').update({ status: 'failed', error_message: e.message }).eq('id', goal.id)
      }
    }
    return { summary: `${completed} goals completed` }
  }

  private async runCeoPhase(pendingApprovals: ApprovalItem[]): Promise<any> {
    const result = await runCeoAssessment(this.supabase, this.userId)
    for (const decision of result.decisions) {
      if (!decision.executed) {
        pendingApprovals.push({
          id: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agent: 'ceo',
          action: decision.type,
          description: decision.description,
          impact: decision.priority === 'high' || decision.priority === 'critical' ? 'high' : 'medium',
          createdAt: new Date().toISOString(),
        })
      }
    }
    return result
  }

  private async storePendingApprovals(items: ApprovalItem[]): Promise<void> {
    for (const item of items) {
      await this.supabase.from('company_approvals').insert([{
        user_id: this.userId, agent: item.agent, action: item.action,
        description: item.description, impact: item.impact, status: 'pending',
      }])
    }
  }

  private async safeRun<T>(fn: () => Promise<T>): Promise<T | null> {
    try { return await fn() } catch { return null }
  }

  private async log(action: string, message: string, status = 'success'): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null,
        action: `[Company] ${action}`, module: 'company', status, message,
      }])
    } catch { /* best effort */ }
  }
}
