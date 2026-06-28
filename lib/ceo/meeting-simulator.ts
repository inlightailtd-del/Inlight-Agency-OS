import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface MeetingSimulation {
  type: MeetingType
  title: string
  date: string
  participants: MeetingParticipant[]
  agenda: MeetingAgendaItem[]
  discussion: MeetingDiscussion[]
  decisions: MeetingDecision[]
  actionItems: MeetingActionItem[]
  summary: string
}

export type MeetingType = 'board' | 'quarterly_review' | 'strategy' | 'one_on_one' | 'all_hands'

export interface MeetingParticipant {
  name: string
  role: string
  department: string
}

export interface MeetingAgendaItem {
  topic: string
  duration_minutes: number
  led_by: string
}

export interface MeetingDiscussion {
  agendaItem: string
  keyPoints: string[]
  outcome: string
}

export interface MeetingDecision {
  decision: string
  reasoning: string
  impact: string
}

export interface MeetingActionItem {
  action: string
  assignee: string
  deadline: string
  priority: 'high' | 'medium' | 'low'
}

async function logCeoAction(supabase: SupabaseClient, userId: string, action: string, detail: string) {
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[CEO] ${action}`,
    module: 'agents', status: 'success',
    message: detail, entity_type: 'ceo_meeting',
  }])
}

const MEETING_SYSTEM_PROMPTS: Record<MeetingType, string> = {
  board: `You are facilitating a BOARD MEETING for an AI-powered digital agency.
Generate a realistic board meeting simulation including:
- Strategic discussion about agency direction
- Financial performance review
- Growth opportunities and risks
- Key decisions requiring board approval
- Action items for executive team`,
  quarterly_review: `You are facilitating a QUARTERLY BUSINESS REVIEW for an AI-powered digital agency.
Generate a realistic QBR simulation including:
- Quarterly performance vs targets
- Department reviews (sales, marketing, delivery)
- Wins and losses analysis
- Next quarter planning
- Resource allocation decisions`,
  strategy: `You are facilitating a STRATEGY MEETING for an AI-powered digital agency.
Generate a realistic strategy session including:
- Market position analysis
- Competitive landscape review
- Growth strategy discussion
- New service line evaluation
- Strategic partnership opportunities`,
  one_on_one: `You are facilitating a ONE-ON-ONE MEETING between the CEO and a department head.
Generate a realistic 1:1 including:
- Personal performance discussion
- Challenges and blockers
- Career development
- Department health check
- Action items`,
  all_hands: `You are facilitating an ALL-HANDS MEETING for an AI-powered digital agency.
Generate a realistic all-hands including:
- Company performance update
- Team wins and recognition
- Upcoming initiatives
- Q&A session outcomes
- Morale and culture discussion`,
}

export async function runMeetingSimulation(
  supabase: SupabaseClient,
  userId: string,
  type: MeetingType = 'board'
): Promise<MeetingSimulation> {
  const { data: agents } = await supabase
    .from('agents')
    .select('name, role, department')
    .eq('user_id', userId)
    .limit(8)

  const { data: projects } = await supabase
    .from('projects')
    .select('name, status, health')
    .eq('user_id', userId)
    .limit(10)

  const { data: invoices } = await supabase
    .from('invoices')
    .select('total, status')
    .eq('user_id', userId)
    .limit(50)

  const allAgents = (agents ?? []) as any[]
  const allProjects = (projects ?? []) as any[]
  const allInvoices = (invoices ?? []) as any[]

  const totalRevenue = allInvoices.filter((i: any) => i.status === 'paid')
    .reduce((s: number, i: any) => s + Number(i.total || 0), 0)

  const activeProjects = allProjects.filter((p: any) => p.status === 'active').length
  const atRiskProjects = allProjects.filter((p: any) => p.health === 'critical' || p.health === 'at_risk').length

  const contextText = [
    `=== AGENCY CONTEXT FOR MEETING ===`,
    `Meeting Type: ${type.replace(/_/g, ' ').toUpperCase()}`,
    `Date: ${new Date().toLocaleDateString()}`,
    `\nTeam (${allAgents.length} agents):`,
    ...allAgents.map((a: any) => `- ${a.name} (${a.role || a.department})`),
    `\nProjects: ${allProjects.length} total, ${activeProjects} active, ${atRiskProjects} at risk`,
    `Revenue: PKR ${totalRevenue.toLocaleString()}`,
    `\nGenerate a complete meeting simulation with realistic discussion, debate, and outcomes.`,
  ].join('\n')

  const systemPrompt = MEETING_SYSTEM_PROMPTS[type]

  const result = await executeAgentTask(supabase, userId, null, contextText, { systemPrompt })

  let parsed: any = {}
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed = {} }

  const meetingTypeNames: Record<MeetingType, string> = {
    board: 'Board Meeting',
    quarterly_review: 'Quarterly Business Review',
    strategy: 'Strategy Session',
    one_on_one: 'One-on-One',
    all_hands: 'All-Hands Meeting',
  }

  const defaultParticipants: MeetingParticipant[] = allAgents.length > 0
    ? allAgents.slice(0, 6).map((a: any) => ({
        name: a.name,
        role: a.role || 'Agent',
        department: a.department || 'general',
      }))
    : [
        { name: 'CEO Agent', role: 'Chief Executive Officer', department: 'executive' },
        { name: 'Sales Agent', role: 'Head of Sales', department: 'sales' },
        { name: 'Marketing Agent', role: 'Head of Marketing', department: 'marketing' },
      ]

  const simulation: MeetingSimulation = {
    type,
    title: parsed.title || `${meetingTypeNames[type]} — ${new Date().toLocaleDateString()}`,
    date: new Date().toISOString(),
    participants: (parsed.participants || defaultParticipants).map((p: any) => ({
      name: p.name || p.role || 'Team Member',
      role: p.role || 'Agent',
      department: p.department || 'general',
    })),
    agenda: (parsed.agenda || [
      { topic: 'Opening & Previous Action Items', duration_minutes: 5, led_by: 'CEO' },
      { topic: 'Financial Review', duration_minutes: 15, led_by: 'Finance' },
      { topic: 'Department Updates', duration_minutes: 20, led_by: 'Department Heads' },
      { topic: 'Strategic Discussion', duration_minutes: 15, led_by: 'CEO' },
      { topic: 'Action Items & Next Steps', duration_minutes: 5, led_by: 'CEO' },
    ]).map((a: any) => ({
      topic: a.topic || 'Discussion',
      duration_minutes: a.duration_minutes || 10,
      led_by: a.led_by || 'CEO',
    })),
    discussion: (parsed.discussion || []).map((d: any) => ({
      agendaItem: d.agendaItem || d.topic || 'General discussion',
      keyPoints: d.keyPoints || [d.keyPoint || d.outcome || 'Discussion occurred'].filter(Boolean),
      outcome: d.outcome || 'Agenda item reviewed',
    })),
    decisions: (parsed.decisions || parsed.actionItems || []).slice(0, 5).map((d: any) => ({
      decision: d.decision || d.action || d.description || 'Decision recorded',
      reasoning: d.reasoning || d.rationale || 'Based on discussion outcomes',
      impact: d.impact || 'To be evaluated',
    })),
    actionItems: (parsed.actionItems || parsed.nextSteps || []).slice(0, 7).map((a: any) => ({
      action: a.action || a.description || a.todo || 'Follow up on discussion',
      assignee: a.assignee || a.owner || 'CEO Agent',
      deadline: a.deadline || a.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      priority: a.priority || 'medium',
    })),
    summary: parsed.summary || parsed.executiveSummary ||
      `${meetingTypeNames[type]} completed. ${(parsed.decisions || []).length} decisions made, ${(parsed.actionItems || []).length} action items.`,
  }

  await storeMemory(supabase, userId, {
    category: 'ceo_meeting_simulation',
    content: simulation,
    tags: ['ceo', 'meeting', type, `date:${new Date().toISOString().slice(0, 10)}`],
  })

  for (const item of simulation.actionItems) {
    await supabase.from('orchestrator_tasks').insert([{
      user_id: userId,
      title: `Meeting: ${item.action.slice(0, 120)}`,
      description: `From ${simulation.title}: ${item.action}`,
      status: 'pending',
      priority: item.priority,
    }]).select('id')
  }

  await logCeoAction(supabase, userId, `Meeting Simulated: ${type}`,
    `${simulation.title}: ${simulation.agenda.length} agenda items, ${simulation.decisions.length} decisions, ${simulation.actionItems.length} actions`)

  return simulation
}

export async function getLatestMeetingSimulation(supabase: SupabaseClient, userId: string, type?: MeetingType): Promise<MeetingSimulation | null> {
  let q = supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'ceo_meeting_simulation')
    .order('created_at', { ascending: false })
    .limit(1)

  if (type) q = q.contains('tags', [type])

  const { data } = await q
  const rows = (data ?? []) as any[]
  if (!rows.length) return null
  return { ...rows[0].content, date: rows[0].created_at } as MeetingSimulation
}

export async function getMeetingStats(supabase: SupabaseClient, userId: string): Promise<{
  totalMeetings: number; meetingsByType: Record<string, number>; lastMeeting: string | null
}> {
  const { data } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'ceo_meeting_simulation')
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as any[]
  const meetingsByType: Record<string, number> = {}
  for (const row of rows) {
    const type = row.content?.type || 'unknown'
    meetingsByType[type] = (meetingsByType[type] || 0) + 1
  }

  return {
    totalMeetings: rows.length,
    meetingsByType,
    lastMeeting: rows[0]?.created_at || null,
  }
}
