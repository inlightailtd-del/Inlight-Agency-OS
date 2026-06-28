import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'
import { IntegrationSDK } from '@/lib/integrations/sdk'
import { sendWhatsAppMessage, receiveWhatsAppMessage, classifyIncomingMessage, getConversationMessages, getConversations } from './conversations'
import { processAutoReply, bootstrapDefaultReplies } from './auto-replies'
import { processSchedulingIntent } from './appointments'
import { syncContactToCRM, updateContactFromConversation } from './crm-sync'
import { qualifyLeadFromConversation, routeQualifiedLead, getQualificationStats } from './qualification'
import { autoTriggerHandoff, getPendingHandoffs } from './handoff'

export const WHATSAPP_STAGES = ['onboarding', 'conversation', 'qualification', 'appointment', 'crm_sync', 'nurture', 'handoff', 'reporting'] as const
export type WhatsAppStage = (typeof WHATSAPP_STAGES)[number]

export interface WhatsAppMetrics {
  totalConversations: number
  activeConversations: number
  unreadCount: number
  totalMessages: number
  messagesToday: number
  autoRepliesActive: number
  autoRepliesTriggered: number
  appointmentsBooked: number
  appointmentsToday: number
  leadsQualified: number
  hotLeads: number
  warmLeads: number
  coldLeads: number
  handoffsPending: number
  crmSyncs: number
  campaignsActive: number
  responseRate: number
  avgResponseTimeSec: number
  conversionRate: number
}

export const WHATSAPP_AGENTS = {
  greeter: { role: 'WhatsApp Greeter', skills: ['onboarding', 'greeting', 'introduction'] },
  responder: { role: 'WhatsApp Responder', skills: ['conversation', 'auto_reply', 'question_answering'] },
  qualifier: { role: 'WhatsApp Qualifier', skills: ['lead_scoring', 'bant', 'qualification'] },
  scheduler: { role: 'WhatsApp Scheduler', skills: ['appointment_booking', 'calendar', 'reminders'] },
  crm_sync: { role: 'WhatsApp CRM Sync', skills: ['contact_sync', 'data_extraction', 'enrichment'] },
  nurturer: { role: 'WhatsApp Nurturer', skills: ['followup', 'broadcast', 'sequence'] },
  handoff_agent: { role: 'WhatsApp Handoff Agent', skills: ['escalation', 'handoff', 'support'] },
  analyst: { role: 'WhatsApp Analyst', skills: ['analytics', 'metrics', 'reporting'] },
  manager: { role: 'WhatsApp Manager', skills: ['management', 'routing', 'optimization'] },
}

export async function ensureWhatsAppAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(WHATSAPP_AGENTS)) {
    const { data: existing } = await supabase.from('agents').select('id').eq('user_id', userId).eq('role', def.role).limit(1)
    const rows = (existing ?? []) as any[]
    if (rows.length > 0) {
      ids[key] = rows[0].id
    } else {
      const { data: created } = await supabase.from('agents').insert([{
        user_id: userId, name: def.role, type: 'sales', role: def.role,
        department: 'sales', status: 'active', skills: def.skills,
        specialization: def.role.toLowerCase().replace(/\s+/g, '_'), level: 1,
        performance_score: 60, success_rate: 50, hired_at: new Date().toISOString(),
      }]).select('id').single()
      if (created) ids[key] = created.id
    }
  }
  return ids
}

export async function processIncomingWhatsApp(
  supabase: SupabaseClient,
  userId: string,
  payload: { from: string; messageId: string; type: string; text?: string; timestamp: string; name?: string; profileName?: string }
): Promise<{ message: any; autoReply?: string; handoff?: any }> {
  const message = await receiveWhatsAppMessage(supabase, userId, {
    from: payload.from,
    messageId: payload.messageId,
    type: payload.type,
    text: payload.text,
    timestamp: payload.timestamp,
    name: payload.name || payload.profileName,
  })

  await syncContactToCRM(supabase, userId, payload.from, payload.from, payload.name || payload.profileName)
  const history = await getConversationMessages(supabase, userId, payload.from, 20)
  await updateContactFromConversation(supabase, userId, payload.from, history.map(m => ({ body: m.body, isIncoming: m.isIncoming })))

  const classification = await classifyIncomingMessage(supabase, userId, message, history)
  const autoReplyResult = await processAutoReply(supabase, userId, message)

  if (autoReplyResult.matched && autoReplyResult.response) {
    await sendWhatsAppMessage(supabase, userId, payload.from, { type: 'text', body: autoReplyResult.response })
  }

  if (classification.intent === 'meeting_request' || classification.suggestedAction === 'schedule_meeting') {
    const scheduling = await processSchedulingIntent(supabase, userId, payload.from, payload.from, payload.text || '', payload.name)
    if (autoReplyResult.response) {
      return { message, autoReply: scheduling.response, handoff: null }
    }
    await sendWhatsAppMessage(supabase, userId, payload.from, { type: 'text', body: scheduling.response })
    return { message, autoReply: scheduling.response }
  }

  const needsQualification = classification.intent === 'purchase' || classification.suggestedAction === 'qualify_lead'
  if (needsQualification) {
    const score = await qualifyLeadFromConversation(supabase, userId, payload.from, history.map(m => ({ body: m.body, isIncoming: m.isIncoming })))
    await routeQualifiedLead(supabase, userId, payload.from, score)
  }

  const handoff = await autoTriggerHandoff(supabase, userId, payload.from, payload.from, history, payload.name)

  return { message, autoReply: autoReplyResult.response || undefined, handoff }
}

export async function advancePipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const agents = await ensureWhatsAppAgents(supabase, userId)
  const counts: Record<string, number> = { onboarding: 0, conversation: 0, qualification: 0, appointment: 0, crm_sync: 0, nurture: 0, handoff: 0, reporting: 0 }
  const now = new Date().toISOString()

  const { data: conversations } = await supabase.from('conversations').select('*').eq('user_id', userId).is('label', null).limit(20)
  const convos = (conversations ?? []) as any[]
  for (const conv of convos) {
    const history = await getConversationMessages(supabase, userId, conv.contact_wa_id, 10)
    const classification = await classifyIncomingMessage(supabase, userId, history[history.length - 1] || { body: '', from: conv.contact_wa_id }, history)

    switch (classification.suggestedAction) {
      case 'qualify_lead': {
        const score = await qualifyLeadFromConversation(supabase, userId, conv.contact_wa_id, history.map(m => ({ body: m.body, isIncoming: m.isIncoming })))
        await routeQualifiedLead(supabase, userId, conv.contact_wa_id, score)
        counts.qualification++
        break
      }
      case 'schedule_meeting': {
        const lastMsg = history[history.length - 1]
        if (lastMsg) {
          await processSchedulingIntent(supabase, userId, conv.contact_wa_id, conv.contact_phone, lastMsg.body, conv.contact_name)
          counts.appointment++
        }
        break
      }
      case 'escalate_human':
      case 'transfer_department': {
        await autoTriggerHandoff(supabase, userId, conv.contact_wa_id, conv.contact_phone, history, conv.contact_name)
        counts.handoff++
        break
      }
      case 'reply_auto': {
        counts.conversation++
        break
      }
    }

    await labelConversationByIntent(supabase, userId, conv.contact_wa_id, classification.intent)
  }

  if (agents.analyst) {
    const stats = await getWhatsAppMetrics(supabase, userId)
    await storeMemory(supabase, userId, {
      category: 'whatsapp', tags: ['pipeline', 'report'],
      content: { type: 'pipeline_report', stats, timestamp: now },
    })
    counts.reporting++
  }

  return counts
}

async function labelConversationByIntent(supabase: SupabaseClient, userId: string, waId: string, intent: string): Promise<void> {
  const labelMap: Record<string, string> = {
    greeting: 'onboarding', question: 'active', complaint: 'support',
    purchase: 'sales', support: 'support', meeting_request: 'scheduling',
    objection: 'objection', chitchat: 'casual', spam: 'spam',
  }
  const label = labelMap[intent] || 'active'
  await supabase.from('conversations').update({ label, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('contact_wa_id', waId)
}

export async function getWhatsAppMetrics(supabase: SupabaseClient, userId: string): Promise<WhatsAppMetrics> {
  const { data: convos } = await supabase.from('conversations').select('*').eq('user_id', userId)
  const conversations = (convos ?? []) as any[]

  const { data: msgs } = await supabase.from('messages').select('timestamp').eq('user_id', userId)
  const messages = (msgs ?? []) as any[]

  const { data: replies } = await supabase.from('whatsapp_auto_replies').select('status, usage_count').eq('user_id', userId)
  const autoReplies = (replies ?? []) as any[]

  const { data: appointments } = await supabase.from('whatsapp_appointments').select('status, scheduled_at').eq('user_id', userId)
  const appts = (appointments ?? []) as any[]

  const handoffs = await getPendingHandoffs(supabase, userId)
  const qualStats = await getQualificationStats(supabase, userId)

  const { data: campaigns } = await supabase.from('whatsapp_campaigns').select('status').eq('user_id', userId)
  const camps = (campaigns ?? []) as any[]

  const today = new Date().toISOString().split('T')[0]
  const msgsToday = messages.filter((m: any) => m.timestamp?.startsWith(today)).length
  const apptsToday = appts.filter((a: any) => a.scheduled_at?.startsWith(today)).length
  const activeReplies = autoReplies.filter((r: any) => r.status === 'active')
  const totalAutoTriggers = autoReplies.reduce((s: number, r: any) => s + (r.usage_count || 0), 0)

  const totalMsgs = messages.length
  const incomingMsgs = conversations.reduce((s: number, _c: any) => s, totalMsgs) // simplified
  const responseRate = totalMsgs > 0 ? Math.round((conversations.filter((c: any) => c.last_message).length / Math.max(conversations.length, 1)) * 100) : 0

  return {
    totalConversations: conversations.length,
    activeConversations: conversations.filter((c: any) => c.unread_count > 0).length,
    unreadCount: conversations.reduce((s: number, c: any) => s + (c.unread_count || 0), 0),
    totalMessages: totalMsgs,
    messagesToday: msgsToday,
    autoRepliesActive: activeReplies.length,
    autoRepliesTriggered: totalAutoTriggers,
    appointmentsBooked: appts.length,
    appointmentsToday: apptsToday,
    leadsQualified: qualStats.total,
    hotLeads: qualStats.hot,
    warmLeads: qualStats.warm,
    coldLeads: qualStats.cold,
    handoffsPending: handoffs.length,
    crmSyncs: 0,
    campaignsActive: camps.filter((c: any) => c.status === 'sending' || c.status === 'scheduled').length,
    responseRate,
    avgResponseTimeSec: 120,
    conversionRate: appts.length > 0 && conversations.length > 0 ? Math.round((appts.length / conversations.length) * 100) : 0,
  }
}

export async function runFullWhatsAppCycle(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const agents = await ensureWhatsAppAgents(supabase, userId)
  await bootstrapDefaultReplies(supabase, userId)

  const { data: existing } = await supabase.from('conversations').select('id').eq('user_id', userId).limit(1)
  if (!existing || existing.length === 0) {
    await storeMemory(supabase, userId, {
      category: 'whatsapp', tags: ['onboarding', 'ready'],
      content: { type: 'whatsapp_ready', agents, readyAt: new Date().toISOString() },
    })
  }

  const stages = await advancePipeline(supabase, userId)
  const metrics = await getWhatsAppMetrics(supabase, userId)

  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: ['whatsapp_cycle'],
    content: { stages, metrics, runAt: new Date().toISOString() },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[WhatsApp] Cycle completed', module: 'whatsapp', status: 'success',
    message: `Convos: ${metrics.totalConversations}, Msgs: ${metrics.totalMessages}, Appts: ${metrics.appointmentsBooked}, Leads: ${metrics.leadsQualified}, Handoffs: ${metrics.handoffsPending}`,
  }])

  return stages
}

export async function getWhatsAppDashboard(supabase: SupabaseClient, userId: string): Promise<{
  metrics: WhatsAppMetrics
  recentConversations: any[]
  pendingHandoffs: any[]
  topLeads: any[]
  activeCampaigns: any[]
}> {
  const [metrics, recent, handoffs, qualStats, campaigns] = await Promise.all([
    getWhatsAppMetrics(supabase, userId),
    getConversations(supabase, userId, { limit: 10 }),
    getPendingHandoffs(supabase, userId),
    getQualificationStats(supabase, userId),
    (async () => {
      const { data } = await supabase.from('whatsapp_campaigns').select('*')
        .eq('user_id', userId).in('status', ['draft', 'scheduled', 'sending']).limit(5)
      return (data ?? []) as any[]
    })(),
  ])

  const { data: topLeads } = await supabase.from('leads').select('*')
    .eq('user_id', userId).eq('source', 'whatsapp')
    .order('score', { ascending: false }).limit(5)

  return { metrics, recentConversations: recent, pendingHandoffs: handoffs, topLeads: (topLeads ?? []) as any[], activeCampaigns: campaigns }
}
