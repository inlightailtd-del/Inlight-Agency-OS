import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationSDK } from '@/lib/integrations/sdk'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled'
export type BroadcastChannel = 'broadcast_list' | 'template' | 'individual'
export type AudienceType = 'all' | 'segment' | 'list' | 'leads' | 'custom'

export interface WhatsAppCampaign {
  id: string
  userId: string
  name: string
  description?: string
  goal: string
  audienceType: AudienceType
  audienceFilter?: Record<string, any>
  channel: BroadcastChannel
  messageType: 'text' | 'template' | 'interactive' | 'media'
  messageContent: string
  templateName?: string
  mediaId?: string
  status: BroadcastStatus
  scheduledAt?: string
  sentCount: number
  deliveredCount: number
  readCount: number
  repliedCount: number
  failedCount: number
  createdAt: string
  updatedAt: string
}

export async function createCampaign(
  supabase: SupabaseClient,
  userId: string,
  params: {
    name: string
    goal: string
    audienceType: AudienceType
    audienceFilter?: Record<string, any>
    channel: BroadcastChannel
    messageType: 'text' | 'template' | 'interactive' | 'media'
    messageContent: string
    templateName?: string
    mediaId?: string
    scheduledAt?: string
  }
): Promise<WhatsAppCampaign> {
  const { data, error } = await supabase.from('whatsapp_campaigns').insert([{
    user_id: userId, name: params.name,
    goal: params.goal, audience_type: params.audienceType,
    audience_filter: params.audienceFilter,
    channel: params.channel, message_type: params.messageType,
    message_content: params.messageContent,
    template_name: params.templateName, media_id: params.mediaId,
    status: params.scheduledAt ? 'scheduled' : 'draft',
    scheduled_at: params.scheduledAt || null,
  }]).select().single()
  if (error) throw error

  const campaign = mapCampaign(data as any)
  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: ['campaign', params.name],
    content: { type: 'campaign_created', campaignId: campaign.id, name: params.name, goal: params.goal },
  })
  return campaign
}

export async function launchCampaign(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string
): Promise<WhatsAppCampaign> {
  const { data: camp } = await supabase.from('whatsapp_campaigns').select('*').eq('id', campaignId).single()
  if (!camp) throw new Error('Campaign not found')
  const campaign = mapCampaign(camp as any)

  await supabase.from('whatsapp_campaigns').update({
    status: 'sending', updated_at: new Date().toISOString(),
  }).eq('id', campaignId)

  const contacts = await resolveAudience(supabase, userId, campaign)
  let sent = 0; let failed = 0
  const sdk = new IntegrationSDK(supabase, userId)

  for (const contact of contacts) {
    try {
      if (campaign.channel === 'template' && campaign.templateName) {
        await sdk.executeAction('whatsapp', 'send_template', {
          to: contact.waId || contact.phone, templateName: campaign.templateName,
        })
      } else if (campaign.messageType === 'interactive') {
        await sdk.executeAction('whatsapp', 'send_interactive_buttons', {
          to: contact.waId || contact.phone, text: campaign.messageContent, buttons: [],
        })
      } else {
        await sdk.executeAction('whatsapp', 'send_text', {
          to: contact.waId || contact.phone, text: campaign.messageContent,
        })
      }
      sent++
    } catch {
      failed++
    }
  }

  await supabase.from('whatsapp_campaigns').update({
    status: 'completed', sent_count: sent, failed_count: failed,
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId)

  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: ['campaign', campaign.name, 'launched'],
    content: { type: 'campaign_launched', campaignId, sent, failed },
  })

  return { ...campaign, sentCount: sent, failedCount: failed, status: 'completed' }
}

async function resolveAudience(
  supabase: SupabaseClient,
  userId: string,
  campaign: WhatsAppCampaign
): Promise<{ waId?: string; phone: string }[]> {
  switch (campaign.audienceType) {
    case 'all': {
      const { data } = await supabase
        .from('conversations')
        .select('contact_wa_id, contact_phone')
        .eq('user_id', userId)
      return ((data ?? []) as any[]).map(r => ({ waId: r.contact_wa_id, phone: r.contact_phone }))
    }
    case 'leads': {
      const { data } = await supabase
        .from('leads')
        .select('phone')
        .eq('user_id', userId)
        .not('phone', 'is', null)
      return ((data ?? []) as any[]).map(r => ({ phone: r.phone }))
    }
    case 'list': {
      if (!campaign.audienceFilter?.listId) return []
      const { data } = await supabase
        .from('whatsapp_audience_lists')
        .select('contact_wa_id, contact_phone')
        .eq('list_id', campaign.audienceFilter.listId)
      return ((data ?? []) as any[]).map(r => ({ waId: r.contact_wa_id, phone: r.contact_phone }))
    }
    case 'segment': {
      if (!campaign.audienceFilter) return []
      let q = supabase.from('conversations').select('contact_wa_id, contact_phone').eq('user_id', userId)
      const filter = campaign.audienceFilter
      if (filter.label) q = q.eq('label', filter.label)
      if (filter.lastMessageBefore) q = q.lt('last_message_at', filter.lastMessageBefore)
      if (filter.assignedAgent) q = q.eq('assigned_agent', filter.assignedAgent)
      const { data } = await q
      return ((data ?? []) as any[]).map(r => ({ waId: r.contact_wa_id, phone: r.contact_phone }))
    }
    default:
      return []
  }
}

export async function getCampaigns(
  supabase: SupabaseClient,
  userId: string
): Promise<WhatsAppCampaign[]> {
  const { data } = await supabase
    .from('whatsapp_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return ((data ?? []) as any[]).map(r => mapCampaign(r))
}

export async function generateCampaignContent(
  supabase: SupabaseClient,
  userId: string,
  goal: string,
  audienceDescription: string
): Promise<{ message: string; suggestedTemplates: string[] }> {
  const systemPrompt = `You are a WhatsApp marketing content strategist. Generate persuasive broadcast content. Return JSON: {"message": "full message text (max 1024 chars)", "suggestedTemplates": ["template_name_1", "template_name_2"], "cta": "call to action text", "bestTimeToSend": "string"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Goal: "${goal}". Audience: "${audienceDescription}". Generate WhatsApp broadcast content optimized for engagement and conversions.`, { systemPrompt }
  )

  let parsed: any = {}
  try { parsed = JSON.parse(result.response || '{}') } catch {}
  return {
    message: parsed.message || '',
    suggestedTemplates: parsed.suggestedTemplates || [],
  }
}

function mapCampaign(r: any): WhatsAppCampaign {
  return {
    id: r.id, userId: r.user_id, name: r.name,
    description: r.description, goal: r.goal,
    audienceType: r.audience_type, audienceFilter: r.audience_filter,
    channel: r.channel, messageType: r.message_type,
    messageContent: r.message_content,
    templateName: r.template_name, mediaId: r.media_id,
    status: r.status, scheduledAt: r.scheduled_at,
    sentCount: r.sent_count || 0, deliveredCount: r.delivered_count || 0,
    readCount: r.read_count || 0, repliedCount: r.replied_count || 0,
    failedCount: r.failed_count || 0,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export async function createAudienceList(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  contacts: { waId?: string; phone: string; name?: string }[]
): Promise<string> {
  const { data: list } = await supabase.from('whatsapp_audience_lists').insert([{
    user_id: userId, name,
  }]).select('id').single()
  if (!list) throw new Error('Failed to create list')

  const rows = contacts.map(c => ({
    list_id: list.id, user_id: userId,
    contact_wa_id: c.waId || null, contact_phone: c.phone,
    contact_name: c.name || null,
  }))
  await supabase.from('whatsapp_audience_members').insert(rows)

  return list.id
}
