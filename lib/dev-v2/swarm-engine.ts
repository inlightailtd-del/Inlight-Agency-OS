import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { SwarmAgent, SwarmTask } from './types'

const DEFAULT_SWARM: SwarmAgent[] = [
  { role: 'architect', specialization: 'system design and architecture', model: 'default', temperature: 0.3, maxIterations: 2, isActive: true, performanceMetrics: { successRate: 0, avgDurationMs: 0, tasksCompleted: 0 }, instructions: 'Design architecture, analyze requirements, produce implementation plans.' },
  { role: 'planner', specialization: 'task breakdown and sequencing', model: 'default', temperature: 0.3, maxIterations: 2, isActive: true, performanceMetrics: { successRate: 0, avgDurationMs: 0, tasksCompleted: 0 }, instructions: 'Break architecture into executable tasks with dependencies.' },
  { role: 'builder', specialization: 'code implementation', model: 'default', temperature: 0.5, maxIterations: 3, isActive: true, performanceMetrics: { successRate: 0, avgDurationMs: 0, tasksCompleted: 0 }, instructions: 'Write production code following project patterns.' },
  { role: 'reviewer', specialization: 'code review and quality', model: 'default', temperature: 0.2, maxIterations: 2, isActive: true, performanceMetrics: { successRate: 0, avgDurationMs: 0, tasksCompleted: 0 }, instructions: 'Check code quality, correctness, and adherence to patterns.' },
  { role: 'tester', specialization: 'testing and validation', model: 'default', temperature: 0.2, maxIterations: 2, isActive: true, performanceMetrics: { successRate: 0, avgDurationMs: 0, tasksCompleted: 0 }, instructions: 'Create and run tests. Verify behavior.' },
  { role: 'debugger', specialization: 'error diagnosis and fix', model: 'default', temperature: 0.4, maxIterations: 3, isActive: true, performanceMetrics: { successRate: 0, avgDurationMs: 0, tasksCompleted: 0 }, instructions: 'Diagnose build/test failures and apply targeted fixes.' },
]

export class SwarmEngine {
  private supabase: any
  private userId: string
  private rootDir: string
  private agents: SwarmAgent[] = [...DEFAULT_SWARM]

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  async loadOrInit(): Promise<SwarmAgent[]> {
    const { data } = await this.supabase
      .from('dev_swarm_agents')
      .select('*')
      .eq('user_id', this.userId)
    if ((data as any[])?.length > 0) {
      this.agents = (data as any[]).map(d => ({
        id: d.id, role: d.role, specialization: d.specialization,
        model: d.model, temperature: d.temperature, maxIterations: d.max_iterations,
        isActive: d.is_active,
        performanceMetrics: d.performance_metrics || { successRate: 0, avgDurationMs: 0, tasksCompleted: 0 },
        instructions: d.instructions,
      }))
      return this.agents
    }

    // Initialize default agents
    for (const agent of DEFAULT_SWARM) {
      await this.supabase.from('dev_swarm_agents').insert([{
        user_id: this.userId, role: agent.role,
        specialization: agent.specialization,
        model: agent.model, temperature: agent.temperature,
        max_iterations: agent.maxIterations, is_active: agent.isActive,
        performance_metrics: agent.performanceMetrics,
        instructions: agent.instructions,
      }])
    }
    return DEFAULT_SWARM
  }

  async getAgent(role: string): Promise<SwarmAgent | undefined> {
    if (this.agents.length === 0) await this.loadOrInit()
    return this.agents.find(a => a.role === role)
  }

  async runArchitect(instruction: string): Promise<string> {
    // Read repo structure to inform architecture
    const repoInfo = this.getRepoStructure()
    const prompt = `You are the Architect Agent.\n\nRepository:\n${repoInfo}\n\nObjective: ${instruction}\n\nProduce a detailed implementation plan with components, phases, dependencies, and file paths.`

    const result = await this.executeAI(prompt, 0.3)
    return result
  }

  async runPlanner(architectPlan: string): Promise<SwarmTask[]> {
    const prompt = `You are the Planner Agent.\n\nArchitect Plan:\n${architectPlan}\n\nBreak this into executable tasks. Each task must specify: role (builder|tester), instruction, files to create/modify.`

    const result = await this.executeAI(prompt, 0.3)
    return this.parseTasks(result)
  }

  async runBuilder(instruction: string, existingCode?: string): Promise<string> {
    const prompt = `You are the Builder Agent.\n\nInstruction: ${instruction}\n\nExisting code context:\n${existingCode || 'No existing code'}\n\nWrite the implementation. Return ONLY the code.`

    const result = await this.executeAI(prompt, 0.5)
    return result
  }

  async runReviewer(code: string, context: string): Promise<string> {
    const prompt = `You are the Review Agent.\n\nCode to review:\n${code.substring(0, 2000)}\n\nContext: ${context}\n\nReview for: correctness, edge cases, error handling, type safety, performance. Return issues found.`

    return await this.executeAI(prompt, 0.2)
  }

  async runDebugger(error: string, code: string): Promise<string> {
    const prompt = `You are the Debug Agent.\n\nError:\n${error}\n\nCode:\n${code.substring(0, 2000)}\n\nDiagnose the root cause and provide the exact fix.`

    return await this.executeAI(prompt, 0.4)
  }

  async runBuild(): Promise<{ success: boolean; output: string }> {
    try {
      const output = execSync('npm run build 2>&1', { cwd: this.rootDir, encoding: 'utf-8', timeout: 120000 })
      const success = !output.includes('error') || !output.includes('Type error:')
      return { success, output: output.substring(0, 2000) }
    } catch (e: any) {
      return { success: false, output: (e.stdout || e.stderr || e.message).substring(0, 2000) }
    }
  }

  async runTests(): Promise<{ success: boolean; output: string }> {
    try {
      const output = execSync('npm test 2>&1', { cwd: this.rootDir, encoding: 'utf-8', timeout: 60000 })
      return { success: true, output: output.substring(0, 2000) }
    } catch (e: any) {
      return { success: false, output: (e.stdout || e.stderr || e.message).substring(0, 2000) }
    }
  }

  async updateMetrics(role: string, success: boolean, durationMs: number) {
    const agent = this.agents.find(a => a.role === role)
    if (!agent) return
    const m = agent.performanceMetrics
    m.tasksCompleted++
    m.avgDurationMs = (m.avgDurationMs * (m.tasksCompleted - 1) + durationMs) / m.tasksCompleted
    m.successRate = (m.successRate * (m.tasksCompleted - 1) + (success ? 100 : 0)) / m.tasksCompleted

    await this.supabase.from('dev_swarm_agents')
      .update({ performance_metrics: m })
      .eq('user_id', this.userId)
      .eq('role', role)
  }

  private getRepoStructure(): string {
    const dirs = ['lib', 'app', 'components', 'supabase/migrations', 'scripts']
    let result = ''
    for (const dir of dirs) {
      const path = join(this.rootDir, dir)
      if (existsSync(path)) {
        result += `\n${dir}/:\n`
        try {
          const entries = execSync(`dir /b "${path}"`, { encoding: 'utf-8', timeout: 5000 }).trim()
          result += entries.split('\n').slice(0, 30).map(e => `  ${e.trim()}`).join('\n') + '\n'
        } catch { result += '  (read error)\n' }
      }
    }
    return result || 'Repository structure unavailable'
  }

  private async executeAI(prompt: string, temperature: number): Promise<string> {
    try {
      const { generateAIResponse } = await import('@/lib/ai/provider')
      const response = await generateAIResponse(
        { provider: 'openai', model: 'gpt-4o' },
        [
          { role: 'system', content: 'You are an expert software engineer. Be precise, detailed, and specific. Include file paths and code where relevant.' },
          { role: 'user', content: prompt }
        ]
      )
      return response.content
    } catch {
      return ''
    }
  }

  private parseTasks(text: string): SwarmTask[] {
    const tasks: SwarmTask[] = []
    const lines = text.split('\n')
    let current: Partial<SwarmTask> = {}
    for (const line of lines) {
      if (line.toLowerCase().startsWith('task') || line.toLowerCase().startsWith('## ')) {
        if (current.role) tasks.push(this.normalizeTask(current))
        current = { id: `task-${tasks.length + 1}-${Date.now()}`, files: [] }
      } else if (line.toLowerCase().includes('role:')) {
        current.role = line.split(':')[1]?.trim().toLowerCase() || 'builder'
      } else if (line.toLowerCase().includes('instruction:')) {
        current.instruction = line.split(':').slice(1).join(':').trim()
      } else if (line.toLowerCase().includes('file:') && current.instruction) {
        const path = line.split(':').slice(1).join(':').trim()
        if (path) current.files?.push({ operation: 'create', path, description: current.instruction.substring(0, 80), content: '' })
        current.instruction = current.instruction.substring(0, 500)
      }
    }
    if (current.role) tasks.push(this.normalizeTask(current))
    return tasks
  }

  private normalizeTask(t: Partial<SwarmTask>): SwarmTask {
    return {
      id: t.id || `task-${Date.now()}`,
      cycleId: '',
      role: t.role || 'builder',
      instruction: t.instruction || 'Implement the required changes',
      files: t.files || [],
      status: 'pending',
      output: '',
      buildOutput: '',
      durationMs: 0,
    }
  }
}
