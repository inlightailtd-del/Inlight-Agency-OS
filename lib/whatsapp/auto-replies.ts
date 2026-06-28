import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { IntegrationSDK } from '@/lib/integrations/sdk'
import type { WhatsAppMessage } from './conversations'
import { classifyIncomingMessage } from './conversations'

export type AutoReplyTrigger = 'keyword' | 'intent' | 'regex' | 'template' | 'schedule' | 'webhook'
export type AutoReplyStatus = 'active' | 'paused' | 'draft' | 'archived'

export interface AutoReplyRule {
  id: string
  userId: string
  name: string
  trigger: AutoReplyTrigger
  triggerValue: string | string[]
  response: string
  responseType: 'text' | 'template' | 'interactive' | 'media' | 'ai_generated'
  mediaId?: string
  templateName?: string
  matchMode: 'exact' | 'contains' | 'starts_with' | 'regex'
  priority: number
  cooldownMinutes: number
  status: AutoReplyStatus
  createdAt: string
  updatedAt: string
  usageCount: number
}

export const DEFAULT_REPLIES: Omit<AutoReplyRule, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
  {
    userId: '', name: 'Greeting', trigger: 'keyword',
    triggerValue: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'hola'],
    response: 'Hi there! Welcome to our agency. How can I help you today?',
    responseType: 'text', matchMode: 'contains',
    priority: 1, cooldownMinutes: 60,
    status: 'active',
  },
  {
    userId: '', name: 'Business Hours', trigger: 'keyword',
    triggerValue: ['hours', 'open', 'when', 'available', 'business hours'],
    response: 'Our business hours are Monday to Friday, 9 AM to 6 PM EST. We typically respond within 2-4 hours during business hours.',
    responseType: 'text', matchMode: 'contains',
    priority: 3, cooldownMinutes: 30,
    status: 'active',
  },
  {
    userId: '', name: 'Pricing Inquiry', trigger: 'intent',
    triggerValue: ['pricing', 'cost', 'price', 'how much', 'rates', 'budget'],
    response: 'Thanks for your interest! I\'d be happy to discuss our pricing options. Could you tell me a bit more about what services you\'re looking for so I can provide a tailored quote?',
    responseType: 'text', matchMode: 'contains',
    priority: 5, cooldownMinutes: 1440,
    status: 'active',
  },
  {
    userId: '', name: 'Meeting Request', trigger: 'intent',
    triggerValue: ['meeting', 'call', 'book', 'schedule', 'appointment', 'consultation'],
    response: 'I\'d love to schedule a call with you! Let me check our availability. Could you let me know what days work best for you and a preferred time?',
    responseType: 'text', matchMode: 'contains',
    priority: 4, cooldownMinutes: 1440,
    status: 'active',
  },
  {
    userId: '', name: 'Thank You', trigger: 'keyword',
    triggerValue: ['thank', 'thanks', 'appreciate', 'grateful'],
    response: 'You\'re very welcome! Is there anything else I can help you with?',
    responseType: 'text', matchMode: 'contains',
    priority: 2, cooldownMinutes: 30,
    status: 'active',
  },
  {
    userId: '', name: 'Goodbye', trigger: 'keyword',
    triggerValue: ['bye', 'goodbye', 'see you', 'take care', 'talk later'],
    response: 'Thanks for reaching out! Have a great day. Feel free to message us anytime.',
    responseType: 'text', matchMode: 'contains',
    priority: 2, cooldownMinutes: 60,
    status: 'active',
  },
]

export async function getAutoReplies(
  supabase: SupabaseClient,
  userId: string
): Promise<AutoReplyRule[]> {
  const { data } = await supabase
    .from('whatsapp_auto_replies')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: true })
  return ((data ?? []) as any[]).map(r => ({
    id: r.id, userId: r.user_id, name: r.name,
    trigger: r.trigger, triggerValue: r.trigger_value,
    response: r.response, responseType: r.response_type,
    mediaId: r.media_id, templateName: r.template_name,
    matchMode: r.match_mode, priority: r.priority,
    cooldownMinutes: r.cooldown_minutes, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
    usageCount: r.usage_count || 0,
  }))
}

export async function createAutoReply(
  supabase: SupabaseClient,
  userId: string,
  rule: Omit<AutoReplyRule, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>
): Promise<AutoReplyRule> {
  const { data, error } = await supabase.from('whatsapp_auto_replies').insert([{
    user_id: userId, name: rule.name,
    trigger: rule.trigger, trigger_value: rule.triggerValue,
    response: rule.response, response_type: rule.responseType,
    media_id: rule.mediaId, template_name: rule.templateName,
    match_mode: rule.matchMode, priority: rule.priority,
    cooldown_minutes: rule.cooldownMinutes, status: rule.status,
  }]).select().single()
  if (error) throw error
  const r = data as any
  return {
    id: r.id, userId: r.user_id, name: r.name,
    trigger: r.trigger, triggerValue: r.trigger_value,
    response: r.response, responseType: r.response_type,
    mediaId: r.media_id, templateName: r.template_name,
    matchMode: r.match_mode, priority: r.priority,
    cooldownMinutes: r.cooldown_minutes, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
    usageCount: r.usage_count || 0,
  }
}

export async function updateAutoReply(
  supabase: SupabaseClient,
  userId: string,
  ruleId: string,
  updates: Partial<AutoReplyRule>
): Promise<void> {
  const dbUpdates: Record<string, any> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.trigger !== undefined) dbUpdates.trigger = updates.trigger
  if (updates.triggerValue !== undefined) dbUpdates.trigger_value = updates.triggerValue
  if (updates.response !== undefined) dbUpdates.response = updates.response
  if (updates.responseType !== undefined) dbUpdates.response_type = updates.responseType
  if (updates.mediaId !== undefined) dbUpdates.media_id = updates.mediaId
  if (updates.templateName !== undefined) dbUpdates.template_name = updates.templateName
  if (updates.matchMode !== undefined) dbUpdates.match_mode = updates.matchMode
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority
  if (updates.cooldownMinutes !== undefined) dbUpdates.cooldown_minutes = updates.cooldownMinutes
  if (updates.status !== undefined) dbUpdates.status = updates.status
  dbUpdates.updated_at = new Date().toISOString()
  await supabase.from('whatsapp_auto_replies').update(dbUpdates).eq('id', ruleId).eq('user_id', userId)
}

export async function deleteAutoReply(
  supabase: SupabaseClient,
  userId: string,
  ruleId: string
): Promise<void> {
  await supabase.from('whatsapp_auto_replies').delete().eq('id', ruleId).eq('user_id', userId)
}

export async function processAutoReply(
  supabase: SupabaseClient,
  userId: string,
  message: WhatsAppMessage,
  rules?: AutoReplyRule[]
): Promise<{ matched: boolean; response?: string; rule?: AutoReplyRule }> {
  const activeRules = rules || await getAutoReplies(supabase, userId)
  const applicable = activeRules.filter(r => r.status === 'active')
  const body = message.body.toLowerCase().trim()

  for (const rule of applicable) {
    const triggers = Array.isArray(rule.triggerValue) ? rule.triggerValue : [rule.triggerValue]
    let matched = false

    for (const trigger of triggers) {
      const t = trigger.toLowerCase().trim()
      switch (rule.matchMode) {
        case 'exact':
          if (body === t) { matched = true }
          break
        case 'starts_with':
          if (body.startsWith(t)) { matched = true }
          break
        case 'regex':
          try { if (new RegExp(t, 'i').test(body)) { matched = true } } catch {}
          break
        case 'contains':
        default:
          if (body.includes(t)) { matched = true }
          break
      }
      if (matched) break
    }

    if (!matched && rule.trigger === 'intent') {
      const classification = await classifyIncomingMessage(supabase, userId, message)
      matched = triggers.some(t => classification.intent === t || classification.suggestedAction === t)
    }

    if (matched) {
      await supabase.from('whatsapp_auto_replies').update({
        usage_count: supabase.rpc('increment', { x: 1 }),
        last_used_at: new Date().toISOString(),
      }).eq('id', rule.id)

      let response = rule.response
      if (rule.responseType === 'ai_generated') {
        const prompt = `Generate a friendly WhatsApp reply to: "${message.body}". Keep it concise (under 200 chars). Brand tone: professional yet warm.`
        const result = await executeAgentTask(supabase, userId, null, prompt, {
          systemPrompt: 'You are a WhatsApp auto-reply assistant. Respond conversationally, professionally, and concisely.',
        })
        response = result.response || rule.response
      }

      if (rule.responseType === 'template' && rule.templateName) {
        const sdk = new IntegrationSDK(supabase, userId)
        await sdk.executeAction('whatsapp', 'send_template', {
          to: message.from, templateName: rule.templateName,
        })
        return { matched: true, response: '', rule }
      }

      if (rule.responseType === 'media' && rule.mediaId) {
        const sdk = new IntegrationSDK(supabase, userId)
        await sdk.executeAction('whatsapp', 'send_image', {
          to: message.from, mediaId: rule.mediaId, caption: response,
        })
        return { matched: true, response: '', rule }
      }

      return { matched: true, response, rule }
    }
  }

  return { matched: false }
}

export async function bootstrapDefaultReplies(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  let count = 0
  const existing = await getAutoReplies(supabase, userId)
  const existingNames = new Set(existing.map(r => r.name))

  for (const def of DEFAULT_REPLIES) {
    if (!existingNames.has(def.name)) {
      await createAutoReply(supabase, userId, { ...def, userId })
      count++
    }
  }
  return count
}
