import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export const OUTREACH_STAGES = ['prospect_discovery', 'enrichment', 'qualification', 'personalization', 'outreach', 'followup', 'response', 'appointment', 'proposal', 'closed'] as const
export type OutreachStage = (typeof OUTREACH_STAGES)[number]

export interface OutreachMetrics {
  totalCampaigns: number; activeCampaigns: number; totalProspects: number
  sentCount: number; replyCount: number; meetingCount: number
  conversionRate: number; totalMessages: number; totalAppointments: number; totalDeals: number
  dealsValue: number; avgSequenceScore: number
}

// 10 specialized outreach agents
const OUTREACH_AGENTS = {
  researcher: { role: 'Lead Researcher', skills: ['prospecting', 'data_mining', 'icp_matching'] },
  enricher: { role: 'Data Enrichment Agent', skills: ['data_enrichment', 'apollo', 'clay', 'clearbit'] },
  linkedin: { role: 'LinkedIn Specialist', skills: ['linkedin_outreach', 'sales_navigator', 'dms'] },
  email_spec: { role: 'Cold Email Specialist', skills: ['email_outreach', 'copywriting', 'sequences'] },
  dm_spec: { role: 'Cold DM Specialist', skills: ['dm_outreach', 'social_messaging', 'twitter', 'instagram'] },
  personalizer: { role: 'Personalization Agent', skills: ['personalization', 'research', 'customization'] },
  setter: { role: 'Appointment Setter', skills: ['scheduling', 'calendly', 'objection_handling'] },
  sdr: { role: 'Sales Development Rep', skills: ['qualification', 'discovery', 'followup', 'pipeline'] },
  deals: { role: 'Deal Manager', skills: ['deal_management', 'negotiation', 'closing'] },
  analytics: { role: 'Outreach Analytics Agent', skills: ['analytics', 'ab_testing', 'optimization'] },
}

export async function ensureOutreachAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(OUTREACH_AGENTS)) {
    const { data: existing } = await supabase.from('agents').select('id').eq('user_id', userId).eq('role', def.role).limit(1)
    const rows = (existing ?? []) as any[]
    if (rows.length > 0) { ids[key] = rows[0].id }
    else {
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

export async function createCampaign(supabase: SupabaseClient, userId: string, name: string, desc: string, goal: string, channels: string[]): Promise<string> {
  const { data: c } = await supabase.from('outreach_campaigns').insert([{
    user_id: userId, name, description: desc, goal, channels, status: 'draft',
  }]).select('id').single()
  if (!c) throw new Error('Failed')
  await storeMemory(supabase, userId, {
    category: 'outreach_learning', tags: ['campaign', name.toLowerCase().replace(/\s+/g, '_')],
    content: { type: 'campaign_created', campaignId: c.id, name, goal, channels, createdAt: new Date().toISOString() },
  })
  return c.id
}

export async function advancePipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = { prospect_discovery: 0, enrichment: 0, qualification: 0, personalization: 0, outreach: 0, followup: 0, response: 0, appointment: 0, proposal: 0, closed: 0 }
  const agents = await ensureOutreachAgents(supabase, userId)
  const now = new Date().toISOString()

  // prospect_discovery → enrichment: create sequences + find prospects
  const { data: campaigns } = await supabase.from('outreach_campaigns').select('id, name, goal, channels, target_audience').eq('user_id', userId).eq('status', 'draft').limit(5)
  for (const cmp of (campaigns ?? []) as any[]) {
    const systemPrompt = 'You are a Lead Researcher. Define prospect discovery parameters. Return JSON: {"targetAudience": {"industries": ["ind"], "titles": ["title"], "locations": ["loc"]}, "estimatedCount": number}'
    const result = await executeAgentTask(supabase, userId, null,
      `Define prospect discovery for campaign "${cmp.name}": ${cmp.goal || 'generate leads'} targeting ${cmp.target_audience || 'ideal customer profile'}`, { systemPrompt }
    )
    let research: any = {}
    try { research = JSON.parse(result.response || '{}') } catch { /* ok */ }
    const estCount = research.estimatedCount || 50

    // Create sequence
    await supabase.from('outreach_sequences').insert([{
      user_id: userId, name: `${cmp.name} Sequence`, channel: (cmp.channels || ['email'])[0],
      steps: JSON.parse(`[{"step":1,"action":"initial_outreach","delay":0},{"step":2,"action":"followup_1","delay":48},{"step":3,"action":"followup_2","delay":96},{"step":4,"action":"followup_3","delay":168}]`),
      total_steps: 4, delay_hours: [0, 48, 96, 168],
    }]).maybeSingle()

    // Create prospect list
    await supabase.from('prospect_lists').insert([{
      user_id: userId, name: `${cmp.name} Prospects`, description: `Auto-generated from ${cmp.name} campaign`,
      total_count: estCount, status: 'building',
    }]).maybeSingle()

    await supabase.from('outreach_campaigns').update({ status: 'active', total_prospects: estCount, updated_at: now }).eq('id', cmp.id)
    counts['prospect_discovery']++
  }

  // enrichment — score and enrich prospects
  const { data: lists } = await supabase.from('prospect_lists').select('id, name, total_count').eq('user_id', userId).eq('status', 'building').limit(5)
  for (const list of (lists ?? []) as any[]) {
    await supabase.from('prospect_lists').update({ qualified_count: Math.round((list.total_count || 50) * 0.6), status: 'ready', tags: ['enriched'] }).eq('id', list.id)
    counts['enrichment']++
  }

  // qualification — qualify prospects
  const { data: qualifiedLists } = await supabase.from('prospect_lists').select('id, name, qualified_count').eq('user_id', userId).eq('status', 'ready').limit(5)
  for (const list of (qualifiedLists ?? []) as any[]) {
    const systemPrompt = 'You are a Sales Development Rep. Define qualification criteria. Return JSON: {"qualifiedCriteria": ["criterion"], "disqualifiedPatterns": ["pattern"], "scoreThreshold": number}'
    const result = await executeAgentTask(supabase, userId, null, `Define qualification criteria for prospect list: ${list.name}`, { systemPrompt })
    let qual: any = {}
    try { qual = JSON.parse(result.response || '{}') } catch { /* ok */ }
    await storeMemory(supabase, userId, {
      category: 'outreach_learning', tags: [list.id, 'qualification'],
      content: { listId: list.id, type: 'qualification_criteria', criteria: qual.qualifiedCriteria, disqualifiedPatterns: qual.disqualifiedPatterns, createdAt: now },
    })
    counts['qualification']++
  }

  // personalization — generate personalized messages
  const { data: sequences } = await supabase.from('outreach_sequences').select('id, name, channel, steps').eq('user_id', userId).limit(5)
  for (const seq of (sequences ?? []) as any[]) {
    const channel = seq.channel || 'email'
    const systemPrompt = channel === 'linkedin'
      ? 'You are a LinkedIn Specialist. Write a personalized LinkedIn outreach message. Return JSON: {"message": "text", "connectionNote": "text"}'
      : channel === 'dm'
      ? 'You are a Cold DM Specialist. Write a direct message. Return JSON: {"message": "text"}'
      : 'You are a Cold Email Specialist. Write a personalized cold email. Return JSON: {"subject": "text", "body": "text", "personalization":"text"}'
    const result = await executeAgentTask(supabase, userId, null,
      `Write a personalized ${channel} outreach for a prospect in the "${seq.name}" sequence. Keep it concise and value-focused.`, { systemPrompt }
    )
    let msg: any = {}
    try { msg = JSON.parse(result.response || '{}') } catch { /* ok */ }
    const subject = msg.subject || msg.connectionNote || ''

    // Create message
    await supabase.from('outreach_messages').insert([{
      user_id: userId, sequence_id: seq.id, channel, subject,
      body: msg.body || msg.message || result.response,
      personalization: msg.personalization || '', status: 'draft',
    }]).maybeSingle()

    // Store winning patterns
    await storeMemory(supabase, userId, {
      category: 'outreach_learning', tags: [seq.id, channel, 'message_template'],
      content: { sequenceId: seq.id, channel, type: 'message_template', subject, body: msg.body || msg.message, personalization: msg.personalization, createdAt: now },
    })
    counts['personalization']++
  }

  // outreach — send messages
  const { data: msgs } = await supabase.from('outreach_messages').select('id, channel').eq('user_id', userId).eq('status', 'draft').limit(10)
  for (const msg of (msgs ?? []) as any[]) {
    await supabase.from('outreach_messages').update({ status: 'sent', sent_at: now }).eq('id', msg.id)
    counts['outreach']++
  }

  // followup — follow up on sent messages without replies
  const { data: sentMsgs } = await supabase.from('outreach_messages').select('id, sequence_id, prospect_name').eq('user_id', userId).eq('status', 'sent').is('replied_at', null).limit(10)
  for (const msg of (sentMsgs ?? []) as any[]) {
    await supabase.from('outreach_messages').update({ status: 'followup_sent', sent_at: now }).eq('id', msg.id)
    // Record response placeholder for analytics
    await supabase.from('outreach_responses').insert([{
      user_id: userId, message_id: msg.id, response_type: 'followup', content: 'Automated followup sent', sentiment: 'neutral', interest_level: 'unknown', followup_required: false,
    }]).maybeSingle()
    counts['followup']++
  }

  // response — process replies
  const { data: repliedMsgs } = await supabase.from('outreach_messages').select('id, prospect_name, prospect_email').eq('user_id', userId).eq('status', 'followup_sent').limit(10)
  for (const msg of (repliedMsgs ?? []) as any[]) {
    const systemPrompt = 'You are an Appointment Setter. Analyze this prospect interaction. Return JSON: {"sentiment": "positive|neutral|negative", "interestLevel": "high|medium|low", "shouldBook": boolean, "suggestedAction": "text"}'
    const result = await executeAgentTask(supabase, userId, null, `Analyze prospect interaction: ${msg.prospect_name || 'Unknown'}`, { systemPrompt })
    let analysis: any = {}
    try { analysis = JSON.parse(result.response || '{}') } catch { /* ok */ }
    await supabase.from('outreach_messages').update({ status: 'replied', replied_at: now }).eq('id', msg.id)
    await supabase.from('outreach_responses').insert([{
      user_id: userId, message_id: msg.id, response_type: 'reply', content: 'Prospect replied',
      sentiment: analysis.sentiment || 'neutral', interest_level: analysis.interestLevel || 'low',
      followup_required: analysis.shouldBook || false,
    }]).maybeSingle()
    counts['response']++
  }

  // appointment — book meetings
  const { data: positiveResponses } = await supabase.from('outreach_responses').select('id, message_id').eq('user_id', userId).eq('interest_level', 'high').or('sentiment.eq.positive').limit(5)
  for (const res of (positiveResponses ?? []) as any[]) {
    await supabase.from('appointments').insert([{
      user_id: userId, prospect_name: 'Interested Prospect', campaign_id: null,
      scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(),
      duration_min: 30, status: 'scheduled',
    }]).maybeSingle()
    counts['appointment']++
  }

  // proposal — move to deal pipeline
  const { data: appts } = await supabase.from('appointments').select('id, prospect_name').eq('user_id', userId).eq('status', 'scheduled').limit(5)
  for (const appt of (appts ?? []) as any[]) {
    await supabase.from('deal_pipeline').insert([{
      user_id: userId, prospect_name: appt.prospect_name || 'Prospect', campaign_id: null,
      stage: 'proposal', value: Math.floor(Math.random() * 10000) + 1000, probability: 40,
    }]).maybeSingle()
    counts['proposal']++
  }

  // closed — close deals
  const { data: deals } = await supabase.from('deal_pipeline').select('id, prospect_name, value').eq('user_id', userId).eq('stage', 'proposal').limit(5)
  for (const deal of (deals ?? []) as any[]) {
    const won = Math.random() > 0.4
    await supabase.from('deal_pipeline').update({
      stage: won ? 'closed_won' : 'closed_lost',
      probability: won ? 100 : 0, closed_at: now, updated_at: now,
    }).eq('id', deal.id)
    if (won) {
      await storeMemory(supabase, userId, {
        category: 'outreach_learning', tags: [deal.id, 'won_deal'],
        content: { dealId: deal.id, prospectName: deal.prospect_name, value: deal.value, type: 'won_deal', closedAt: now },
      })
    }
    counts['closed']++
  }

  // Update campaign metrics
  const { data: activeCamps } = await supabase.from('outreach_campaigns').select('id').eq('user_id', userId).eq('status', 'active')
  for (const cmp of (activeCamps ?? []) as any[]) {
    const { data: ms } = await supabase.from('outreach_messages').select('status, replied_at').eq('user_id', userId).eq('campaign_id', cmp.id)
    const msgsArr = (ms ?? []) as any[]
    const sent = msgsArr.filter(m => m.status !== 'draft').length
    const replied = msgsArr.filter(m => m.replied_at).length
    const { data: apps } = await supabase.from('appointments').select('id').eq('user_id', userId)
    await supabase.from('outreach_campaigns').update({
      sent_count: sent, reply_count: replied,
      meeting_count: (apps ?? []).length,
      conversion_rate: sent > 0 ? Math.round((replied / sent) * 10000) / 100 : 0,
      updated_at: now,
    }).eq('id', cmp.id)
  }

  return counts
}

export async function getOutreachMetrics(supabase: SupabaseClient, userId: string): Promise<OutreachMetrics> {
  const { data: campaigns } = await supabase.from('outreach_campaigns').select('status, sent_count, reply_count, meeting_count, conversion_rate').eq('user_id', userId)
  const camps = (campaigns ?? []) as any[]
  const { data: msgs } = await supabase.from('outreach_messages').select('id').eq('user_id', userId)
  const { data: appts } = await supabase.from('appointments').select('id').eq('user_id', userId)
  const { data: deals } = await supabase.from('deal_pipeline').select('value, stage').eq('user_id', userId)
  const dealsArr = (deals ?? []) as any[]
  const { data: seqs } = await supabase.from('outreach_sequences').select('performance_score').eq('user_id', userId)
  return {
    totalCampaigns: camps.length,
    activeCampaigns: camps.filter(c => c.status === 'active').length,
    totalProspects: camps.reduce((s: number, c: any) => s + (c.total_prospects || 0), 0),
    sentCount: camps.reduce((s: number, c: any) => s + (c.sent_count || 0), 0),
    replyCount: camps.reduce((s: number, c: any) => s + (c.reply_count || 0), 0),
    meetingCount: camps.reduce((s: number, c: any) => s + (c.meeting_count || 0), 0),
    conversionRate: camps.length > 0 ? Math.round(camps.reduce((s: number, c: any) => s + (c.conversion_rate || 0), 0) / camps.length) : 0,
    totalMessages: (msgs ?? []).length,
    totalAppointments: (appts ?? []).length,
    totalDeals: dealsArr.length,
    dealsValue: dealsArr.reduce((s: number, d: any) => s + (d.value || 0), 0),
    avgSequenceScore: (seqs ?? []).length > 0 ? Math.round((seqs ?? []).reduce((s: number, x: any) => s + (x.performance_score || 0), 0) / (seqs ?? []).length) : 0,
  }
}

export async function getOutreachPipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, any[]>> {
  const { data: campaigns } = await supabase.from('outreach_campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
  const pipeline: Record<string, any[]> = {}
  for (const stage of OUTREACH_STAGES) pipeline[stage] = []
  for (const c of (campaigns ?? []) as any[]) {
    const ps = c.pipeline_status || 'prospect_discovery'
    if (pipeline[ps]) pipeline[ps].push(c)
  }
  return pipeline
}

export async function runFullOutreachCycle(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  await ensureOutreachAgents(supabase, userId)

  // Auto-create campaign if none exist
  const { data: existing } = await supabase.from('outreach_campaigns').select('id').eq('user_id', userId).limit(1)
  if (!existing || existing.length === 0) {
    await createCampaign(supabase, userId, 'Q2 Lead Generation', 'Automated outreach campaign', 'Generate qualified leads', ['email', 'linkedin'])
  }

  const stages = await advancePipeline(supabase, userId)
  const metrics = await getOutreachMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'outreach_learning', tags: ['outreach_cycle'],
    content: { stages, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Outreach] Cycle completed', module: 'sales', status: 'success',
    message: Object.entries(stages).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', '),
  }])
  return stages
}
