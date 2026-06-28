import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImprovementCycleResult } from './types'
import { BaseSelfImprovementModule } from './types'
import { PromptOptimizer } from './prompt-optimizer'
import { WorkflowLearner } from './workflow-learner'
import { AgentLearner } from './agent-learner'
import { SkillDownloader } from './skill-downloader'
import { BottleneckDetector } from './bottleneck-detector'
import { AutoUpgrader } from './auto-upgrader'

export class SelfImprovementEngine extends BaseSelfImprovementModule {
  prompts: PromptOptimizer
  workflows: WorkflowLearner
  agents: AgentLearner
  skills: SkillDownloader
  bottlenecks: BottleneckDetector
  upgrades: AutoUpgrader

  constructor(supabase: SupabaseClient, userId: string) {
    super(supabase, userId)
    this.prompts = new PromptOptimizer(supabase, userId)
    this.workflows = new WorkflowLearner(supabase, userId)
    this.agents = new AgentLearner(supabase, userId)
    this.skills = new SkillDownloader(supabase, userId)
    this.bottlenecks = new BottleneckDetector(supabase, userId)
    this.upgrades = new AutoUpgrader(supabase, userId)
  }

  async runFullCycle(): Promise<ImprovementCycleResult> {
    const startTime = Date.now()
    const cycleId = `improvement-${Date.now()}`
    const errors: string[] = []
    let promptsOptimized = 0
    let workflowsImproved = 0
    let agentsTrained = 0
    let skillsDownloaded = 0
    let bottlenecksFound = 0
    let upgradesApplied = 0

    await this.log('improvement_cycle_started', `Cycle ${cycleId} beginning`)

    try {
      const bottleneckList = await this.bottlenecks.detectAll()
      bottlenecksFound = bottleneckList.length
    } catch (e: any) { errors.push(`Bottlenecks: ${e.message}`) }

    try {
      const patterns = await this.workflows.analyzeWorkflows()
      workflowsImproved = patterns.length
    } catch (e: any) { errors.push(`Workflows: ${e.message}`) }

    try {
      const agentKnowledge = await this.agents.analyzeAllAgents()
      agentsTrained = agentKnowledge.length
    } catch (e: any) { errors.push(`Agents: ${e.message}`) }

    try {
      const downloaded = await this.skills.autoDownloadSkills(3)
      skillsDownloaded = downloaded.filter((d) => d.status === 'completed').length
    } catch (e: any) { errors.push(`Skills: ${e.message}`) }

    try {
      const bList = await this.bottlenecks.getOpenBottlenecks()
      const wPatterns = await this.workflows.getOptimizationIdeas()
      const upgradeList = await this.upgrades.generateUpgrades(bList, wPatterns.map((w) => ({
        id: '', workflowType: w.workflowType, pattern: w.idea, frequency: 0,
        avgDurationMs: 0, successRate: 0, optimization: w.idea, impact: w.impact as any,
        applied: false, detectedAt: new Date().toISOString(),
      })))

      for (const upgrade of upgradeList.slice(0, 3)) {
        const result = await this.upgrades.applyUpgrade(upgrade.id)
        if (result?.status === 'applied') upgradesApplied++
      }
    } catch (e: any) { errors.push(`Upgrades: ${e.message}`) }

    try {
      const activePrompts = await this.prompts.getActivePrompts()
      for (const prompt of activePrompts) {
        const promoted = await this.prompts.autoPromote(prompt.name)
        if (promoted) promptsOptimized++
      }
    } catch (e: any) { errors.push(`Prompts: ${e.message}`) }

    const score = Math.round(Math.max(0, 70
      - errors.length * 5
      + Math.min(bottlenecksFound * 3, 20)
      + Math.min(upgradesApplied * 5, 15)
      + Math.min(promptsOptimized * 5, 10)
    ))

    const summary = [
      `Bottlenecks: ${bottlenecksFound}`,
      `Workflows: ${workflowsImproved}`,
      `Agents analyzed: ${agentsTrained}`,
      `Skills downloaded: ${skillsDownloaded}`,
      `Upgrades applied: ${upgradesApplied}`,
      `Prompts optimized: ${promptsOptimized}`,
      `Score: ${score}`,
      errors.length > 0 ? `Errors: ${errors.join('; ')}` : '',
    ].filter(Boolean).join(' | ')

    await this.storeBrain('improvement_cycle', {
      cycleId, bottlenecksFound, workflowsImproved, agentsTrained,
      skillsDownloaded, upgradesApplied, promptsOptimized, score,
      errors, durationMs: Date.now() - startTime, summary,
    }, ['improvement_cycle', `score-${score}`])

    await this.log('improvement_cycle_completed', summary, errors.length > 0 ? 'failed' : 'success')

    return {
      cycleId,
      promptsOptimized,
      workflowsImproved,
      agentsTrained,
      skillsDownloaded,
      bottlenecksFound,
      upgradesApplied,
      score,
      errors,
      summary,
      durationMs: Date.now() - startTime,
    }
  }
}
