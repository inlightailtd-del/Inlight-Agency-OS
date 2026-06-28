import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationSDK } from '@/lib/integrations/sdk'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type WhatsAppMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'interactive' | 'template' | 'order' | 'system' | 'unknown'

export interface WhatsAppContact {
  waId: string
  name?: string
  phone: string
  profileName?: string
  lastMessageAt?: string
  unreadCount: number
  isBusiness?: boolean
}

export interface WhatsAppMessage {
  id: string
  waMessageId: string
  from: string
  to: string
  type: WhatsAppMessageType
  body: string
  timestamp: string
  isIncoming: boolean
  status: 'sent' | 'delivered' | 'read' | 'failed'
  metadata?: Record<string, any>
}

export interface WhatsAppConversation {
  id: string
  contactWaId: string
  contactName?: string
  contactPhone: string
  lastMessage: string
  lastMessageAt: string
  lastMessageType: WhatsAppMessageType
  unreadCount: number
  isArchived: boolean
  isMuted: boolean
  assignedAgent?: string
  label?: string
}

export async function sendWhatsAppMessage(
  supabase: SupabaseClient,
  userId: string,
  to: string,
  content: { type: WhatsAppMessageType; body: string; mediaId?: string; previewUrl?: boolean; caption?: string },
  contextMessageId?: string
): Promise<WhatsAppMessage> {
  const sdk = new IntegrationSDK(supabase, userId)
  const result = await sdk.executeAction('whatsapp', 'send_text', {
    to, text: content.body, previewUrl: content.previewUrl,
    contextMessageId,
  })

  const message: WhatsAppMessage = {
    id: `msg_${Date.now()}`,
    waMessageId: result.data?.messages?.[0]?.id || `wa_${Date.now()}`,
    from: 'bot',
    to, type: content.type,
    body: content.body,
    timestamp: new Date().toISOString(),
    isIncoming: false,
    status: 'sent',
  }

  await supabase.from('conversations').upsert({
    user_id: userId, contact_wa_id: to, contact_phone: to,
    last_message: message.body, last_message_at: message.timestamp,
    last_message_type: message.type, unread_count: 0,
    updated_at: message.timestamp,
  }, { onConflict: 'user_id,contact_wa_id' })

  await supabase.from('messages').insert([{
    user_id: userId, wa_message_id: message.waMessageId,
    from_number: message.from, to_number: message.to,
    type: message.type, body: message.body,
    timestamp: message.timestamp, is_incoming: false,
    status: 'sent',
  }])

  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: [to, 'outgoing'],
    content: { type: 'message_sent', to, body: message.body, messageId: message.id, timestamp: message.timestamp },
  })

  return message
}

export async function receiveWhatsAppMessage(
  supabase: SupabaseClient,
  userId: string,
  payload: { from: string; messageId: string; type: string; text?: string; timestamp: string; name?: string }
): Promise<WhatsAppMessage> {
  const message: WhatsAppMessage = {
    id: `msg_${Date.now()}`,
    waMessageId: payload.messageId,
    from: payload.from,
    to: 'bot',
    type: (payload.type as WhatsAppMessageType) || 'unknown',
    body: payload.text || '',
    timestamp: payload.timestamp || new Date().toISOString(),
    isIncoming: true,
    status: 'delivered',
  }

  await supabase.from('conversations').upsert({
    user_id: userId, contact_wa_id: payload.from,
    contact_name: payload.name, contact_phone: payload.from,
    last_message: message.body, last_message_at: message.timestamp,
    last_message_type: message.type,
    unread_count: supabase.rpc('increment_unread', { row_id: payload.from }),
    updated_at: message.timestamp,
  }, { onConflict: 'user_id,contact_wa_id' })

  await supabase.from('messages').insert([{
    user_id: userId, wa_message_id: message.waMessageId,
    from_number: message.from, to_number: 'bot',
    type: message.type, body: message.body,
    timestamp: message.timestamp, is_incoming: true,
    status: 'delivered',
  }])

  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: [payload.from, 'incoming'],
    content: { type: 'message_received', from: payload.from, body: message.body, messageId: message.id, timestamp: message.timestamp },
  })

  return message
}

export async function getConversations(
  supabase: SupabaseClient,
  userId: string,
  opts?: { limit?: number; archived?: boolean; label?: string; search?: string }
): Promise<WhatsAppConversation[]> {
  let q = supabase.from('conversations').select('*').eq('user_id', userId).eq('is_archived', opts?.archived ?? false)
  if (opts?.label) q = q.eq('label', opts.label)
  if (opts?.search) q = q.or(`contact_name.ilike.%${opts.search}%,contact_phone.ilike.%${opts.search}%,last_message.ilike.%${opts.search}%`)
  q = q.order('last_message_at', { ascending: false }).limit(opts?.limit || 50)
  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    id: r.id, contactWaId: r.contact_wa_id,
    contactName: r.contact_name, contactPhone: r.contact_phone,
    lastMessage: r.last_message, lastMessageAt: r.last_message_at,
    lastMessageType: r.last_message_type, unreadCount: r.unread_count || 0,
    isArchived: r.is_archived || false, isMuted: r.is_muted || false,
    assignedAgent: r.assigned_agent, label: r.label,
  }))
}

export async function getConversationMessages(
  supabase: SupabaseClient,
  userId: string,
  contactWaId: string,
  limit = 50
): Promise<WhatsAppMessage[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .or(`from_number.eq.${contactWaId},to_number.eq.${contactWaId}`)
    .order('timestamp', { ascending: false })
    .limit(limit)

  return ((data ?? []) as any[]).map(r => ({
    id: r.id, waMessageId: r.wa_message_id,
    from: r.from_number, to: r.to_number,
    type: r.type, body: r.body,
    timestamp: r.timestamp, isIncoming: r.is_incoming,
    status: r.status,
  })).reverse()
}

export async function markConversationRead(
  supabase: SupabaseClient,
  userId: string,
  contactWaId: string
): Promise<void> {
  await supabase.from('conversations').update({
    unread_count: 0, updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('contact_wa_id', contactWaId)
}

export async function archiveConversation(
  supabase: SupabaseClient,
  userId: string,
  contactWaId: string,
  archived = true
): Promise<void> {
  await supabase.from('conversations').update({
    is_archived: archived, updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('contact_wa_id', contactWaId)
}

export async function assignConversationAgent(
  supabase: SupabaseClient,
  userId: string,
  contactWaId: string,
  agentName: string
): Promise<void> {
  await supabase.from('conversations').update({
    assigned_agent: agentName, updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('contact_wa_id', contactWaId)
}

export async function labelConversation(
  supabase: SupabaseClient,
  userId: string,
  contactWaId: string,
  label: string
): Promise<void> {
  await supabase.from('conversations').update({
    label, updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('contact_wa_id', contactWaId)
}

export async function classifyIncomingMessage(
  supabase: SupabaseClient,
  userId: string,
  message: WhatsAppMessage,
  conversationHistory?: WhatsAppMessage[]
): Promise<{ intent: string; sentiment: string; requiresResponse: boolean; suggestedAction: string; confidence: number }> {
  const recentHistory = (conversationHistory || []).slice(-5).map(m => `${m.isIncoming ? 'Prospect' : 'AI'}: ${m.body}`).join('\n')
  const systemPrompt = `You are a WhatsApp conversation classifier. Analyze the message and return JSON: {"intent": "greeting|question|complaint|purchase|support|meeting_request|objection|chitchat|spam|other", "sentiment": "positive|neutral|negative|urgent", "requiresResponse": boolean, "suggestedAction": "reply_auto|escalate_human|schedule_meeting|qualify_lead|send_catalog|transfer_department|close", "confidence": 0-1}`
  const result = await executeAgentTask(supabase, userId, null,
    `Message from ${message.from}: "${message.body}"\n\nRecent conversation:\n${recentHistory}\n\nClassify this message.`, { systemPrompt }
  )

  let parsed: any = {}
  try { parsed = JSON.parse(result.response || '{}') } catch {}
  return {
    intent: parsed.intent || 'other',
    sentiment: parsed.sentiment || 'neutral',
    requiresResponse: parsed.requiresResponse ?? true,
    suggestedAction: parsed.suggestedAction || 'reply_auto',
    confidence: parsed.confidence || 0.5,
  }
}
