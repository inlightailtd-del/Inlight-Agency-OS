import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface WhatsAppCRMSyncLog {
  id: string
  userId: string
  contactWaId: string
  contactPhone: string
  contactName?: string
  syncAction: 'created' | 'updated' | 'matched' | 'skipped'
  targetTable: 'contacts' | 'leads' | 'clients'
  targetId: string
  changes?: Record<string, any>
  confidence: number
  syncedAt: string
}

export async function syncContactToCRM(
  supabase: SupabaseClient,
  userId: string,
  waId: string,
  phone: string,
  name?: string,
  profileInfo?: { email?: string; company?: string; industry?: string; notes?: string }
): Promise<WhatsAppCRMSyncLog> {
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name, email, company')
    .eq('user_id', userId)
    .or(`phone.eq.${phone},whatsapp.eq.${waId}`)
    .limit(1)

  const existing = ((existingContact ?? []) as any[])[0]

  if (existing) {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (!existing.whatsapp) updates.whatsapp = waId
    if (name && !existing.name) updates.name = name
    if (profileInfo?.email && !existing.email) updates.email = profileInfo.email
    if (profileInfo?.company && !existing.company) updates.company = profileInfo.company

    if (Object.keys(updates).length > 1) {
      await supabase.from('contacts').update(updates).eq('id', existing.id)
    }

    const log: WhatsAppCRMSyncLog = {
      id: `sync_${Date.now()}`, userId, contactWaId: waId,
      contactPhone: phone, contactName: name || existing.name,
      syncAction: 'updated', targetTable: 'contacts',
      targetId: existing.id, changes: updates,
      confidence: 0.9, syncedAt: new Date().toISOString(),
    }

    await logSync(supabase, log)
    return log
  }

  const systemPrompt = `You are a CRM data extractor. Extract company/contact info from limited data. Return JSON: {"name": "string", "company": "string or null", "industry": "string or null", "confidence": 0-1, "shouldCreateLead": boolean, "leadScore": 0-100}`
  const result = await executeAgentTask(supabase, userId, null,
    `Extract CRM info from WhatsApp contact. Phone: ${phone}, Name: ${name || 'unknown'}, Email: ${profileInfo?.email || 'unknown'}, Company: ${profileInfo?.company || 'unknown'}.`, { systemPrompt }
  )

  let extracted: any = {}
  try { extracted = JSON.parse(result.response || '{}') } catch {}

  const contactName = name || extracted.name || phone
  const { data: newContact } = await supabase.from('contacts').insert([{
    user_id: userId, name: contactName,
    phone, whatsapp: waId,
    email: profileInfo?.email || extracted.email || null,
    company: profileInfo?.company || extracted.company || null,
  }]).select().single()

  if (!newContact) throw new Error('Failed to create CRM contact')

  if (extracted.shouldCreateLead) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .limit(1)

    if (!existingLead?.length) {
      await supabase.from('leads').insert([{
        user_id: userId, name: contactName, phone,
        company: extracted.company, industry: extracted.industry,
        source: 'whatsapp', status: 'new', score: extracted.leadScore || 50,
      }])
    }
  }

  const log: WhatsAppCRMSyncLog = {
    id: `sync_${Date.now()}`, userId, contactWaId: waId,
    contactPhone: phone, contactName,
    syncAction: extracted.shouldCreateLead ? 'created' : 'matched',
    targetTable: 'contacts', targetId: newContact.id,
    confidence: extracted.confidence || 0.7,
    syncedAt: new Date().toISOString(),
  }

  await logSync(supabase, log)

  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: ['crm_sync', waId],
    content: { type: 'crm_sync', waId, phone, contactName, action: log.syncAction, contactId: newContact.id, leadCreated: extracted.shouldCreateLead },
  })

  return log
}

async function logSync(supabase: SupabaseClient, log: WhatsAppCRMSyncLog): Promise<void> {
  await supabase.from('whatsapp_crm_sync_log').insert([{
    id: log.id, user_id: log.userId, contact_wa_id: log.contactWaId,
    contact_phone: log.contactPhone, contact_name: log.contactName,
    sync_action: log.syncAction, target_table: log.targetTable,
    target_id: log.targetId, changes: log.changes,
    confidence: log.confidence, synced_at: log.syncedAt,
  }]).maybeSingle()
}

export async function getSyncHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<WhatsAppCRMSyncLog[]> {
  const { data } = await supabase
    .from('whatsapp_crm_sync_log')
    .select('*')
    .eq('user_id', userId)
    .order('synced_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as any[]).map(r => ({
    id: r.id, userId: r.user_id, contactWaId: r.contact_wa_id,
    contactPhone: r.contact_phone, contactName: r.contact_name,
    syncAction: r.sync_action, targetTable: r.target_table,
    targetId: r.target_id, changes: r.changes,
    confidence: r.confidence, syncedAt: r.synced_at,
  }))
}

export async function getCRMContactByWhatsApp(
  supabase: SupabaseClient,
  userId: string,
  waId: string
): Promise<{ contact?: any; lead?: any; client?: any } | null> {
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, clients(*)')
    .eq('user_id', userId)
    .eq('whatsapp', waId)
    .limit(1)

  const contact = ((contacts ?? []) as any[])[0]
  if (!contact) return null

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .eq('phone', contact.phone)
    .limit(1)

  return {
    contact,
    lead: ((leads ?? []) as any[])[0] || null,
    client: contact.clients || null,
  }
}

export async function updateContactFromConversation(
  supabase: SupabaseClient,
  userId: string,
  waId: string,
  messages: { body: string; isIncoming: boolean }[]
): Promise<void> {
  const messagesText = messages.map(m => `${m.isIncoming ? 'Contact' : 'AI'}: ${m.body}`).join('\n')
  const systemPrompt = `You are a CRM data extractor. Extract contact details from conversation. Return JSON: {"extractedFields": {"name": "string or null", "email": "string or null", "company": "string or null", "role": "string or null", "phone": "string or null", "location": "string or null"}, "confidence": 0-1, "hasNewInfo": boolean}`
  const result = await executeAgentTask(supabase, userId, null,
    `Extract any contact details from this WhatsApp conversation:\n\n${messagesText}`, { systemPrompt }
  )

  let extracted: any = {}
  try { extracted = JSON.parse(result.response || '{}') } catch {}

  if (!extracted.hasNewInfo || !extracted.extractedFields) return

  const fields = extracted.extractedFields as Record<string, string | null>
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (fields.name) updates.name = fields.name
  if (fields.email) updates.email = fields.email
  if (fields.company) updates.company = fields.company
  if (fields.phone) updates.phone = fields.phone

  if (Object.keys(updates).length > 1) {
    await supabase.from('contacts').update(updates)
      .eq('user_id', userId)
      .eq('whatsapp', waId)
  }
}

export async function bulkSyncContacts(
  supabase: SupabaseClient,
  userId: string,
  contacts: { waId: string; phone: string; name?: string; email?: string; company?: string }[]
): Promise<{ synced: number; failed: number; errors: string[] }> {
  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const contact of contacts) {
    try {
      await syncContactToCRM(supabase, userId, contact.waId, contact.phone, contact.name, {
        email: contact.email, company: contact.company,
      })
      synced++
    } catch (e: any) {
      failed++
      errors.push(`${contact.phone}: ${e.message}`)
    }
  }

  return { synced, failed, errors }
}
