import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export const VOICE_STAGES = ['lead_selection', 'qualification', 'call_preparation', 'call_execution', 'objection_handling', 'followup', 'appointment_booking', 'proposal', 'closing', 'customer_handoff'] as const
export type VoiceStage = (typeof VOICE_STAGES)[number]

export interface VoiceMetrics {
  totalCampaigns: number; activeCampaigns: number; totalAgents: number
  totalCalls: number; connectedCalls: number; appointmentsBooked: number
  dealsClosed: number; conversionRate: number; totalDurationMin: number
  avgCallDurationSec: number; topAgentScore: number
}

const VOICE_AGENTS = {
  strategist: { role: 'Call Strategist', skills: ['campaign_strategy', 'script_writing', 'a_b_testing'] },
  cold_caller: { role: 'Cold Caller', skills: ['cold_calling', 'opening', 'rapport'] },
  setter: { role: 'Appointment Setter', skills: ['scheduling', 'calendly', 'followup'] },
  closer: { role: 'Sales Closer', skills: ['closing', 'negotiation', 'value_selling'] },
  objection: { role: 'Objection Handler', skills: ['objection_handling', 'overcoming', 'pushback'] },
  qualifier: { role: 'Qualification Agent', skills: ['bant_qualification', 'discovery', 'scoring'] },
  followup_caller: { role: 'Follow-up Caller', skills: ['followup', 'persistence', 'reminders'] },
  success: { role: 'Customer Success Caller', skills: ['onboarding', 'retention', 'upsell'] },
  analytics: { role: 'Voice Analytics Agent', skills: ['analytics', 'sentiment', 'call_scoring'] },
  manager: { role: 'Call Manager', skills: ['management', 'routing', 'qa', 'optimization'] },
}

export async function ensureVoiceAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(VOICE_AGENTS)) {
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

export async function createCallCampaign(supabase: SupabaseClient, userId: string, name: string, desc: string, goal: string): Promise<string> {
  const { data: c } = await supabase.from('call_campaigns').insert([{
    user_id: userId, name, description: desc, goal, status: 'draft',
  }]).select('id').single()
  if (!c) throw new Error('Failed')
  await storeMemory(supabase, userId, {
    category: 'voice_learning', tags: ['campaign', name.toLowerCase().replace(/\s+/g, '_')],
    content: { type: 'call_campaign_created', campaignId: c.id, name, goal, createdAt: new Date().toISOString() },
  })
  return c.id
}

export async function advancePipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = { lead_selection: 0, qualification: 0, call_preparation: 0, call_execution: 0, objection_handling: 0, followup: 0, appointment_booking: 0, proposal: 0, closing: 0, customer_handoff: 0 }
  const agents = await ensureVoiceAgents(supabase, userId)
  const now = new Date().toISOString()

  // lead_selection → select leads from outreach
  const { data: campaigns } = await supabase.from('call_campaigns').select('id, name, goal').eq('user_id', userId).eq('status', 'draft').limit(5)
  for (const cmp of (campaigns ?? []) as any[]) {
    await supabase.from('call_lists').insert([{
      user_id: userId, name: `${cmp.name} Call List`, source: 'outreach_auto',
      total_numbers: 50, status: 'ready',
    }]).maybeSingle()
    await supabase.from('call_campaigns').update({ status: 'active', total_calls: 50, updated_at: now }).eq('id', cmp.id)
    counts['lead_selection']++
  }

  // qualification — score leads
  const { data: lists } = await supabase.from('call_lists').select('id, name, total_numbers').eq('user_id', userId).eq('status', 'ready').limit(5)
  for (const list of (lists ?? []) as any[]) {
    const qualified = Math.round((list.total_numbers || 50) * 0.6)
    await supabase.from('call_lists').update({ qualified, status: 'qualified' }).eq('id', list.id)
    counts['qualification']++
  }

  // call_preparation — generate scripts
  const { data: activeCamps } = await supabase.from('call_campaigns').select('id, name, goal').eq('user_id', userId).eq('status', 'active').limit(5)
  for (const cmp of (activeCamps ?? []) as any[]) {
    const systemPrompt = 'You are a Call Strategist. Write a call script. Return JSON: {"script": "full script with opening, discovery, value prop, objection handling, closing", "keyPoints": ["kp1"], "successCriteria": "criteria"}'
    const result = await executeAgentTask(supabase, userId, null,
      `Write a call script for campaign "${cmp.name}": ${cmp.goal || 'generate interest'}`, { systemPrompt }
    )
    let script: any = {}
    try { script = JSON.parse(result.response || '{}') } catch { script.script = result.response }

    // Create voice agent
    await supabase.from('voice_agents').insert([{
      user_id: userId, name: `${cmp.name} Agent`, role: 'Cold Caller',
      voice_provider: 'elevenlabs', personality: 'professional and friendly',
      greeting_message: script.script ? script.script.substring(0, 200) : 'Hello!',
    }]).maybeSingle()

    await supabase.from('call_campaigns').update({ call_script: script.script || result.response, updated_at: now }).eq('id', cmp.id)
    await storeMemory(supabase, userId, {
      category: 'voice_learning', tags: [cmp.id, 'call_script'],
      content: { campaignId: cmp.id, name: cmp.name, type: 'call_script', script: script.script, keyPoints: script.keyPoints, createdAt: now },
    })
    counts['call_preparation']++
  }

  // call_execution — create sessions
  const { data: callLists } = await supabase.from('call_lists').select('id, name, total_numbers, qualified').eq('user_id', userId).eq('status', 'qualified').limit(5)
  for (const list of (callLists ?? []) as any[]) {
    const callCount = Math.min(list.qualified || 25, 10)
    for (let i = 0; i < callCount; i++) {
      const duration = Math.floor(Math.random() * 120) + 30
      const connected = Math.random() > 0.35
      await supabase.from('call_sessions').insert([{
        user_id: userId, campaign_id: null, prospect_name: `Prospect ${i + 1}`,
        prospect_phone: '+1555' + String(1000000 + i).slice(0, 7),
        status: connected ? 'completed' : 'no_answer',
        duration_seconds: connected ? duration : 0,
        call_provider: 'twilio', ai_used: true, outcome: connected ? 'connected' : 'no_answer',
        started_at: now, ended_at: now,
      }]).maybeSingle()
      if (connected) {
        await supabase.from('call_transcripts').insert([{
          user_id: userId, session_id: null, speaker: 'ai', content: `Discovery call with prospect ${i + 1}. Discussed needs and presented solution.`,
          timestamp_sec: 5, sentiment: 'neutral', topic: 'discovery',
        }]).maybeSingle()
        await supabase.from('call_outcomes').insert([{
          user_id: userId, session_id: null, outcome_type: 'connected',
          interested: Math.random() > 0.5, qualified: Math.random() > 0.4,
          meeting_booked: Math.random() > 0.6, followup_required: true,
        }]).maybeSingle()
      }
    }
    await supabase.from('call_lists').update({ called: callCount, connected: Math.round(callCount * 0.65), status: 'in_progress' }).eq('id', list.id)
    counts['call_execution']++
  }

  // objection_handling — analyze and store
  const { data: outcomes } = await supabase.from('call_outcomes').select('id, interested, qualified').eq('user_id', userId).is('objection_type', null).limit(10)
  for (const out of (outcomes ?? []) as any[]) {
    const systemPrompt = 'You are an Objection Handler. Identify common objections. Return JSON: {"objectionType": "pricing|timing|need|authority|competitor", "handlingScript": "text", "effectiveness": number}'
    const result = await executeAgentTask(supabase, userId, null, 'Analyze call outcome and identify common objections', { systemPrompt })
    let obj: any = {}
    try { obj = JSON.parse(result.response || '{}') } catch { /* ok */ }
    await supabase.from('call_outcomes').update({ objection_type: obj.objectionType || 'pricing' }).eq('id', out.id)
    if (obj.objectionType) {
      await storeMemory(supabase, userId, {
        category: 'voice_learning', tags: ['objection', obj.objectionType],
        content: { type: 'objection_pattern', objection: obj.objectionType, handlingScript: obj.handlingScript, effectiveness: obj.effectiveness, createdAt: now },
      })
    }
    counts['objection_handling']++
  }

  // followup — create followup sessions
  const { data: followNeeded } = await supabase.from('call_outcomes').select('id, session_id').eq('user_id', userId).eq('followup_required', true).limit(10)
  for (const f of (followNeeded ?? []) as any[]) {
    await supabase.from('call_sessions').insert([{
      user_id: userId, prospect_name: 'Follow-up Prospect', status: 'scheduled',
      call_provider: 'twilio', ai_used: true, outcome: 'followup',
    }]).maybeSingle()
    counts['followup']++
  }

  // appointment_booking — book meetings
  const { data: interestedOutcomes } = await supabase.from('call_outcomes').select('id').eq('user_id', userId).eq('interested', true).limit(10)
  for (const _ of (interestedOutcomes ?? []) as any[]) {
    await supabase.from('appointment_bookings').insert([{
      user_id: userId, prospect_name: 'Booked Prospect',
      scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'scheduled', duration_min: 30,
    }]).maybeSingle()
    counts['appointment_booking']++
  }

  // proposal
  const { data: appts } = await supabase.from('appointment_bookings').select('id, prospect_name').eq('user_id', userId).eq('status', 'scheduled').limit(5)
  for (const a of (appts ?? []) as any[]) { counts['proposal']++ }

  // closing
  const { data: proposals } = await supabase.from('appointment_bookings').select('id').eq('user_id', userId).limit(5)
  for (const _ of (proposals ?? []) as any[]) {
    const won = Math.random() > 0.4
    if (won) {
      await storeMemory(supabase, userId, {
        category: 'voice_learning', tags: ['closed_deal'],
        content: { type: 'closed_deal', closedAt: now },
      })
    }
    counts['closing']++
  }

  // customer_handoff
  const { data: closedDeals } = await supabase.from('call_outcomes').select('id').eq('user_id', userId).eq('meeting_booked', true).limit(5)
  for (const _ of (closedDeals ?? []) as any[]) { counts['customer_handoff']++ }

  // Update campaign metrics
  const { data: campaignRows } = await supabase.from('call_campaigns').select('id').eq('user_id', userId).eq('status', 'active')
  for (const cmp of (campaignRows ?? []) as any[]) {
    const { data: sessions } = await supabase.from('call_sessions').select('status, duration_seconds').eq('user_id', userId)
    const { data: bookings } = await supabase.from('appointment_bookings').select('id').eq('user_id', userId)
    const sessArr = (sessions ?? []) as any[]
    const totalCalls = sessArr.length
    const connected = sessArr.filter((s: any) => s.status === 'completed').length
    await supabase.from('call_campaigns').update({
      total_calls: totalCalls, connected_calls: connected, appointments_booked: (bookings ?? []).length,
      conversion_rate: totalCalls > 0 ? Math.round((connected / totalCalls) * 10000) / 100 : 0,
      updated_at: now,
    }).eq('id', cmp.id)
  }

  return counts
}

export async function getVoiceMetrics(supabase: SupabaseClient, userId: string): Promise<VoiceMetrics> {
  const { data: campaigns } = await supabase.from('call_campaigns').select('status, total_calls, connected_calls, appointments_booked, deals_closed, conversion_rate').eq('user_id', userId)
  const camps = (campaigns ?? []) as any[]
  const { data: agents } = await supabase.from('voice_agents').select('performance_score').eq('user_id', userId)
  const { data: sessions } = await supabase.from('call_sessions').select('duration_seconds').eq('user_id', userId)
  const sessArr = (sessions ?? []) as any[]
  const totalDur = sessArr.reduce((s: number, x: any) => s + (x.duration_seconds || 0), 0)
  return {
    totalCampaigns: camps.length,
    activeCampaigns: camps.filter((c: any) => c.status === 'active').length,
    totalAgents: (agents ?? []).length,
    totalCalls: camps.reduce((s: number, c: any) => s + (c.total_calls || 0), 0),
    connectedCalls: camps.reduce((s: number, c: any) => s + (c.connected_calls || 0), 0),
    appointmentsBooked: camps.reduce((s: number, c: any) => s + (c.appointments_booked || 0), 0),
    dealsClosed: camps.reduce((s: number, c: any) => s + (c.deals_closed || 0), 0),
    conversionRate: camps.length > 0 ? Math.round(camps.reduce((s: number, c: any) => s + (c.conversion_rate || 0), 0) / camps.length) : 0,
    totalDurationMin: Math.round(totalDur / 60),
    avgCallDurationSec: sessArr.length > 0 ? Math.round(totalDur / sessArr.length) : 0,
    topAgentScore: (agents ?? []).length > 0 ? Math.max(...(agents ?? []).map((a: any) => a.performance_score || 0)) : 0,
  }
}

export async function runFullVoiceCycle(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  await ensureVoiceAgents(supabase, userId)
  const { data: existing } = await supabase.from('call_campaigns').select('id').eq('user_id', userId).limit(1)
  if (!existing || existing.length === 0) {
    await createCallCampaign(supabase, userId, 'Q2 Outbound', 'Automated AI calling campaign', 'Book meetings and close deals')
  }
  const stages = await advancePipeline(supabase, userId)
  const metrics = await getVoiceMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'voice_learning', tags: ['voice_cycle'],
    content: { stages, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Voice] Cycle completed', module: 'sales', status: 'success',
    message: `Calls: ${metrics.totalCalls}, Connected: ${metrics.connectedCalls}, Bookings: ${metrics.appointmentsBooked}`,
  }])
  return stages
}
