import type { SupabaseClient } from '@supabase/supabase-js'
import { ArchitectAgent } from './architect'
import { PlannerAgent } from './planner'
import { BuilderAgent } from './builder'
import { ValidatorAgent } from './validator'
import { RefactorAgent } from './refactor'
import { LearnerEngine } from './learner'
import { RepoIntelligenceEngine } from './repo-intelligence'
import { ResearchEngine } from './research-engine'
import { ExecutionEngine } from './execution-engine'
import { DebugEngine } from './debug-engine'
import { ProductBuilder } from './product-builder'
import { WebsiteBuilder } from './website-builder'
import { SelfImprovementEngine } from './self-improvement'
import { type PlannerTask, type BuildResult, type ValidationResult, type DevelopmentCycleResult } from './types'

type Mode = 'architect' | 'plan' | 'build' | 'validate' | 'refactor' | 'learn' | 'repo-scan' | 'research' | 'execute' | 'debug' | 'product' | 'website' | 'improve' | 'goal'

export class DevelopmentSystemOrchestrator {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async runGoalMode(goal: string): Promise<DevelopmentCycleResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const cycleId = `goal-${Date.now()}`

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[DevSystem] Goal mode started',
      module: 'development', status: 'running',
      message: `Goal: ${goal}`,
    }])

    // Determine if it's a product or website build
    const lower = goal.toLowerCase()
    const isWebsite = lower.includes('website') || lower.includes('site') || lower.includes('landing page')
    const isProduct = lower.includes('build') || lower.includes('create') || lower.includes('saas') || lower.includes('app')

    let modeResult: Partial<DevelopmentCycleResult> = {}
    let plan = null
    let tasks: PlannerTask[] = []
    let builds: BuildResult[] = []
    let validations: ValidationResult[] = []

    // Step 1: Repository Intelligence
    try {
      const repoIntel = new RepoIntelligenceEngine(this.supabase, this.userId)
      const arch = await repoIntel.scan()
      modeResult = { ...modeResult, summary: `Repo scanned: ${arch.totalFiles} files` }
    } catch (e: any) { errors.push(`Repo scan: ${e.message}`) }

    // Step 2: Research
    try {
      const research = new ResearchEngine(this.supabase, this.userId)
      await research.research(goal)
    } catch (e: any) { errors.push(`Research: ${e.message}`) }

    // Step 3: Product or Website Builder
    if (isWebsite) {
      try {
        const wb = new WebsiteBuilder(this.supabase, this.userId)
        const result = await wb.build(goal)
        modeResult = { ...modeResult, filesCreated: result.filesCreated, spec: result.spec as any }
      } catch (e: any) { errors.push(`Website builder: ${e.message}`) }
    } else if (isProduct) {
      try {
        const pb = new ProductBuilder(this.supabase, this.userId)
        const result = await pb.build(goal)
        modeResult = { ...modeResult, filesCreated: result.filesCreated, spec: result.spec as any }
      } catch (e: any) { errors.push(`Product builder: ${e.message}`) }
    }

    // Step 4: Architecture + Plan
    try {
      const architect = new ArchitectAgent(this.supabase, this.userId)
      plan = await architect.createPlan(goal)
      const planner = new PlannerAgent(this.supabase, this.userId)
      tasks = await planner.createTasks(plan)
    } catch (e: any) { errors.push(`Planning: ${e.message}`) }

    // Step 5: Debug (attempt build, fix if fails)
    try {
      const debug = new DebugEngine(this.supabase, this.userId)
      const debugResult = await debug.debug(3)
      if (!debugResult.success) errors.push('Debug: build not passing after 3 attempts')
    } catch (e: any) { errors.push(`Debug: ${e.message}`) }

    // Step 6: Self-Improvement
    let lessonsLearned = 0
    try {
      const improve = new SelfImprovementEngine(this.supabase, this.userId)
      const report = await improve.analyze()
      lessonsLearned = report.storedLessons
    } catch (e: any) { errors.push(`Improvement: ${e.message}`) }

    const durationMs = Date.now() - startTime

    await this.supabase.from('development_memory').insert([{
      user_id: this.userId,
      type: 'plan',
      name: `Goal Mode: ${goal.substring(0, 60)}`,
      description: `Completed in ${(durationMs / 1000).toFixed(1)}s, ${errors.length} errors`,
      content: { cycleId, goal, mode: isWebsite ? 'website' : isProduct ? 'product' : 'general', durationMs, errors: errors.slice(0, 10), completedAt: new Date().toISOString() },
      tags: ['development', 'goal-mode', isWebsite ? 'website' : isProduct ? 'product' : 'general'],
      status: 'active',
    }])

    const summary = [
      `Mode: ${isWebsite ? 'Website' : isProduct ? 'Product' : 'General'}`,
      `Plan: ${plan?.title || 'N/A'}`,
      `Files: ${(modeResult as any).filesCreated || 0} created`,
      `Lessons: ${lessonsLearned}`,
      `Errors: ${errors.length}`,
      `Duration: ${(durationMs / 1000).toFixed(1)}s`,
    ].join(' | ')

    return {
      cycleId, goal, plan, tasks, builds, validations,
      refactors: [], lessonsLearned,
      status: errors.length > 0 ? 'completed_with_errors' : 'completed',
      errors, summary,
    }
  }

  async runFullCycle(goal: string, projectContext?: string): Promise<DevelopmentCycleResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const cycleId = `dev-cycle-${Date.now()}`

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[DevSystem] Cycle started',
      module: 'development', status: 'running',
      message: `Goal: ${goal}`,
    }])

    // Phase 0: Repo Intelligence
    try {
      const repoIntel = new RepoIntelligenceEngine(this.supabase, this.userId)
      await repoIntel.scan()
    } catch (e: any) { errors.push(`Repo scan: ${e.message}`) }

    // Phase 0.5: Research if needed
    if (goal.toLowerCase().includes('research') || goal.toLowerCase().includes('evaluate') || goal.toLowerCase().includes('compare')) {
      try {
        const research = new ResearchEngine(this.supabase, this.userId)
        await research.research(goal)
      } catch (e: any) { errors.push(`Research: ${e.message}`) }
    }

    // Phase 1: Architect
    let plan = null
    try {
      const architect = new ArchitectAgent(this.supabase, this.userId)
      plan = await architect.createPlan(goal, projectContext)
    } catch (e: any) { errors.push(`Architect: ${e.message}`) }

    // Phase 2: Planner
    let tasks: PlannerTask[] = []
    if (plan) {
      try {
        const planner = new PlannerAgent(this.supabase, this.userId)
        tasks = await planner.createTasks(plan)
      } catch (e: any) { errors.push(`Planner: ${e.message}`) }
    }

    // Phase 3: Build
    const builds: BuildResult[] = []
    if (tasks.length > 0) {
      const builder = new BuilderAgent(this.supabase, this.userId)
      for (const task of tasks) {
        try {
          task.status = 'in_progress'
          const result = await builder.executeTask(task, projectContext || '')
          task.status = 'completed'
          builds.push(result)
        } catch (e: any) {
          task.status = 'failed'
          builds.push({ taskId: task.id, taskTitle: task.title, agentType: task.agentType, success: false, output: '', filesChanged: [], durationMs: 0, error: e.message })
          errors.push(`Build ${task.title}: ${e.message}`)
        }
      }
    }

    // Phase 4: Validate
    const validations: ValidationResult[] = []
    if (builds.length > 0) {
      const validator = new ValidatorAgent(this.supabase, this.userId)
      for (const build of builds) {
        try {
          const task = tasks.find(t => t.id === build.taskId)
          if (task) validations.push(...await validator.validate(task, build.output))
        } catch (e: any) { errors.push(`Validation: ${e.message}`) }
      }
    }

    // Phase 5: Debug (auto-fix build errors)
    if (builds.some(b => !b.success) || validations.some(v => !v.success)) {
      try {
        const debug = new DebugEngine(this.supabase, this.userId)
        await debug.debug(3)
      } catch (e: any) { errors.push(`Debug: ${e.message}`) }
    }

    // Phase 6: Refactor
    let refactors: BuildResult[] = []
    try {
      const refactor = new RefactorAgent(this.supabase, this.userId)
      refactors = await refactor.analyze(builds, validations)
    } catch (e: any) { errors.push(`Refactor: ${e.message}`) }

    // Phase 7: Learning
    let lessonsLearned = 0
    try {
      const learner = new LearnerEngine(this.supabase, this.userId)
      lessonsLearned = await learner.extractLessons(builds, validations, goal)
    } catch (e: any) { errors.push(`Learning: ${e.message}`) }

    // Phase 8: Self-Improvement
    try {
      const improve = new SelfImprovementEngine(this.supabase, this.userId)
      await improve.analyze()
    } catch (e: any) { errors.push(`Improvement: ${e.message}`) }

    const durationMs = Date.now() - startTime

    await this.supabase.from('development_memory').insert([{
      user_id: this.userId,
      type: 'plan', name: `Cycle: ${goal.substring(0, 60)}`,
      description: `${(durationMs / 1000).toFixed(1)}s, ${tasks.filter(t => t.status === 'completed').length}/${tasks.length} tasks`,
      content: { cycleId, goal, tasksCount: tasks.length, buildsCount: builds.length, validationsCount: validations.length, lessonsCount: lessonsLearned, durationMs, errors: errors.slice(0, 10), completedAt: new Date().toISOString() },
      tags: ['development', 'cycle', 'complete'], status: 'active',
    }])

    const summary = [
      `Plan: ${plan?.title || 'N/A'}`,
      `Tasks: ${tasks.filter(t => t.status === 'completed').length}/${tasks.length}`,
      `Builds: ${builds.filter(b => b.success).length}/${builds.length} ok`,
      `Validations: ${validations.filter(v => v.success).length}/${validations.length} passed`,
      `Refactors: ${refactors.length}`,
      `Lessons: ${lessonsLearned}`,
      `Errors: ${errors.length}`,
      `${(durationMs / 1000).toFixed(1)}s`,
    ].join(' | ')

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[DevSystem] Cycle completed', module: 'development',
      status: errors.length > 0 ? 'failed' : 'success', message: summary,
    }])

    return {
      cycleId, goal, plan, tasks, builds, validations, refactors, lessonsLearned,
      status: errors.length > 0 ? 'completed_with_errors' : 'completed', errors, summary,
    }
  }
}
