import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export type LeadStage = 'new' | 'qualified' | 'contacted' | 'replied' | 'meeting_booked' | 'proposal_sent' | 'won' | 'lost'

export interface LeadWithAssignee {
  id: string; name: string; company: string | null; email: string | null; phone: string | null
  industry: string | null; source: string; status: LeadStage; score: number
  assignee_id: string | null; assignee_name?: string | null
  last_contacted_at: string | null; followup_count: number; next_followup_at: string | null
  created_at: string
}

export interface SalesMetrics {
  newLeads: number; qualified: number; contacted: number; replied: number
  meetingsBooked: number; proposalsSent: number; won: number; lost: number
  conversionRate: number; pipelineValue: number
}

const SALES_AGENTS = {
  director: { type: 'sales', role: 'Sales Director', status: 'active' },
  outreach: { type: 'sales', role: 'Outreach Specialist', status: 'active' },
  followup: { type: 'sales', role: 'Followup Specialist', status: 'active' },
  proposal: { type: 'sales', role: 'Proposal Writer', status: 'active' },
  meeting: { type: 'sales', role: 'Meeting Booker', status: 'active' },
}

export async function ensureSalesAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const agentIds: Record<string, string> = {}
  for (const [key, def] of Object.entries(SALES_AGENTS)) {
    const { data: existing } = await supabase.from('agents').select('id').eq('user_id', userId).eq('role', def.role).limit(1)
    const rows = (existing ?? []) as any[]
    if (rows.length > 0) {
      agentIds[key] = rows[0].id
    } else {
      const { data: created } = await supabase.from('agents').insert([{
        user_id: userId, name: def.role, type: def.type, role: def.role,
        department: 'sales', status: def.status, skills: [def.role.replace(' ', '_').toLowerCase()],
        specialization: def.role.toLowerCase().replace(/\s+/g, '_'), level: 1, performance_score: 60, success_rate: 50,
        hired_at: new Date().toISOString(),
      }]).select('id').single()
      if (created) agentIds[key] = created.id
    }
  }
  return agentIds
}

export async function qualifyNewLeads(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: leads } = await supabase.from('leads').select('id, name, company, industry, email, score').eq('user_id', userId).eq('status', 'new').limit(20)
  const allLeads = (leads ?? []) as any[]
  let qualified = 0

  for (const lead of allLeads) {
    if (lead.score >= 30) {
      await supabase.from('leads').update({ status: 'qualified', updated_at: new Date().toISOString() }).eq('id', lead.id)
      qualified++
    } else {
      const systemPrompt = 'Determine if this lead is worth pursuing. Return JSON: {"qualified": boolean, "reason": "string"}'
      const result = await executeAgentTask(supabase, userId, null, `Lead: ${lead.name}, Company: ${lead.company || 'N/A'}, Industry: ${lead.industry || 'N/A'}, Score: ${lead.score}`, { systemPrompt })
      try {
        const parsed = JSON.parse(result.response || '{}')
        if (parsed.qualified) {
          await supabase.from('leads').update({ status: 'qualified', updated_at: new Date().toISOString() }).eq('id', lead.id)
          qualified++
        }
      } catch { continue }
    }
  }
  return qualified
}

export async function assignLeadsToEmployees(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: agents } = await supabase.from('agents').select('id, name').eq('user_id', userId).eq('department', 'sales').eq('status', 'active').limit(10)
  const salesAgents = (agents ?? []) as any[]
  if (!salesAgents.length) return 0

  const { data: leads } = await supabase.from('leads').select('id, name, company').eq('user_id', userId).eq('status', 'qualified').is('assignee_id', null).limit(20)
  const unassigned = (leads ?? []) as any[]
  if (!unassigned.length) return 0

  let assigned = 0
  for (let i = 0; i < unassigned.length; i++) {
    const agent = salesAgents[i % salesAgents.length]
    await supabase.from('leads').update({ assignee_id: agent.id, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', unassigned[i].id)
    await assignTaskToEmployee(supabase, userId, agent.id, `Contact ${unassigned[i].name}${unassigned[i].company ? ` at ${unassigned[i].company}` : ''}`, `Follow up with this qualified lead`)
    assigned++
  }
  return assigned
}

export async function runOutreachForAssigned(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: leads } = await supabase.from('leads').select('*, agents!leads_assignee_id_fkey(name)').eq('user_id', userId).eq('status', 'qualified').not('assignee_id', 'is', null).limit(10)
  const allLeads = (leads ?? []) as any[]
  let sent = 0

  for (const lead of allLeads) {
    const systemPrompt = `You are an Outreach Specialist. Write a personalized outreach message. Return JSON: {"message": "text", "subject": "text"}`
    const result = await executeAgentTask(supabase, userId, null,
      `Write outreach for ${lead.name} at ${lead.company || 'their company'} in ${lead.industry || 'their industry'}`,
      { systemPrompt }
    )
    try {
      const parsed = JSON.parse(result.response || '{}')
      await storeMemory(supabase, userId, {
        category: 'outreach', tags: [lead.id, 'outreach', lead.assignee_id || ''],
        content: { leadId: lead.id, leadName: lead.name, assignee: lead.agents?.name || 'unknown', subject: parsed.subject, message: parsed.message, status: 'sent', sentAt: new Date().toISOString() },
      })
      await supabase.from('leads').update({ status: 'contacted', last_contacted_at: new Date().toISOString(), followup_count: 1, next_followup_at: new Date(Date.now() + 86400000 * 3).toISOString(), updated_at: new Date().toISOString() }).eq('id', lead.id)
      await supabase.from('execution_logs').insert([{ user_id: userId, command_id: null, action: '[Sales] Outreach sent', module: 'sales', status: 'success', message: `${lead.name} assigned to ${lead.agents?.name || 'unknown'}`, entity_type: 'lead', entity_id: lead.id }])
      sent++
    } catch { continue }
  }
  return sent
}

export async function runFollowups(supabase: SupabaseClient, userId: string): Promise<number> {
  const now = new Date().toISOString()
  const { data: leads } = await supabase.from('leads').select('*, agents!leads_assignee_id_fkey(name)').eq('user_id', userId).eq('status', 'contacted').lte('next_followup_at', now).limit(10)
  const allLeads = (leads ?? []) as any[]
  let followed = 0

  for (const lead of allLeads) {
    const count = (lead.followup_count || 0) + 1
    if (count > 5) {
      await supabase.from('leads').update({ status: 'lost', lost_reason: 'No reply after 5 followups', updated_at: new Date().toISOString() }).eq('id', lead.id)
      continue
    }

    const systemPrompt = `You are a Followup Specialist. Write a followup message. Return JSON: {"message": "text", "subject": "text"}`
    const result = await executeAgentTask(supabase, userId, null,
      `Followup #${count} for ${lead.name} at ${lead.company || 'their company'}. Previous outreach was sent.`,
      { systemPrompt }
    )
    try {
      const parsed = JSON.parse(result.response || '{}')
      await storeMemory(supabase, userId, {
        category: 'outreach', tags: [lead.id, 'followup', lead.assignee_id || ''],
        content: { leadId: lead.id, leadName: lead.name, assignee: lead.agents?.name || 'unknown', subject: parsed.subject, message: parsed.message, followupNumber: count, sentAt: new Date().toISOString() },
      })
      const nextFollowup = count >= 3 ? Date.now() + 86400000 * 7 : Date.now() + 86400000 * 3
      await supabase.from('leads').update({
        last_contacted_at: new Date().toISOString(), followup_count: count,
        next_followup_at: new Date(nextFollowup).toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', lead.id)
      followed++
    } catch { continue }
  }
  return followed
}

export async function generateProposalsForLeads(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: leads } = await supabase.from('leads').select('*, agents!leads_assignee_id_fkey(name)').eq('user_id', userId).eq('status', 'replied').limit(5)
  const allLeads = (leads ?? []) as any[]
  let generated = 0

  for (const lead of allLeads) {
    const systemPrompt = `You are a Proposal Writer. Create a service proposal. Return JSON: {"proposal": "text", "services": ["s1"], "budget": number, "timeline": "text"}`
    const result = await executeAgentTask(supabase, userId, null,
      `Create proposal for ${lead.name} at ${lead.company || 'their company'} (${lead.industry || 'general'})`,
      { systemPrompt }
    )
    try {
      const parsed = JSON.parse(result.response || '{}')
      await storeMemory(supabase, userId, {
        category: 'proposal', tags: [lead.id, 'proposal', lead.assignee_id || ''],
        content: { leadId: lead.id, leadName: lead.name, assignee: lead.agents?.name || 'unknown', proposal: parsed.proposal, services: parsed.services, budget: parsed.budget, timeline: parsed.timeline, status: 'sent', sentAt: new Date().toISOString() },
      })
      await supabase.from('leads').update({ status: 'proposal_sent', proposal_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', lead.id)
      generated++
    } catch { continue }
  }
  return generated
}

export async function bookMeetingsForLeads(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: leads } = await supabase.from('leads').select('*, agents!leads_assignee_id_fkey(name)').eq('user_id', userId).eq('status', 'contacted').limit(5)
  const allLeads = (leads ?? []) as any[]
  let booked = 0

  for (const lead of allLeads) {
    if ((lead.followup_count || 0) >= 2) {
      const systemPrompt = `You are a Meeting Booker. Propose a meeting time. Return JSON: {"message": "text", "suggestion": "text"}`
      const result = await executeAgentTask(supabase, userId, null,
        `Propose a meeting to ${lead.name} at ${lead.company || 'their company'} to discuss how we can help.`,
        { systemPrompt }
      )
      try {
        const parsed = JSON.parse(result.response || '{}')
        await storeMemory(supabase, userId, {
          category: 'meeting_request', tags: [lead.id, 'meeting', lead.assignee_id || ''],
          content: { leadId: lead.id, leadName: lead.name, assignee: lead.agents?.name || 'unknown', message: parsed.message, suggestion: parsed.suggestion, sentAt: new Date().toISOString() },
        })
        await supabase.from('leads').update({ status: 'meeting_booked', meeting_date: new Date(Date.now() + 86400000 * 7).toISOString(), updated_at: new Date().toISOString() }).eq('id', lead.id)
        booked++
      } catch { continue }
    }
  }
  return booked
}

export async function getSalesMetrics(supabase: SupabaseClient, userId: string): Promise<SalesMetrics> {
  const { data } = await supabase.from('leads').select('status').eq('user_id', userId)
  const leads = (data ?? []) as any[]
  const counts: Record<string, number> = {}
  for (const l of leads) counts[l.status] = (counts[l.status] || 0) + 1
  const won = counts['won'] || 0
  const total = leads.length
  return {
    newLeads: counts['new'] || 0, qualified: counts['qualified'] || 0,
    contacted: counts['contacted'] || 0, replied: counts['replied'] || 0,
    meetingsBooked: counts['meeting_booked'] || 0, proposalsSent: counts['proposal_sent'] || 0,
    won, lost: counts['lost'] || 0,
    conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
    pipelineValue: won * 5000,
  }
}

export async function runFullSalesCycle(supabase: SupabaseClient, userId: string): Promise<{ qualified: number; assigned: number; outreach: number; followups: number; proposals: number; meetings: number }> {
  await ensureSalesAgents(supabase, userId)
  const [qualified, assigned, outreach, followups, proposals, meetings] = await Promise.all([
    qualifyNewLeads(supabase, userId),
    assignLeadsToEmployees(supabase, userId),
    runOutreachForAssigned(supabase, userId),
    runFollowups(supabase, userId),
    generateProposalsForLeads(supabase, userId),
    bookMeetingsForLeads(supabase, userId),
  ])
  const metrics = await getSalesMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'revenue_pattern', tags: ['sales', 'cycle'],
    content: { qualified, assigned, outreach, followups, proposals, meetings, metrics, runAt: new Date().toISOString() },
  })

  // Sales-to-Website hook: won leads → create website projects
  try {
    const { data: wonLeads } = await supabase.from('leads').select('id, name, company, industry').eq('user_id', userId).eq('status', 'won')
    const { createWebsiteFromLead } = await import('@/lib/websites/engine')
    for (const lead of (wonLeads ?? []) as any[]) {
      const { data: existing } = await supabase.from('website_projects').select('id').eq('lead_id', lead.id).limit(1)
      if (!existing || (existing ?? []).length === 0) {
        await createWebsiteFromLead(supabase, userId, lead.id)
      }
    }
  } catch { /* website table may not exist */ }

  // Sales-to-Software hook: won leads → create software projects
  try {
    const { createSoftwareFromLead } = await import('@/lib/software/engine')
    const { data: wonLeads } = await supabase.from('leads').select('id, name, company, industry').eq('user_id', userId).eq('status', 'won')
    for (const lead of (wonLeads ?? []) as any[]) {
      const { data: existing } = await supabase.from('software_projects').select('id').eq('lead_id', lead.id).limit(1)
      if (!existing || existing.length === 0) {
        await createSoftwareFromLead(supabase, userId, lead.id)
      }
    }
  } catch { /* software table may not exist */ }

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Sales] Cycle completed', module: 'sales', status: 'success',
    message: `Qualified: ${qualified}, Assigned: ${assigned}, Outreach: ${outreach}, Followups: ${followups}, Proposals: ${proposals}, Meetings: ${meetings}`,
  }])
  return { qualified, assigned, outreach, followups, proposals, meetings }
}

export async function getSalesLeads(supabase: SupabaseClient, userId: string, status?: string): Promise<LeadWithAssignee[]> {
  let q = supabase.from('leads').select('*, agents!leads_assignee_id_fkey(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
  if (status && status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as any[]).map((r: any) => ({ ...r, assignee_name: r.agents?.name || null })) as LeadWithAssignee[]
}
