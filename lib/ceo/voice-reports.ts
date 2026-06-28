import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { fetchJobs } from '@/lib/queue/queue'

export interface VoiceReport {
  type: 'daily_brief' | 'weekly_review' | 'alert' | 'status_update'
  title: string
  narration: string
  sections: VoiceReportSection[]
  duration_seconds: number
  generatedAt: string
}

export interface VoiceReportSection {
  heading: string
  content: string
  tone: 'normal' | 'urgent' | 'positive' | 'concerned'
}

async function logCeoAction(supabase: SupabaseClient, userId: string, action: string, detail: string) {
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[CEO] ${action}`,
    module: 'agents', status: 'success',
    message: detail, entity_type: 'ceo_voice',
  }])
}

export async function generateVoiceReport(
  supabase: SupabaseClient,
  userId: string,
  type: VoiceReport['type'] = 'daily_brief'
): Promise<VoiceReport> {
  const [jobs, { data: projects }, { data: tasks }, { data: invoices }, { data: expenses }, { data: leads }] = await Promise.all([
    fetchJobs(supabase, userId, undefined, undefined, 100),
    supabase.from('projects').select('*').eq('user_id', userId),
    supabase.from('tasks').select('*').in('status', ['todo', 'in_progress', 'review']),
    supabase.from('invoices').select('*').eq('user_id', userId),
    supabase.from('expenses').select('*').eq('user_id', userId),
    supabase.from('leads').select('*').eq('user_id', userId),
  ])

  const allProjects = (projects ?? []) as any[]
  const allTasks = (tasks ?? []) as any[]
  const allInvoices = (invoices ?? []) as any[]
  const allExpenses = (expenses ?? []) as any[]
  const allLeads = (leads ?? []) as any[]

  const totalRevenue = allInvoices.filter((i: any) => i.status === 'paid')
    .reduce((s: number, i: any) => s + Number(i.total || 0), 0)
  const totalExpenses = allExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
  const overdueInvoices = allInvoices.filter((i: any) => i.status === 'overdue')
  const overdueAmount = overdueInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0)
  const overdueTasks = allTasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date()).length
  const activeProjects = allProjects.filter((p: any) => p.status === 'active').length
  const atRiskProjects = allProjects.filter((p: any) => p.health === 'critical' || p.health === 'at_risk').length
  const openLeads = allLeads.filter((l: any) => l.status !== 'converted' && l.status !== 'lost').length
  const queueBacklog = jobs.filter((j) => j.status === 'pending').length

  const typeLabels: Record<string, string> = {
    daily_brief: 'Daily Voice Briefing',
    weekly_review: 'Weekly Performance Review',
    alert: 'Urgent Alert',
    status_update: 'System Status Update',
  }

  const systemPrompt = `You are the CEO Agent speaking directly to the agency owner. Generate a natural, conversational voice report.

Type: ${typeLabels[type]}
Date: ${new Date().toLocaleDateString()}

Generate the report in a spoken-word style (written to be READ ALOUD). Use natural language, pauses, and emphasis.

Provide JSON only:
{
  "title": "brief title",
  "narration": "a complete 30-60 second spoken summary that sounds natural when read aloud",
  "sections": [
    {
      "heading": "section name",
      "content": "spoken content for this section (2-4 sentences)",
      "tone": "normal|urgent|positive|concerned"
    }
  ]
}

Make each section 2-4 sentences of natural speech. Total narration should be concise but complete.`

  const stateText = [
    `=== AGENCY STATUS FOR VOICE REPORT ===`,
    `Revenue: PKR ${totalRevenue.toLocaleString()}`,
    `Expenses: PKR ${totalExpenses.toLocaleString()}`,
    `Overdue Invoices: ${overdueInvoices.length} (PKR ${overdueAmount.toLocaleString()})`,
    `Active Projects: ${activeProjects}`,
    `At-Risk Projects: ${atRiskProjects}`,
    `Overdue Tasks: ${overdueTasks}`,
    `Open Leads: ${openLeads}`,
    `Queue Backlog: ${queueBacklog}`,
  ].join('\n')

  const result = await executeAgentTask(supabase, userId, null, stateText, { systemPrompt })

  let parsed: any = { title: '', narration: '', sections: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.narration = result.response || 'Voice report generated.' }

  const sections: VoiceReportSection[] = (parsed.sections || []).map((s: any) => ({
    heading: s.heading || 'Update',
    content: s.content || 'No details.',
    tone: s.tone || 'normal',
  }))

  if (sections.length === 0) {
    sections.push({
      heading: 'Daily Briefing',
      content: parsed.narration || `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}. Here is your agency briefing.`,
      tone: 'normal',
    })
  }

  const totalWords = parsed.narration ? parsed.narration.split(' ').length : sections.reduce((s, sec) => s + sec.content.split(' ').length, 0)
  const durationSeconds = Math.max(15, Math.round(totalWords / 2.5))

  const report: VoiceReport = {
    type,
    title: parsed.title || `${typeLabels[type]} — ${new Date().toLocaleDateString()}`,
    narration: parsed.narration || sections.map((s) => s.content).join(' '),
    sections,
    duration_seconds: durationSeconds,
    generatedAt: new Date().toISOString(),
  }

  await storeMemory(supabase, userId, {
    category: 'ceo_voice_report',
    content: report,
    tags: ['ceo', 'voice', type, `date:${new Date().toISOString().slice(0, 10)}`],
  })

  await logCeoAction(supabase, userId, `Voice Report: ${type}`,
    `${report.title} — ${sections.length} sections, ~${durationSeconds}s narration`)

  return report
}

export async function getLatestVoiceReport(supabase: SupabaseClient, userId: string): Promise<VoiceReport | null> {
  const { data } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'ceo_voice_report')
    .order('created_at', { ascending: false })
    .limit(1)

  const rows = (data ?? []) as any[]
  if (!rows.length) return null
  return { ...rows[0].content, generatedAt: rows[0].created_at } as VoiceReport
}

export async function getVoiceReportStats(supabase: SupabaseClient, userId: string): Promise<{
  totalReports: number; lastReport: string | null
}> {
  const { count } = await supabase
    .from('agent_memory')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', 'ceo_voice_report')

  const { data: last } = await supabase
    .from('agent_memory')
    .select('created_at')
    .eq('user_id', userId)
    .eq('category', 'ceo_voice_report')
    .order('created_at', { ascending: false })
    .limit(1)

  return {
    totalReports: count || 0,
    lastReport: ((last ?? []) as any[])[0]?.created_at || null,
  }
}
