/**
 * Project Monitor Agent — A consumer of the AgentRuntime.
 *
 * This is one agent use-case, not the runtime itself. The runtime handles
 * execution (manual / scheduled / event / delegation); this module defines
 * what to run and how to interpret the results.
 *
 * The monitor scans active projects for:
 *   - Overdue tasks
 *   - Near-deadline milestones
 *   - Budget overruns
 *   - Health score drops
 *   - Stalled projects
 *
 * Each finding is stored in agent_memory (category: 'monitoring') and also
 * creates an orchestrator_task so the runtime can act on it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'
import type { AgentRow } from '@/lib/supabase/agents'
import type { DelegationPlan } from './runtime'

// ─── Types ───────────────────────────────────────────────────

export interface ProjectFinding {
  projectId: string
  projectName: string
  severity: 'info' | 'warning' | 'critical'
  category: 'overdue_task' | 'milestone_at_risk' | 'budget_overrun' | 'health_drop' | 'stalled_project'
  title: string
  description: string
  impact: string
  metrics: Record<string, any>
}

export interface MonitorResult {
  scanned: number
  findings: number
  tasksCreated: number
  criticalFindings: number
  errors: string[]
  duration_ms: number
  plan?: DelegationPlan   // populated when findings create a delegation workflow
}

// ─── Interface ───────────────────────────────────────────────

export const PROJECT_MONITOR_TYPE = 'automation'
export const PROJECT_MONITOR_INSTRUCTION = 'Scan all active projects for risks and issues. Report findings with severity, category, and impact.'

export const PROJECT_MONITOR_SYSTEM_PROMPT = `You are the Project Monitor Agent. Your job is to identify project risks and suggest corrective actions.

For each project you scan, output a structured report with:
- Project name and status
- Risk level (LOW / MEDIUM / HIGH / CRITICAL)
- Key findings with impact assessment
- Recommended actions

Be concise, specific, and actionable. Focus on what needs human attention.`

/**
 * Run the Project Monitor on all active projects.
 * Designed to be called via runtime.exec() or runtime.delegate().
 */
export async function runProjectMonitor(
  supabase: SupabaseClient,
  userId: string,
  agent: AgentRow
): Promise<MonitorResult> {
  const startTime = Date.now()
  const result: MonitorResult = {
    scanned: 0, findings: 0, tasksCreated: 0, criticalFindings: 0, errors: [], duration_ms: 0,
  }

  try {
    const projects = await fetchActiveProjects(supabase, userId)
    result.scanned = projects.length
    if (!projects.length) return withTime(result, startTime)

    for (const project of projects) {
      try {
        const findings = await analyzeProject(project)
        result.findings += findings.length

        for (const finding of findings) {
          if (finding.severity === 'critical') result.criticalFindings++

          // Persist finding to memory
          await storeMemory(supabase, userId, {
            agent_id: agent.id,
            category: 'monitoring',
            content: {
              projectId: finding.projectId,
              projectName: finding.projectName,
              severity: finding.severity,
              category: finding.category,
              title: finding.title,
              description: finding.description,
              impact: finding.impact,
              metrics: finding.metrics,
              timestamp: new Date().toISOString(),
            },
            tags: ['monitoring', finding.category, finding.severity, `project:${finding.projectId}`],
          })

          // Create task in orchestrator for each finding
          const taskId = await createMonitorTask(supabase, userId, agent, finding)
          if (taskId) result.tasksCreated++
        }
      } catch (err: any) {
        result.errors.push(`Project ${project.id}: ${err.message}`)
      }
    }

    // Build a DelegationPlan if critical findings were found
    if (result.criticalFindings > 0) {
      result.plan = buildRemediationPlan(result, agent.id)
    }

    // Summary
    await storeMemory(supabase, userId, {
      agent_id: agent.id,
      category: 'monitoring',
      content: {
        type: 'monitor_summary',
        scanned: result.scanned,
        findings: result.findings,
        tasksCreated: result.tasksCreated,
        criticalFindings: result.criticalFindings,
        timestamp: new Date().toISOString(),
      },
      tags: ['monitoring', 'summary'],
    })
  } catch (err: any) {
    result.errors.push(`Monitor error: ${err.message}`)
  }

  return withTime(result, startTime)
}

// ─── Analysis ────────────────────────────────────────────────

interface ProjectWithRelations {
  id: string
  name: string
  status: string
  health: string | number | null
  budget: number | null
  actual_cost: number | null
  updated_at: string | null
  tasks: { id: string; title: string; status: string; due_date: string | null; priority: string }[]
  milestones: { id: string; name: string; status: string; due_date: string | null }[]
}

async function fetchActiveProjects(supabase: SupabaseClient, userId: string): Promise<ProjectWithRelations[]> {
  const { data } = await supabase
    .from('projects')
    .select(`
      id, name, status, health, budget, actual_cost, updated_at,
      tasks!tasks_project_id_fkey(id, title, status, due_date, priority),
      milestones!milestones_project_id_fkey(id, name, status, due_date)
    `)
    .eq('user_id', userId)
    .in('status', ['active', 'planning'])
    .order('updated_at', { ascending: false })
  return (data ?? []) as unknown as ProjectWithRelations[]
}

function analyzeProject(project: ProjectWithRelations): ProjectFinding[] {
  const findings: ProjectFinding[] = []
  const now = new Date()
  const tasks = project.tasks ?? []
  const milestones = project.milestones ?? []

  // Overdue tasks
  const overdue = tasks.filter((t) => {
    if (!t.due_date || t.status === 'done' || t.status === 'completed') return false
    return new Date(t.due_date) < now
  })
  const criticalOverdue = overdue.filter((t) => t.priority === 'critical' || t.priority === 'high')
  if (criticalOverdue.length > 0) {
    findings.push({
      projectId: project.id, projectName: project.name,
      severity: criticalOverdue.length > 3 ? 'critical' : 'warning',
      category: 'overdue_task',
      title: `${criticalOverdue.length} critical/high-priority tasks overdue`,
      description: `${criticalOverdue.length} critical/high-priority task(s) overdue out of ${overdue.length} total overdue.`,
      impact: 'Delayed deliverables, cascading timeline effects',
      metrics: { overdueCount: overdue.length, criticalCount: criticalOverdue.length, totalTasks: tasks.length },
    })
  } else if (overdue.length > 0) {
    findings.push({
      projectId: project.id, projectName: project.name, severity: 'info',
      category: 'overdue_task',
      title: `${overdue.length} overdue tasks`,
      description: `${overdue.length} task(s) are past their due date.`,
      impact: 'Minor timeline slippage',
      metrics: { overdueCount: overdue.length, totalTasks: tasks.length },
    })
  }

  // Milestones at risk (due within 7 days, not completed)
  const atRisk = milestones.filter((m) => {
    if (!m.due_date || m.status === 'completed') return false
    const days = Math.ceil((new Date(m.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 7
  })
  if (atRisk.length > 0) {
    findings.push({
      projectId: project.id, projectName: project.name, severity: 'warning',
      category: 'milestone_at_risk',
      title: `${atRisk.length} milestone(s) due within 7 days`,
      description: atRisk.map((m) => `${m.name} (due: ${m.due_date})`).join(', '),
      impact: 'Missed milestones may delay client billing and project completion',
      metrics: { atRiskCount: atRisk.length, milestones: atRisk.map((m) => ({ name: m.name, dueDate: m.due_date })) },
    })
  }

  // Budget overruns
  if (project.budget && project.actual_cost && project.budget > 0) {
    const pct = (project.actual_cost / project.budget) * 100
    if (pct > 100) {
      findings.push({
        projectId: project.id, projectName: project.name, severity: 'critical',
        category: 'budget_overrun',
        title: `Budget exceeded — ${Math.round(pct)}% used`,
        description: `${project.actual_cost} spent against ${project.budget} budget. Over by ${project.actual_cost - project.budget}.`,
        impact: 'Reduced margins, potential loss',
        metrics: { budget: project.budget, actualCost: project.actual_cost, pctUsed: Math.round(pct), overBy: project.actual_cost - project.budget },
      })
    } else if (pct > 80) {
      findings.push({
        projectId: project.id, projectName: project.name, severity: 'warning',
        category: 'budget_overrun',
        title: `Budget running low — ${Math.round(pct)}% consumed`,
        description: `${Math.round(pct)}% of budget used (${project.actual_cost} / ${project.budget}).`,
        impact: 'May exceed budget at current burn rate',
        metrics: { budget: project.budget, actualCost: project.actual_cost, pctUsed: Math.round(pct) },
      })
    }
  }

  // Health score
  const hs = parseHealth(project.health)
  if (hs <= 30) {
    findings.push({
      projectId: project.id, projectName: project.name, severity: 'critical',
      category: 'health_drop',
      title: `Project health critical (${hs}/100)`,
      description: `Health score is critically low at ${hs}/100. Immediate attention required.`,
      impact: 'High risk of project failure',
      metrics: { healthScore: hs },
    })
  } else if (hs <= 50) {
    findings.push({
      projectId: project.id, projectName: project.name, severity: 'warning',
      category: 'health_drop',
      title: `Project health declining (${hs}/100)`,
      description: `Health score is ${hs}/100. Review and intervene.`,
      impact: 'May lead to missed deadlines or quality issues',
      metrics: { healthScore: hs },
    })
  }

  // Stalled
  if (project.updated_at) {
    const days = Math.floor((now.getTime() - new Date(project.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    if (days >= 14) {
      findings.push({
        projectId: project.id, projectName: project.name, severity: 'critical',
        category: 'stalled_project',
        title: `Stalled — ${days} days without update`,
        description: `No activity for ${days} days. May be blocked or deprioritized.`,
        impact: 'Loss of momentum, potential client churn',
        metrics: { daysSinceUpdate: days, lastUpdated: project.updated_at },
      })
    } else if (days >= 7) {
      findings.push({
        projectId: project.id, projectName: project.name, severity: 'warning',
        category: 'stalled_project',
        title: `No activity for ${days} days`,
        description: `Last update was ${days} days ago.`,
        impact: 'Risk of losing momentum',
        metrics: { daysSinceUpdate: days, lastUpdated: project.updated_at },
      })
    }
  }

  return findings
}

// ─── Orchestrator Task Creation ──────────────────────────────

async function createMonitorTask(
  supabase: SupabaseClient, userId: string, agent: AgentRow, finding: ProjectFinding
): Promise<string | null> {
  const priority = finding.severity === 'critical' ? 'high' : finding.severity === 'warning' ? 'medium' : 'low'
  const { data } = await supabase.from('orchestrator_tasks').insert([{
    user_id: userId, agent_id: agent.id,
    title: `[Monitor] ${finding.title}`,
    description: `Project: ${finding.projectName} (${finding.projectId})\n\n${finding.description}\n\nImpact: ${finding.impact}\nSeverity: ${finding.severity}\nCategory: ${finding.category}\n\nSuggested: Review and address.`,
    status: 'pending', priority,
  }]).select('id').single()
  if (!data) return null

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: 'monitor_finding_created', module: 'agents',
    entity_type: 'orchestrator_task', entity_id: data.id, status: 'success',
    message: `[${finding.severity.toUpperCase()}] ${finding.category}: ${finding.title}`,
  }])
  return data.id
}

// ─── Remediation Plan (DelegationPlan) ───────────────────────

function buildRemediationPlan(result: MonitorResult, agentId: string): DelegationPlan {
  return {
    id: `remediate-${Date.now()}`,
    description: `Remediate ${result.criticalFindings} critical project issue(s)`,
    steps: [
      {
        label: 'Assess Critical Issues',
        agentType: 'automation',
        agentId,
        instruction: `Review these ${result.criticalFindings} critical project findings and assess urgency. For each, determine: (1) immediate corrective action, (2) whether human approval is needed, (3) estimated effort to resolve.`,
      },
      {
        label: 'Generate Remediation Tasks',
        agentType: 'automation',
        agentId,
        instruction: 'Create detailed remediation tasks for each critical finding. Include clear instructions, suggested assignee, and deadline.',
      },
    ],
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function parseHealth(h: string | number | null): number {
  if (h == null) return 100
  if (typeof h === 'number') return Math.max(0, Math.min(100, h))
  const n = parseInt(h, 10)
  return isNaN(n) ? 100 : Math.max(0, Math.min(100, n))
}

function withTime(r: MonitorResult, start: number): MonitorResult {
  r.duration_ms = Date.now() - start
  return r
}
