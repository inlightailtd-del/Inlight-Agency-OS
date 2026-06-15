/**
 * Department Swarm Foundation
 *
 * Each department is a self-contained module that coordinates agents
 * via the AgentRuntime. Departments own:
 *   - A DelegationPlan for their core workflow
 *   - Agent squad definitions (which agents work together)
 *   - A status/reporting function
 *
 * These are NOT new systems — they reuse the existing runtime,
 * agents table, orchestrator, and Company Brain.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { AgentRuntime, type DelegationPlan, type AgentSquad } from '@/lib/agents/runtime'
import { storeMemory } from '@/lib/ai/memory'

// ─── Types ──────────────────────────────────────────────────

export type DepartmentName = 'marketing' | 'sales' | 'operations'

export interface DepartmentStatus {
  department: DepartmentName
  agents: { total: number; active: number; idle: number }
  tasks: { pending: number; inProgress: number; completed: number; failed: number }
  lastReport: string | null
  health: 'good' | 'at_risk' | 'critical'
}

// ════════════════════════════════════════════════════════════
// MARKETING DEPARTMENT
// ════════════════════════════════════════════════════════════

export const MARKETING_PLAN: DelegationPlan = {
  id: 'marketing-weekly',
  description: 'Weekly Marketing Operations — research, plan, create, publish, analyze',
  steps: [
    { label: 'Market Research', agentType: 'research', instruction: 'Research latest trends, competitor activity, and content gaps in our niche. Use Company Brain to find past performance data.' },
    { label: 'Content Planning', agentType: 'content', instruction: 'Create a weekly content plan with 5 pieces. Include blog posts, social media updates, and email content. Align with brand voice.' },
    { label: 'Content Creation', agentType: 'marketing', instruction: 'Generate the planned content. Ensure each piece is optimized for its platform and audience.' },
    { label: 'Campaign Setup', agentType: 'automation', instruction: 'Configure distribution for the content. Set up email sequences, social scheduling, and tracking.' },
  ],
}

// ════════════════════════════════════════════════════════════
// SALES DEPARTMENT
// ════════════════════════════════════════════════════════════

export const SALES_PLAN: DelegationPlan = {
  id: 'sales-daily',
  description: 'Daily Sales Operations — leads, qualification, outreach, follow-up',
  steps: [
    { label: 'Lead Scoring', agentType: 'sales', instruction: 'Score all new leads. Prioritize by score and identify hot leads for immediate follow-up.' },
    { label: 'Qualification', agentType: 'sales', instruction: 'Qualify high-scoring leads. Research their company, needs, and fit. Prepare personalized outreach.' },
    { label: 'Outreach', agentType: 'automation', instruction: 'Execute outreach sequences for qualified leads. Log all interactions in the CRM.' },
    { label: 'Pipeline Review', agentType: 'ceo', instruction: 'Review sales pipeline health. Identify stalled deals and recommend next actions.' },
  ],
}

// ════════════════════════════════════════════════════════════
// OPERATIONS DEPARTMENT
// ════════════════════════════════════════════════════════════

export const OPERATIONS_PLAN: DelegationPlan = {
  id: 'operations-daily',
  description: 'Daily Operations — project monitoring, task queue, quality, reporting',
  steps: [
    { label: 'Project Scan', agentType: 'automation', instruction: 'Scan all active projects for risks: overdue tasks, budget overruns, stalled work. Create remediation tasks.' },
    { label: 'Queue Processing', agentType: 'automation', instruction: 'Process the orchestrator queue. Prioritize critical and high-priority tasks.' },
    { label: 'Quality Review', agentType: 'research', instruction: 'Review recent completed work for quality. Flag any issues for follow-up.' },
    { label: 'Operations Report', agentType: 'ceo', instruction: 'Generate daily operations summary. Include projects at risk, queue status, and recommendations.' },
  ],
}

// ════════════════════════════════════════════════════════════
// RUNNER — Run a department cycle
// ════════════════════════════════════════════════════════════

export async function runDepartment(
  supabase: SupabaseClient,
  userId: string,
  department: DepartmentName
): Promise<{ ok: boolean; result?: any; error?: string }> {
  const plan = getDepartmentPlan(department)
  if (!plan) return { ok: false, error: `No plan for department: ${department}` }

  const runtime = new AgentRuntime(supabase, userId)
  const result = await runtime.delegate(plan)

  // Log to memory
  await storeMemory(supabase, userId, {
    category: 'department_run',
    content: {
      department,
      planId: plan.id,
      status: result.status,
      steps: result.steps.map((s) => ({ label: s.status, status: s.status })),
      totalDurationMs: result.totalDurationMs,
      totalTokens: result.totalTokens,
      timestamp: new Date().toISOString(),
    },
    tags: [department, 'department_run'],
  })

  return { ok: true, result }
}

export async function getDepartmentStatus(
  supabase: SupabaseClient,
  userId: string,
  department: DepartmentName
): Promise<DepartmentStatus> {
  const [{ data: agents }, { data: tasks }, { data: reports }] = await Promise.all([
    supabase.from('agents').select('status').eq('user_id', userId).eq('department', department),
    supabase.from('orchestrator_tasks').select('status').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    supabase.from('agent_memory').select('created_at').eq('user_id', userId).eq('category', 'department_run').contains('tags', [department]).order('created_at', { ascending: false }).limit(1),
  ])

  const agentList = (agents ?? []) as any[]
  const taskList = (tasks ?? []) as any[]
  const lastReport = ((reports ?? []) as any[])[0]?.created_at ?? null

  const agentStatus = {
    total: agentList.length,
    active: agentList.filter((a: any) => a.status === 'active').length,
    idle: agentList.filter((a: any) => a.status === 'idle').length,
  }

  const taskStatus = {
    pending: taskList.filter((t: any) => t.status === 'pending').length,
    inProgress: taskList.filter((t: any) => t.status === 'in_progress').length,
    completed: taskList.filter((t: any) => t.status === 'completed').length,
    failed: taskList.filter((t: any) => t.status === 'failed').length,
  }

  const health = taskStatus.failed > 3 ? 'critical' : taskStatus.pending > 10 ? 'at_risk' : 'good'

  return { department, agents: agentStatus, tasks: taskStatus, lastReport, health }
}

// ════════════════════════════════════════════════════════════
// SQUADS — Agent groups for each department
// ════════════════════════════════════════════════════════════

export async function getDepartmentSquad(
  supabase: SupabaseClient,
  userId: string,
  department: DepartmentName
): Promise<AgentSquad> {
  const { data } = await supabase
    .from('agents')
    .select('id, name, type, role')
    .eq('user_id', userId)
    .eq('department', department)
    .order('performance_score', { ascending: false })

  const agents = (data ?? []) as any[]
  const squadName = `${department.charAt(0).toUpperCase() + department.slice(1)} Squad`

  return {
    id: `squad-${department}`,
    name: squadName,
    description: `${agents.length} agents in ${department} department`,
    members: agents.map((a: any) => ({ agentId: a.id, role: a.role || a.type || 'member' })),
  }
}

// ════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════

function getDepartmentPlan(department: DepartmentName): DelegationPlan | null {
  switch (department) {
    case 'marketing': return MARKETING_PLAN
    case 'sales': return SALES_PLAN
    case 'operations': return OPERATIONS_PLAN
    default: return null
  }
}
