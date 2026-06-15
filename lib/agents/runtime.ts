/**
 * Agent Runtime — Generic Infrastructure
 *
 * Three execution modes:
 *   - manual    One-shot, on-demand execution (button click, API call)
 *   - scheduled Cron-like polling loop ("tick") that drains the orchestrator queue
 *   - event     Triggered by a database event (new lead, overdue task, webhook)
 *
 * Future-ready:
 *   - delegate()  Split one task across multiple agents, collect results
 *   - AgentSquad  Named group of agents that can be dispatched together
 *
 * Every execution path runs through:
 *   1. Agent matching / assignment
 *   2. Autonomy check (approval gate)
 *   3. AI execution (via lib/ai/execution.ts)
 *   4. Memory storage (via lib/ai/memory.ts)
 *   5. Execution logging (via execution_logs table)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { checkAutonomy } from './approval'
import type { AutonomyCheckResult } from './approval'
import type { AgentRow } from '@/lib/supabase/agents'
import type { OrchTaskWithAgent } from '@/lib/supabase/orchestrator'

// ─── Execution Modes ─────────────────────────────────────────

export type ExecutionMode = 'manual' | 'scheduled' | 'event'

// ─── Results ─────────────────────────────────────────────────

export interface TickResult {
  mode: ExecutionMode
  polled: number
  assigned: number
  executed: number
  approvalHeld: number
  failed: number
  skipped: number
  errors: string[]
  duration_ms: number
}

export interface ExecutionResult {
  taskId: string
  agentId: string
  mode: ExecutionMode
  status: 'completed' | 'failed' | 'pending_approval'
  output?: string
  error?: string
  tokensUsed: number
  durationMs: number
  approvalRequestId?: string
}

export interface DelegationPlan {
  id: string
  description: string
  steps: DelegationStep[]
}

export interface DelegationStep {
  label: string
  agentType: string
  agentId?: string | null
  instruction: string
}

export interface DelegationResult {
  planId: string
  steps: ExecutionResult[]
  totalDurationMs: number
  totalTokens: number
  status: 'completed' | 'partial' | 'failed'
}

// ─── AgentSquad ─────────────────────────────────────────────

export interface AgentSquad {
  id: string
  name: string
  description: string
  members: { agentId: string; role: string }[]
}

// ─── Action Type Inference ──────────────────────────────────

const ACTION_PATTERNS: [RegExp, string][] = [
  [/cancel|delete|remove|archive/i, 'delete_entity'],
  [/invoice|payment|charge|refund|billing/i, 'financial_action'],
  [/email|send|message|contact|notify/i, 'client_communication'],
  [/timeline|deadline|schedule|reschedule|delay/i, 'schedule_change'],
  [/budget|cost|price|fee|rate|spend/i, 'budget_change'],
  [/milestone|phase|deliverable/i, 'milestone_update'],
  [/project|portfolio/i, 'project_update'],
  [/monitor|scan|check|audit|review|inspect/i, 'monitoring_alert'],
  [/lead|prospect|qualify/i, 'lead_action'],
  [/content|post|publish|write/i, 'content_action'],
]

function inferActionType(taskTitle: string, taskDescription: string): string {
  const text = `${taskTitle} ${taskDescription}`
  for (const [pattern, action] of ACTION_PATTERNS) {
    if (pattern.test(text)) return action
  }
  return 'general_action'
}

// ─── Agent Runtime ──────────────────────────────────────────

export class AgentRuntime {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  // ════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════════════

  /**
   * Manual execution — run one agent ad-hoc with a prompt.
   * Creates an orchestrator task, checks autonomy, executes, returns the result.
   */
  async exec(
    agentId: string,
    prompt: string,
    opts?: {
      systemPrompt?: string
      priority?: 'low' | 'medium' | 'high' | 'critical'
    }
  ): Promise<ExecutionResult> {
    const agent = await this.getAgent(agentId)
    if (!agent) throw new Error(`Agent ${agentId} not found`)

    const task = await this.createTask({
      agentId: agent.id,
      title: `Manual: ${prompt.slice(0, 80)}`,
      description: prompt,
      status: 'assigned',
      priority: opts?.priority ?? 'medium',
    })
    if (!task) throw new Error('Failed to create orchestrator task')

    return this.runTask(task.id, agent, prompt, {
      mode: 'manual',
      systemPrompt: opts?.systemPrompt,
    })
  }

  /**
   * Scheduled execution — poll the orchestrator queue and drain pending tasks.
   * This is what a cron job calls every N minutes.
   */
  async tick(opts?: { maxTasks?: number }): Promise<TickResult> {
    const start = Date.now()
    const result: TickResult = {
      mode: 'scheduled', polled: 0, assigned: 0, executed: 0,
      approvalHeld: 0, failed: 0, skipped: 0, errors: [], duration_ms: 0,
    }

    const tasks = await this.fetchPendingTasks(opts?.maxTasks ?? 20)
    result.polled = tasks.length
    if (!tasks.length) return { ...result, duration_ms: Date.now() - start }

    for (const task of tasks) {
      try {
        const r = await this.processTask(task)
        if (r.status === 'completed') result.executed++
        else if (r.status === 'pending_approval') result.approvalHeld++
        else result.failed++
      } catch (err: any) {
        result.failed++
        result.errors.push(`Task ${task.id}: ${err.message}`)
        await this.setTaskFailed(task.id, err.message)
      }
    }

    result.duration_ms = Date.now() - start
    return result
  }

  /**
   * Event-driven execution — triggered by a database event.
   * Creates a task and optionally delegates it if a DelegationPlan is provided.
   *
   * Example: when a new lead is inserted, an event triggers this with
   * a DelegationPlan that scores the lead, then routes it to sales.
   */
  async on(
    eventType: string,
    payload: Record<string, any>,
    plan?: DelegationPlan
  ): Promise<ExecutionResult | DelegationResult> {
    if (plan) {
      return this.delegate(plan, { mode: 'event', eventPayload: payload })
    }

    // Find an agent registered for this event type via config
    const agents = await this.findAgentsForEvent(eventType)
    if (!agents.length) {
      throw new Error(`No agent configured for event: ${eventType}`)
    }

    const agent = agents[0]
    const task = await this.createTask({
      agentId: agent.id,
      title: `Event: ${eventType}`,
      description: JSON.stringify(payload),
      status: 'assigned',
      priority: 'medium',
    })
    if (!task) throw new Error('Failed to create task for event')

    return this.runTask(task.id, agent, JSON.stringify(payload), {
      mode: 'event',
      systemPrompt: `You are responding to a ${eventType} event. Payload: ${JSON.stringify(payload)}`,
    })
  }

  /**
   * Multi-agent delegation — split work across multiple agents.
   * Each step creates its own task and runs through the full execution pipeline.
   */
  async delegate(
    plan: DelegationPlan,
    opts?: { mode?: ExecutionMode; eventPayload?: Record<string, any> }
  ): Promise<DelegationResult> {
    const mode = opts?.mode ?? 'manual'
    const stepResults: ExecutionResult[] = []
    let context = opts?.eventPayload ? JSON.stringify(opts.eventPayload) : ''

    for (const step of plan.steps) {
      const agentId = step.agentId ?? (await this.resolveAgentByType(step.agentType))?.id
      if (!agentId) {
        stepResults.push({
          taskId: '', agentId: '', mode,
          status: 'failed', error: `No agent available for type: ${step.agentType}`,
          tokensUsed: 0, durationMs: 0,
        })
        continue
      }

      const agent = await this.getAgent(agentId)
      if (!agent) {
        stepResults.push({
          taskId: '', agentId, mode,
          status: 'failed', error: `Agent ${agentId} not found`,
          tokensUsed: 0, durationMs: 0,
        })
        continue
      }

      const instruction = context
        ? `${step.instruction}\n\nContext from previous step:\n${context}`
        : step.instruction

      const task = await this.createTask({
        agentId,
        title: `[${plan.id}/${step.label}] ${step.instruction.slice(0, 60)}`,
        description: instruction,
        status: 'assigned',
        priority: 'medium',
      })
      if (!task) {
        stepResults.push({
          taskId: '', agentId, mode,
          status: 'failed', error: 'Failed to create task',
          tokensUsed: 0, durationMs: 0,
        })
        continue
      }

      const result = await this.runTask(task.id, agent, instruction, {
        mode,
        systemPrompt: `You are step "${step.label}" in the "${plan.description}" delegation plan. Your output will be passed to the next agent. Be thorough and structured.`,
      })
      stepResults.push(result)

      if (result.output) {
        context = result.output
      }
    }

    const totalTokens = stepResults.reduce((s, r) => s + r.tokensUsed, 0)
    const totalDurationMs = stepResults.reduce((s, r) => s + r.durationMs, 0)
    const completed = stepResults.every((r) => r.status === 'completed')
    const anySucceeded = stepResults.some((r) => r.status === 'completed')

    return {
      planId: plan.id,
      steps: stepResults,
      totalDurationMs,
      totalTokens,
      status: completed ? 'completed' : anySucceeded ? 'partial' : 'failed',
    }
  }

  /**
   * Dispatch a squad — all members execute the same instruction in parallel.
   */
  async dispatchSquad(
    squad: AgentSquad,
    instruction: string,
    opts?: { mode?: ExecutionMode }
  ): Promise<DelegationResult> {
    const mode = opts?.mode ?? 'manual'
    const results = await Promise.all(
      squad.members.map(async (member) => {
        try {
          return await this.exec(member.agentId, instruction, {
            systemPrompt: `You are "${member.role}" in squad "${squad.name}". ${instruction}`,
            priority: 'medium',
          })
        } catch (err: any) {
          return {
            taskId: '', agentId: member.agentId, mode,
            status: 'failed' as const, error: err.message,
            tokensUsed: 0, durationMs: 0,
          } as ExecutionResult
        }
      })
    )

    const totalTokens = results.reduce((s, r) => s + r.tokensUsed, 0)
    const totalDurationMs = results.reduce((s, r) => s + r.durationMs, 0)
    const completed = results.every((r) => r.status === 'completed')

    return {
      planId: `squad:${squad.id}`,
      steps: results,
      totalDurationMs,
      totalTokens,
      status: completed ? 'completed' : 'partial',
    }
  }

  // ════════════════════════════════════════════════════════════
  //  SCHEDULE REGISTRATION (stateful, for the orchestrator UI)
  // ════════════════════════════════════════════════════════════

  /**
   * Register or update a scheduled task. The orchestrator UI polls these
   * and calls tick() on the configured interval.
   */
  async schedule(opts: {
    agentId: string
    cronExpression: string  // simplified: "every_15m" | "every_1h" | "every_6h" | "daily"
    instruction: string
    enabled?: boolean
  }): Promise<void> {
    const intervalMap: Record<string, number> = {
      every_15m: 15, every_30m: 30, every_1h: 60,
      every_6h: 360, every_12h: 720, daily: 1440,
    }
    const intervalMinutes = intervalMap[opts.cronExpression] ?? 60

    // Store schedule in orchestrator_memory for persistence
    await this.supabase.from('orchestrator_memory').upsert({
      user_id: this.userId,
      key: `schedule:${opts.agentId}`,
      value: {
        agent_id: opts.agentId,
        cron: opts.cronExpression,
        interval_minutes: intervalMinutes,
        instruction: opts.instruction,
        enabled: opts.enabled ?? true,
        last_run: null,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' })
  }

  /**
   * Tick a specific scheduled agent (used by the cron dispatcher).
   */
  async tickScheduled(agentId: string, instruction: string): Promise<ExecutionResult> {
    return this.exec(agentId, instruction, {
      systemPrompt: 'This is a scheduled execution. Follow your configured routine.',
      priority: 'low',
    })
  }

  // ════════════════════════════════════════════════════════════
  //  INTERNAL — Task Processing Pipeline
  // ════════════════════════════════════════════════════════════

  private async processTask(task: OrchTaskWithAgent): Promise<ExecutionResult> {
    // 1. Find a capable agent
    const agent = task.agent_id
      ? (await this.getAgent(task.agent_id))
      : (await this.resolveBestAgent(task))
    if (!agent) {
      await this.setTaskSkipped(task.id, 'No capable agent available')
      return { taskId: task.id, agentId: '', mode: 'scheduled', status: 'failed', error: 'No capable agent available', tokensUsed: 0, durationMs: 0 }
    }

    // 2. Assign
    await this.assignTask(task.id, agent.id)

    // 3. Check autonomy
    const actionType = inferActionType(task.title, task.description ?? '')
    const autonomy = await checkAutonomy(this.supabase, this.userId, agent, {
      action: actionType,
      targetType: 'orchestrator_task',
      taskId: task.id,
      metadata: { taskTitle: task.title, taskDescription: task.description, priority: task.priority },
    })

    if (autonomy.status === 'needs_approval') {
      const approvalId = await this.createApprovalRequest(agent, task.id, autonomy)
      return { taskId: task.id, agentId: agent.id, mode: 'scheduled', status: 'pending_approval', tokensUsed: 0, durationMs: 0, approvalRequestId: approvalId }
    }

    // 4. Execute
    const prompt = task.description || task.title
    const systemPrompt = autonomy.systemPromptOverride
      ?? `You are ${agent.name}, a ${agent.type} agent. ${agent.role ? `Role: ${agent.role}.` : ''}`
    return this.runTask(task.id, agent, prompt, { mode: 'scheduled', systemPrompt })
  }

  private async runTask(
    taskId: string,
    agent: AgentRow,
    prompt: string,
    opts: { mode: ExecutionMode; systemPrompt?: string }
  ): Promise<ExecutionResult> {
    const start = Date.now()
    await this.log(taskId, agent.id, 'execution_started', `[${opts.mode}] Executing with ${agent.name}`)

    try {
      const result = await executeAgentTask(this.supabase, this.userId, agent.id, prompt, {
        systemPrompt: opts.systemPrompt,
        taskId,
      })

      const durationMs = Date.now() - start
      const status = (result.status === 'completed' ? 'completed' : 'failed') as 'completed' | 'failed'

      await this.supabase.from('orchestrator_tasks').update({
        status, result: result.response, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', taskId)

      await this.log(taskId, agent.id, `execution_${status}`,
        status === 'completed'
          ? `Completed in ${(durationMs / 1000).toFixed(1)}s (${result.tokens_used} tokens)`
          : `Failed: ${result.error_msg ?? 'Unknown error'}`)

      // Persist to agent memory
      if (result.response) {
        await storeMemory(this.supabase, this.userId, {
          agent_id: agent.id,
          category: 'workflow_output',
          content: {
            taskId, mode: opts.mode, agentType: agent.type, agentName: agent.name,
            prompt: prompt.slice(0, 500), output: result.response.slice(0, 2000),
            tokensUsed: result.tokens_used, durationMs, status,
          },
          tags: [agent.type, agent.department ?? 'general', opts.mode].filter(Boolean),
        })
      }

      return { taskId, agentId: agent.id, mode: opts.mode, status, output: result.response ?? undefined, tokensUsed: result.tokens_used, durationMs }
    } catch (err: any) {
      await this.setTaskFailed(taskId, err.message)
      await this.log(taskId, agent.id, 'execution_error', `[${opts.mode}] Error: ${err.message}`)
      return { taskId, agentId: agent.id, mode: opts.mode, status: 'failed', error: err.message, tokensUsed: 0, durationMs: Date.now() - start }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  INTERNAL — Agent Matching & Assignment
  // ════════════════════════════════════════════════════════════

  private async getAgent(agentId: string): Promise<AgentRow | null> {
    const { data } = await this.supabase.from('agents').select('*').eq('id', agentId).single()
    return (data ?? null) as AgentRow | null
  }

  private async resolveBestAgent(task: OrchTaskWithAgent): Promise<AgentRow | null> {
    const { data: agents } = await this.supabase
      .from('agents')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'idle')
      .order('performance_score', { ascending: false })
    if (!agents?.length) return null

    const rows = agents as AgentRow[]
    const text = `${task.title} ${task.description ?? ''}`.toLowerCase()

    // Exact type match
    const byType = rows.find((a) => a.type && text.includes(a.type))
    if (byType) return byType

    // General agent fallback
    const general = rows.find((a) => a.type === 'general')
    if (general) return general

    return rows[0] ?? null
  }

  private async resolveAgentByType(agentType: string): Promise<AgentRow | null> {
    const { data } = await this.supabase
      .from('agents')
      .select('*')
      .eq('user_id', this.userId)
      .eq('type', agentType)
      .eq('status', 'idle')
      .order('performance_score', { ascending: false })
      .limit(1)
      .single()
    return (data ?? null) as AgentRow | null
  }

  private async findAgentsForEvent(eventType: string): Promise<AgentRow[]> {
    // Agents with config that includes this event type
    const { data } = await this.supabase
      .from('agents')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'idle')
      .order('performance_score', { ascending: false })
    if (!data) return []
    const rows = data as AgentRow[]
    return rows.filter((a) => {
      const c = a.config as Record<string, any> | null
      return c?.events?.includes(eventType)
    })
  }

  // ════════════════════════════════════════════════════════════
  //  INTERNAL — Orchestrator Helpers
  // ════════════════════════════════════════════════════════════

  private async fetchPendingTasks(max: number): Promise<OrchTaskWithAgent[]> {
    const { data } = await this.supabase
      .from('orchestrator_tasks')
      .select('*, agents!orchestrator_tasks_agent_id_fkey(name, type)')
      .eq('user_id', this.userId)
      .in('status', ['pending', 'assigned'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(max)
    return ((data ?? []) as any[]).map((r: any) => ({
      ...r, agent_name: r.agents?.name ?? null, agent_type: r.agents?.type ?? null,
    })) as OrchTaskWithAgent[]
  }

  private async createTask(params: {
    agentId: string; title: string; description: string; status: string; priority: string
  }): Promise<{ id: string } | null> {
    const { data } = await this.supabase.from('orchestrator_tasks').insert([{
      user_id: this.userId, agent_id: params.agentId, title: params.title,
      description: params.description, status: params.status, priority: params.priority,
      assigned_at: new Date().toISOString(),
    }]).select('id').single()
    return data ?? null
  }

  private async assignTask(taskId: string, agentId: string): Promise<void> {
    await this.supabase.from('orchestrator_tasks').update({
      status: 'in_progress', agent_id: agentId, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', taskId)
    await this.supabase.from('agents').update({ status: 'busy', last_active_at: new Date().toISOString() }).eq('id', agentId)
  }

  private async setTaskSkipped(taskId: string, reason: string): Promise<void> {
    await this.supabase.from('orchestrator_tasks').update({
      status: 'failed', result: `Skipped: ${reason}`, updated_at: new Date().toISOString(),
    }).eq('id', taskId)
  }

  private async setTaskFailed(taskId: string, msg: string): Promise<void> {
    await this.supabase.from('orchestrator_tasks').update({
      status: 'failed', result: `Error: ${msg}`, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', taskId)
  }

  private async createApprovalRequest(agent: AgentRow, taskId: string, autonomy: AutonomyCheckResult): Promise<string> {
    await this.supabase.from('orchestrator_tasks').update({
      status: 'pending', updated_at: new Date().toISOString(),
    }).eq('id', taskId)

    const { data } = await this.supabase.from('agent_approval_requests').insert([{
      user_id: this.userId, agent_id: agent.id, action: autonomy.action,
      target_type: 'orchestrator_task', target_id: taskId,
      summary: `"${agent.name}" needs approval for: ${autonomy.reason ?? autonomy.action}`,
      justification: autonomy.reason ?? null, impact: autonomy.impact ?? 'medium',
      proposed_change: autonomy.proposedChange ?? {}, current_state: {},
      task_id: taskId, status: 'pending',
    }]).select('id').single()
    const id = data?.id
    if (id) {
      await this.log(taskId, agent.id, 'approval_requested', `Requested approval for: ${autonomy.action}`)
    }
    return id
  }

  private async log(taskId: string, agentId: string, action: string, message: string): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null, action, module: 'agents',
        entity_type: 'orchestrator_task', entity_id: taskId,
        status: action.includes('error') || action.includes('failed') ? 'failed' : 'success',
        message,
      }])
    } catch { /* non-blocking */ }
  }
}
