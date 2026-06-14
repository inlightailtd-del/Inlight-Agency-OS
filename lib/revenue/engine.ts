import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { enqueueJob } from '@/lib/queue/queue'
import { extractRevenueLessons } from '@/lib/learning/patterns'

export interface RevenueMetrics {
  totalLeads: number
  leadsToday: number
  outreachSent: number
  proposalsGenerated: number
  meetingsBooked: number
  dealsClosed: number
  revenueGenerated: number
  conversionRate: number
}

export async function getRevenueMetrics(supabase: SupabaseClient, userId: string): Promise<RevenueMetrics> {
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: leads }, { count: outreach }, { count: proposals }, { data: invoices }] = await Promise.all([
    supabase.from('leads').select('*').eq('user_id', userId),
    supabase.from('execution_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).ilike('action', '%[Revenue] Outreach%'),
    supabase.from('execution_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).ilike('action', '%[Revenue] Proposal%'),
    supabase.from('invoices').select('total, status').eq('user_id', userId),
  ])

  const allLeads = (leads ?? []) as any[]
  const allInvoices = (invoices ?? []) as any[]
  const leadsToday = allLeads.filter((l: any) => l.created_at?.startsWith(today)).length
  const meetingsCount = allLeads.filter((l: any) => l.status === 'proposal' || l.status === 'qualified').length
  const dealsClosed = allLeads.filter((l: any) => l.status === 'converted').length
  const revenueGenerated = allInvoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.total || 0), 0)
  const conversionRate = allLeads.length > 0 ? Math.round((dealsClosed / allLeads.length) * 100) : 0

  return {
    totalLeads: allLeads.length, leadsToday, outreachSent: outreach || 0,
    proposalsGenerated: proposals || 0, meetingsBooked: meetingsCount,
    dealsClosed, revenueGenerated, conversionRate,
  }
}

export async function scoreUnscoredLeads(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: leads } = await supabase.from('leads').select('id, name, company, industry').eq('user_id', userId).eq('score', 0).limit(20)
  const unscored = (leads ?? []) as any[]
  if (!unscored.length) return 0

  let scored = 0
  for (const lead of unscored) {
    const systemPrompt = `You are a Lead Scoring AI. Score this lead 0-100 based on industry, company, and completeness. Return JSON: {"score": number, "reason": "string"}.`
    const result = await executeAgentTask(supabase, userId, null, `Score this lead:\nName: ${lead.name}\nCompany: ${lead.company || 'N/A'}\nIndustry: ${lead.industry || 'N/A'}`, { systemPrompt })
    try {
      const parsed = JSON.parse(result.response || '{}')
      await supabase.from('leads').update({ score: Math.min(100, Math.max(0, parsed.score || 50)) }).eq('id', lead.id)
      scored++
      await supabase.from('execution_logs').insert([{
        user_id: userId, command_id: null, action: '[Revenue] Lead scored', module: 'sales', status: 'success',
        message: `${lead.name}: ${parsed.score || 50}`, entity_type: 'lead', entity_id: lead.id,
      }])
    } catch { continue }
  }
  return scored
}

export async function runOutreachCampaign(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: leads } = await supabase.from('leads').select('id, name, company, email, industry').eq('user_id', userId).eq('status', 'new').limit(10)
  const targets = (leads ?? []) as any[]
  if (!targets.length) return 0

  let sent = 0
  for (const lead of targets) {
    const systemPrompt = `You are an Outreach Specialist. Write a personalized outreach message for this lead. Keep it concise and value-focused. Return JSON: {"message": "outreach text", "subject": "email subject"}.`
    const result = await executeAgentTask(supabase, userId, null, `Create outreach for ${lead.name} at ${lead.company || lead.name} in ${lead.industry || 'their industry'}`, { systemPrompt })
    try {
      const parsed = JSON.parse(result.response || '{}')
      await storeMemory(supabase, userId, {
        agent_id: null, category: 'outreach', tags: [lead.id, 'outreach'],
        content: { leadId: lead.id, leadName: lead.name, subject: parsed.subject, message: parsed.message, status: 'sent' },
      })
      await supabase.from('leads').update({ status: 'contacted', updated_at: new Date().toISOString() }).eq('id', lead.id)
      await supabase.from('execution_logs').insert([{
        user_id: userId, command_id: null, action: '[Revenue] Outreach sent', module: 'sales', status: 'success',
        message: `${lead.name} — ${(parsed.subject || '').slice(0, 60)}`, entity_type: 'lead', entity_id: lead.id,
      }])
      sent++
    } catch { continue }
  }
  return sent
}

export async function generateProposals(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: leads } = await supabase.from('leads').select('id, name, company, industry, score').eq('user_id', userId).eq('status', 'qualified').limit(5)
  const qualified = (leads ?? []) as any[]
  if (!qualified.length) return 0

  let generated = 0
  for (const lead of qualified) {
    const systemPrompt = `You are a Proposal Generator. Create a professional service proposal outline. Return JSON: {"proposal": "proposal text", "services": ["service1", "service2"], "estimatedBudget": number}.`
    const result = await executeAgentTask(supabase, userId, null, `Create a proposal for ${lead.name} at ${lead.company || lead.name} — industry: ${lead.industry || 'general'}, score: ${lead.score}`, { systemPrompt })
    try {
      const parsed = JSON.parse(result.response || '{}')
      await storeMemory(supabase, userId, {
        agent_id: null, category: 'proposal', tags: [lead.id, 'proposal'],
        content: { leadId: lead.id, leadName: lead.name, proposal: parsed.proposal, services: parsed.services, budget: parsed.estimatedBudget, status: 'draft' },
      })
      await supabase.from('leads').update({ status: 'proposal', updated_at: new Date().toISOString() }).eq('id', lead.id)
      await supabase.from('execution_logs').insert([{
        user_id: userId, command_id: null, action: '[Revenue] Proposal generated', module: 'sales', status: 'success',
        message: `${lead.name} — Budget: ${parsed.estimatedBudget || 'N/A'}`, entity_type: 'lead', entity_id: lead.id,
      }])
      generated++
    } catch { continue }
  }
  return generated
}

export async function bookMeetings(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: tasks } = await supabase.from('orchestrator_tasks').select('*').eq('user_id', userId).ilike('title', '%proposal%').eq('status', 'pending').limit(5)
  const pending = (tasks ?? []) as any[]
  if (!pending.length) return 0

  let booked = 0
  for (const task of pending) {
    await supabase.from('orchestrator_tasks').update({
      status: 'in_progress', assigned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', task.id)
    await enqueueJob(supabase, userId, 'agent_execution', {
      prompt: `Schedule a meeting to discuss the proposal: ${task.description || task.title}`,
      systemPrompt: 'You are a Meeting Scheduler. Book a follow-up meeting with the prospect.',
    })
    await supabase.from('execution_logs').insert([{
      user_id: userId, command_id: null, action: '[Revenue] Meeting scheduled', module: 'sales', status: 'success',
      message: task.title.slice(0, 80), entity_type: 'orchestrator_tasks', entity_id: task.id,
    }])
    booked++
  }
  return booked
}

export async function runFullRevenueCycle(
  supabase: SupabaseClient, userId: string
): Promise<{ scored: number; outreach: number; proposals: number; meetings: number; metrics: RevenueMetrics }> {
  const [scored, outreach, proposals, meetings] = await Promise.all([
    scoreUnscoredLeads(supabase, userId),
    runOutreachCampaign(supabase, userId),
    generateProposals(supabase, userId),
    bookMeetings(supabase, userId),
  ])
  const metrics = await getRevenueMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'revenue_cycle', tags: ['revenue', 'cycle'],
    content: { scored, outreach, proposals, meetings, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Revenue] Cycle completed', module: 'sales', status: 'success',
    message: `Scored: ${scored}, Outreach: ${outreach}, Proposals: ${proposals}, Meetings: ${meetings}`,
  }])

  // Extract revenue lessons for self-evolving Company Brain
  try { await extractRevenueLessons(supabase, userId, { scored, outreach, proposals, meetings }) } catch { /* non-blocking */ }

  return { scored, outreach, proposals, meetings, metrics }
}
