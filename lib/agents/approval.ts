/**
 * Approval Gate — Autonomy & Safety Layer
 *
 * Maps agent actions to autonomy levels and determines whether
 * an action can proceed automatically or requires human approval.
 *
 * Reuses the Autonomous Execution Engine design from docs/autonomous-execution.md.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentRow } from '@/lib/supabase/agents'

// ─── Types ───────────────────────────────────────────────────

export type AutonomyLevel = 1 | 2 | 3 | 4
export type ActionImpact = 'low' | 'medium' | 'high' | 'critical'

export interface AutonomyCheckParams {
  action: string
  targetType: string
  taskId?: string
  budgetAmount?: number
  timelineDays?: number
  clientFacing?: boolean
  metadata?: Record<string, any>
}

export interface AutonomyCheckResult {
  status: 'auto_approve' | 'needs_approval'
  action: string
  reason?: string
  impact?: ActionImpact
  systemPromptOverride?: string
  proposedChange?: Record<string, any>
  currentState?: Record<string, any>
}

// ─── Action → Impact Mapping ────────────────────────────────

interface ActionRule {
  impact: ActionImpact
  requiredLevel: AutonomyLevel   // minimum autonomy level to auto-approve
  clientFacingRisk: boolean
  description: string
}

const ACTION_RULES: Record<string, ActionRule> = {
  // ─── Project & Timeline ──────────────────────────────────
  schedule_change:      { impact: 'medium',   requiredLevel: 3, clientFacingRisk: true,  description: 'Modify project timeline or deadlines' },
  project_update:       { impact: 'low',      requiredLevel: 2, clientFacingRisk: false, description: 'Update project status or metadata' },
  milestone_update:     { impact: 'medium',   requiredLevel: 3, clientFacingRisk: true,  description: 'Create or modify milestones' },

  // ─── Financial ───────────────────────────────────────────
  budget_change:        { impact: 'high',     requiredLevel: 4, clientFacingRisk: true,  description: 'Change project budget or cost' },
  financial_action:     { impact: 'high',     requiredLevel: 4, clientFacingRisk: true,  description: 'Send invoice, charge, or payment action' },
  expense_approval:     { impact: 'medium',   requiredLevel: 3, clientFacingRisk: false, description: 'Approve or reject an expense' },

  // ─── Client Communication ────────────────────────────────
  client_communication: { impact: 'high',     requiredLevel: 4, clientFacingRisk: true,  description: 'Send email or message to a client' },
  client_status_update: { impact: 'low',      requiredLevel: 2, clientFacingRisk: true,  description: 'Share routine status update with client' },

  // ─── Destructive ─────────────────────────────────────────
  delete_entity:        { impact: 'critical', requiredLevel: 4, clientFacingRisk: true,  description: 'Delete a record or entity' },
  cancel_project:       { impact: 'critical', requiredLevel: 4, clientFacingRisk: true,  description: 'Cancel or archive a project' },

  // ─── General ─────────────────────────────────────────────
  general_action:       { impact: 'low',      requiredLevel: 2, clientFacingRisk: false, description: 'General task or action' },
  ad_hoc_execution:     { impact: 'low',      requiredLevel: 2, clientFacingRisk: false, description: 'Ad-hoc agent execution' },
  monitoring_alert:     { impact: 'low',      requiredLevel: 2, clientFacingRisk: false, description: 'Monitoring check or alert' },
}

// ─── Autonomy Check ─────────────────────────────────────────

/**
 * Check whether an agent can autonomously perform an action.
 *
 * Three factors determine the result:
 * 1. The action's inherent risk (its ActionRule)
 * 2. The agent's configured autonomy level (from config)
 * 3. Whether the action is client-facing
 */
export async function checkAutonomy(
  _supabase: SupabaseClient,
  _userId: string,
  agent: AgentRow,
  params: AutonomyCheckParams
): Promise<AutonomyCheckResult> {
  const rule = ACTION_RULES[params.action] || ACTION_RULES.general_action
  const agentLevel = getAgentAutonomyLevel(agent)
  const requiresApprovalList = getRequiresApprovalList(agent)

  // Critical actions always require approval
  if (rule.impact === 'critical') {
    return {
      status: 'needs_approval',
      action: params.action,
      reason: `"${rule.description}" is a critical action requiring human approval.`,
      impact: 'critical',
      proposedChange: params.metadata,
    }
  }

  // Explicitly blacklisted actions for this agent
  if (requiresApprovalList.includes(params.action)) {
    return {
      status: 'needs_approval',
      action: params.action,
      reason: `"${rule.description}" is configured to require approval for this agent.`,
      impact: rule.impact,
      proposedChange: params.metadata,
    }
  }

  // Client-facing high-impact actions need Level 4+
  if (rule.clientFacingRisk && rule.impact === 'high' && agentLevel < 4) {
    return {
      status: 'needs_approval',
      action: params.action,
      reason: `${rule.description} — client-facing high-impact action requires higher autonomy level (agent is Level ${agentLevel}, needs Level 4).`,
      impact: 'high',
      proposedChange: params.metadata,
    }
  }

  // Agent level must meet or exceed required level
  if (agentLevel < rule.requiredLevel) {
    return {
      status: 'needs_approval',
      action: params.action,
      reason: `${rule.description} — agent autonomy Level ${agentLevel} insufficient, needs Level ${rule.requiredLevel}.`,
      impact: rule.impact,
      proposedChange: params.metadata,
    }
  }

  // High-risk action with no problem — include system prompt override
  // warning so the LLM knows it's operating near limits
  if (rule.impact === 'high') {
    return {
      status: 'auto_approve',
      action: params.action,
      impact: 'high',
      systemPromptOverride: `You are operating at maximum autonomy. This action (${rule.description}) is high-impact. Be thorough, double-check your reasoning, and log every step.`,
      proposedChange: params.metadata,
    }
  }

  // Default: auto-approve
  return {
    status: 'auto_approve',
    action: params.action,
    impact: rule.impact,
    proposedChange: params.metadata,
  }
}

// ─── Approval Request Mutations ─────────────────────────────

export async function resolveApproval(
  supabase: SupabaseClient,
  approvalId: string,
  userId: string,
  decision: 'approved' | 'rejected',
  reasoning?: string
): Promise<void> {
  // Fetch the request
  const { data: req, error } = await supabase
    .from('agent_approval_requests')
    .select('*')
    .eq('id', approvalId)
    .eq('user_id', userId)
    .single()
  if (error || !req) throw new Error('Approval request not found')
  if (req.status !== 'pending') throw new Error('Approval request already resolved')

  // Update the request
  await supabase.from('agent_approval_requests').update({
    status: decision,
    reasoning: reasoning || null,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', approvalId)

  // If approved, resume the task
  if (decision === 'approved' && req.task_id) {
    await supabase.from('orchestrator_tasks').update({
      status: 'assigned',
      updated_at: new Date().toISOString(),
    }).eq('id', req.task_id)

    // Log
    await supabase.from('execution_logs').insert([{
      user_id: userId,
      command_id: null,
      action: 'approval_granted',
      module: 'agents',
      entity_type: 'agent_approval_requests',
      entity_id: approvalId,
      status: 'success',
      message: `Approved: "${req.summary}"`,
    }])
  } else if (decision === 'rejected' && req.task_id) {
    // Mark the task as failed with context
    await supabase.from('orchestrator_tasks').update({
      status: 'failed',
      result: `Rejected: ${reasoning || 'No reason provided'}`,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', req.task_id)

    await supabase.from('execution_logs').insert([{
      user_id: userId,
      command_id: null,
      action: 'approval_rejected',
      module: 'agents',
      entity_type: 'agent_approval_requests',
      entity_id: approvalId,
      status: 'success',
      message: `Rejected: "${req.summary}" — ${reasoning || 'No reason'}`,
    }])
  }
}

export async function fetchPendingApprovals(
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('agent_approval_requests')
    .select('*, agents!agent_approval_requests_agent_id_fkey(name, type)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    ...r,
    agent_name: r.agents?.name ?? null,
    agent_type: r.agents?.type ?? null,
  }))
}

// ─── Helpers ─────────────────────────────────────────────────

function getAgentAutonomyLevel(agent: AgentRow): AutonomyLevel {
  const config = agent.config as Record<string, any> | null
  if (config?.autonomy?.level) {
    const level = Number(config.autonomy.level)
    if (level >= 1 && level <= 4) return level as AutonomyLevel
  }
  // Default: Level 2 (execute with logging) for most agents
  if (agent.performance_score >= 80) return 3
  if (agent.performance_score >= 60) return 2
  return 1
}

function getRequiresApprovalList(agent: AgentRow): string[] {
  const config = agent.config as Record<string, any> | null
  return config?.autonomy?.requires_approval_for ?? []
}
