import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type ApprovalType = 'budget' | 'campaign' | 'creative' | 'proposal' | 'hire' | 'purchase' | 'strategy' | 'contract'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired'
export type ApprovalVoiceAction = 'approve' | 'reject' | 'escalate' | 'ask_more' | 'defer'

export interface VoiceApproval {
  id: string
  userId: string
  type: ApprovalType
  title: string
  description: string
  amount?: number
  risk: 'low' | 'medium' | 'high'
  requestedBy: string
  contextUrl?: string
  status: ApprovalStatus
  voiceAction?: ApprovalVoiceAction
  voiceNote?: string
  decidedAt?: string
  createdAt: string
}

const APPROVAL_PROMPTS: Record<ApprovalType, string> = {
  budget: 'Voice approval needed: Budget allocation of ${amount} for {title}. Current burn rate: {metrics}.',
  campaign: 'Voice approval needed: Launch ad campaign "{title}" with ${amount} budget targeting {audience}.',
  creative: 'Voice approval needed: Publish creative variant for campaign "{title}". A/B test results: {metrics}.',
  proposal: 'Voice approval needed: Send proposal to {client} for ${amount}. Deal stage: {stage}.',
  hire: 'Voice approval needed: Hire {role} at ${amount}/yr. Department: {dept}. Current team size: {size}.',
  purchase: 'Voice approval needed: Purchase {tool} for ${amount}. Department: {dept}. Alternatives: {alts}.',
  strategy: 'Voice approval needed: Strategy change for {area}. Impact: {impact}. Risk level: {risk}.',
  contract: 'Voice approval needed: Sign contract with {partner} for ${amount}. Terms: {terms}.',
}

export async function createVoiceApproval(
  supabase: SupabaseClient,
  userId: string,
  type: ApprovalType,
  title: string,
  description: string,
  amount?: number,
  risk: 'low' | 'medium' | 'high' = 'medium',
  requestedBy: string = 'AI Agent'
): Promise<VoiceApproval> {
  const approval: VoiceApproval = {
    id: 'va_' + Date.now(),
    userId, type, title, description,
    amount, risk, requestedBy,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  await supabase.from('voice_approvals').insert([{
    id: approval.id, user_id: userId, type, title, description,
    amount, risk, requested_by: requestedBy,
    status: 'pending', created_at: approval.createdAt,
  }])

  await storeMemory(supabase, userId, {
    category: 'voice_learning', tags: ['approval', type, risk],
    content: { approvalId: approval.id, type, title, amount, risk, status: 'pending', createdAt: approval.createdAt },
  })

  return approval
}

export async function processVoiceApproval(
  supabase: SupabaseClient,
  userId: string,
  approvalId: string,
  voiceCommand: string
): Promise<{ approval: VoiceApproval | null; response: string }> {
  const { data: record } = await supabase.from('voice_approvals').select('*').eq('id', approvalId).single()
  if (!record) return { approval: null, response: 'Approval request not found.' }

  const approval = record as any
  const systemPrompt = `You are a voice approval processor. Parse the voice command and determine the action. Return JSON: {"action": "approve|reject|escalate|ask_more|defer", "note": "string", "confidence": 0-1, "reasoning": "string"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Approval request: "${approval.title}" (${approval.type}, $${approval.amount || 0}, risk: ${approval.risk}). Voice command: "${voiceCommand}". Determine if the user approved, rejected, or wants more info.`, { systemPrompt }
  )

  let parsed: any = {}
  try { parsed = JSON.parse(result.response || '{}') } catch { return { approval: null, response: 'Could not process voice command.' } }

  const action: ApprovalVoiceAction = parsed.action || 'defer'
  const note = parsed.note || ''
  const statusMap: Record<string, ApprovalStatus> = {
    approve: 'approved', reject: 'rejected',
    escalate: 'escalated', ask_more: 'pending', defer: 'pending',
  }

  await supabase.from('voice_approvals').update({
    status: statusMap[action] || 'pending',
    voice_action: action, voice_note: note,
    decided_at: new Date().toISOString(),
  }).eq('id', approvalId)

  const updated: VoiceApproval = {
    id: approval.id, userId: approval.user_id,
    type: approval.type, title: approval.title,
    description: approval.description,
    amount: approval.amount, risk: approval.risk,
    requestedBy: approval.requested_by,
    status: statusMap[action] || 'pending',
    voiceAction: action, voiceNote: note,
    decidedAt: new Date().toISOString(),
    createdAt: approval.created_at,
  }

  const responseText = action === 'approve' ? `✅ Approved: ${approval.title}` :
    action === 'reject' ? `❌ Rejected: ${approval.title}. ${note}` :
    action === 'escalate' ? `⬆️ Escalated: ${approval.title}` :
    action === 'ask_more' ? `🤔 Let me get more details on: ${approval.title}` :
    `⏸️ Deferred: ${approval.title}`

  await storeMemory(supabase, userId, {
    category: 'voice_learning', tags: ['approval', action, approval.type],
    content: { approvalId, action, note, status: statusMap[action], decidedAt: updated.decidedAt },
  })

  return { approval: updated, response: responseText }
}

export async function getPendingApprovals(
  supabase: SupabaseClient,
  userId: string
): Promise<VoiceApproval[]> {
  const { data: records } = await supabase
    .from('voice_approvals')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending'])
    .order('created_at', { ascending: false })
    .limit(20)

  return ((records ?? []) as any[]).map(r => ({
    id: r.id, userId: r.user_id, type: r.type,
    title: r.title, description: r.description,
    amount: r.amount, risk: r.risk,
    requestedBy: r.requested_by, status: r.status,
    createdAt: r.created_at,
  }))
}

export async function readApprovalsAloud(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const pending = await getPendingApprovals(supabase, userId)
  if (pending.length === 0) {
    const { data: recent } = await supabase.from('voice_approvals').select('title, status, decided_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5)
    const recentItems = (recent ?? []) as any[]
    if (recentItems.length === 0) return 'No approval history found.'
    return `No pending approvals. Recent activity: ${recentItems.map(r => `${r.title}: ${r.status}`).join('. ')}.`
  }

  const systemPrompt = 'You are a voice assistant. Convert pending approvals into natural spoken narration. Return as plain text, conversational.'
  const result = await executeAgentTask(supabase, userId, null,
    `Read these ${pending.length} pending approvals aloud in a natural, conversational way:\n${pending.map(a => `- ${a.type}: ${a.title}${a.amount ? ` ($${a.amount})` : ''} [${a.risk} risk, requested by ${a.requestedBy}]`).join('\n')}\n\nAsk if they want to approve, reject, or hear details on any.`, { systemPrompt }
  )

  return result.response || `You have ${pending.length} pending approvals. Say "read approvals" to hear them.`
}
