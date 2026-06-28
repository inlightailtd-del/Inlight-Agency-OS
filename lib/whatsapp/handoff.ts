import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { IntegrationSDK } from '@/lib/integrations/sdk'
import type { WhatsAppMessage } from './conversations'

export type HandoffReason = 'complex_query' | 'complaint' | 'technical_support' | 'pricing_negotiation' | 'escalation_request' | 'sentiment_triggers' | 'manual_request'
export type HandoffStatus = 'pending' | 'accepted' | 'active' | 'resolved' | 'rejected' | 'expired'

export interface HumanHandoffRequest {
  id: string
  userId: string
  contactWaId: string
  contactName?: string
  contactPhone: string
  reason: HandoffReason
  summary: string
  conversationHistory: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: HandoffStatus
  assignedTo?: string
  assignedAt?: string
  resolvedAt?: string
  resolution?: string
  createdAt: string
  updatedAt: string
}

const HANDOFF_THRESHOLDS = {
  negativeSentimentCount: 2,
  repetitionThreshold: 3,
  maxAutoTurns: 8,
  escalationKeywords: ['manager', 'supervisor', 'human', 'real person', 'speak to someone', 'agent', 'complaint', 'refund', 'cancel account', 'legal', 'talk to a human'],
}

export async function shouldHandoffToHuman(
  supabase: SupabaseClient,
  userId: string,
  messages: WhatsAppMessage[]
): Promise<{ shouldHandoff: boolean; reason?: HandoffReason; summary: string; priority: string } | null> {
  const recent = messages.slice(-10)
  const incoming = recent.filter(m => m.isIncoming)
  const conversationText = recent.map(m => `${m.isIncoming ? 'Customer' : 'AI'}: ${m.body}`).join('\n')

  const manualRequest = incoming.some(m => {
    const lower = m.body.toLowerCase()
    return HANDOFF_THRESHOLDS.escalationKeywords.some(k => lower.includes(k))
  })

  if (manualRequest) {
    return {
      shouldHandoff: true, reason: 'manual_request',
      summary: 'Customer requested to speak with a human agent.',
      priority: 'high',
    }
  }

  const negativeMessages = incoming.filter(m => {
    const lower = m.body.toLowerCase()
    const negativeWords = ['bad', 'terrible', 'awful', 'frustrated', 'angry', 'unhappy', 'disappointed', 'worst', 'horrible', 'useless', 'waste', 'scam', 'liar', 'unacceptable', 'ridiculous']
    return negativeWords.some(w => lower.includes(w))
  })

  if (negativeMessages.length >= HANDOFF_THRESHOLDS.negativeSentimentCount) {
    return {
      shouldHandoff: true, reason: 'sentiment_triggers',
      summary: 'Customer expressed negative sentiment multiple times.',
      priority: 'high',
    }
  }

  if (incoming.length >= HANDOFF_THRESHOLDS.maxAutoTurns) {
    const uniqueQuestions = new Set(incoming.map(m => m.body.toLowerCase()))
    if (uniqueQuestions.size <= HANDOFF_THRESHOLDS.repetitionThreshold) {
      return {
        shouldHandoff: true, reason: 'complex_query',
        summary: 'Automated responses may not be resolving the issue after extended conversation.',
        priority: 'medium',
      }
    }
  }

  const systemPrompt = `You are a handoff decision engine. Analyze if this conversation needs human intervention. Return JSON: {"shouldHandoff": boolean, "reason": "complex_query|complaint|technical_support|pricing_negotiation|sentiment_triggers|other", "summary": "string", "priority": "low|medium|high|urgent", "confidence": 0-1}`
  const result = await executeAgentTask(supabase, userId, null,
    `Analyze this WhatsApp conversation for handoff triggers:\n\n${conversationText}\n\nShould this be handed off to a human agent?`, { systemPrompt }
  )

  let parsed: any = {}
  try { parsed = JSON.parse(result.response || '{}') } catch {}

  if (parsed.shouldHandoff && parsed.confidence > 0.6) {
    return {
      shouldHandoff: true,
      reason: parsed.reason || 'complex_query',
      summary: parsed.summary || 'AI recommended handoff.',
      priority: parsed.priority || 'medium',
    }
  }

  return null
}

export async function createHandoffRequest(
  supabase: SupabaseClient,
  userId: string,
  contactWaId: string,
  contactPhone: string,
  reason: HandoffReason,
  summary: string,
  messages: WhatsAppMessage[],
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  contactName?: string
): Promise<HumanHandoffRequest> {
  const conversationHistory = messages.map(m =>
    `${m.isIncoming ? 'Customer' : 'AI'} [${m.timestamp}]: ${m.body}`
  ).join('\n')

  const { data, error } = await supabase.from('whatsapp_handoffs').insert([{
    user_id: userId, contact_wa_id: contactWaId,
    contact_name: contactName, contact_phone: contactPhone,
    reason, summary, conversation_history: conversationHistory,
    priority, status: 'pending',
  }]).select().single()
  if (error) throw error
  const r = data as any

  const sdk = new IntegrationSDK(supabase, userId)
  await sdk.executeAction('whatsapp', 'send_text', {
    to: contactWaId,
    text: 'Thank you for your patience. I\'m connecting you with a human agent who can better assist you. Please hold on while I transfer your conversation.',
  })

  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: ['handoff', contactWaId, reason],
    content: { handoffId: r.id, contactWaId, reason, summary, priority, status: 'pending' },
  })

  return {
    id: r.id, userId: r.user_id, contactWaId: r.contact_wa_id,
    contactName: r.contact_name, contactPhone: r.contact_phone,
    reason: r.reason, summary: r.summary,
    conversationHistory: r.conversation_history,
    priority: r.priority, status: r.status,
    assignedTo: r.assigned_to, assignedAt: r.assigned_at,
    resolvedAt: r.resolved_at, resolution: r.resolution,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export async function assignHandoff(
  supabase: SupabaseClient,
  userId: string,
  handoffId: string,
  agentName: string
): Promise<void> {
  await supabase.from('whatsapp_handoffs').update({
    status: 'accepted', assigned_to: agentName,
    assigned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', handoffId).eq('user_id', userId)
}

export async function resolveHandoff(
  supabase: SupabaseClient,
  userId: string,
  handoffId: string,
  resolution: string
): Promise<void> {
  await supabase.from('whatsapp_handoffs').update({
    status: 'resolved', resolution,
    resolved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', handoffId).eq('user_id', userId)
}

export async function getPendingHandoffs(
  supabase: SupabaseClient,
  userId: string
): Promise<HumanHandoffRequest[]> {
  const { data } = await supabase
    .from('whatsapp_handoffs')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'accepted', 'active'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  return ((data ?? []) as any[]).map(r => ({
    id: r.id, userId: r.user_id, contactWaId: r.contact_wa_id,
    contactName: r.contact_name, contactPhone: r.contact_phone,
    reason: r.reason, summary: r.summary,
    conversationHistory: r.conversation_history,
    priority: r.priority, status: r.status,
    assignedTo: r.assigned_to, assignedAt: r.assigned_at,
    resolvedAt: r.resolved_at, resolution: r.resolution,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }))
}

export async function autoTriggerHandoff(
  supabase: SupabaseClient,
  userId: string,
  waId: string,
  phone: string,
  messages: WhatsAppMessage[],
  contactName?: string
): Promise<HumanHandoffRequest | null> {
  const decision = await shouldHandoffToHuman(supabase, userId, messages)
  if (!decision?.shouldHandoff) return null

  const existingHandoffs = await getPendingHandoffs(supabase, userId)
  const alreadyPending = existingHandoffs.find(h => h.contactWaId === waId)
  if (alreadyPending) return alreadyPending

  return createHandoffRequest(
    supabase, userId, waId, phone,
    decision.reason as HandoffReason || 'complex_query',
    decision.summary, messages,
    decision.priority as 'low' | 'medium' | 'high' | 'urgent' || 'medium',
    contactName,
  )
}

export async function sendManualMessage(
  supabase: SupabaseClient,
  userId: string,
  handoffId: string,
  message: string
): Promise<void> {
  const { data: handoff } = await supabase.from('whatsapp_handoffs').select('contact_wa_id').eq('id', handoffId).single()
  if (!handoff) throw new Error('Handoff not found')

  const sdk = new IntegrationSDK(supabase, userId)
  await sdk.executeAction('whatsapp', 'send_text', {
    to: (handoff as any).contact_wa_id, text: message,
  })
}
