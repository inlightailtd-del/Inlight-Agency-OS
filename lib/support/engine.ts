import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface SupportTicket {
  id?: string
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  category: string
  customerName?: string
  customerEmail?: string
  assignedAgentId?: string
  resolution?: string
  createdAt?: string
  resolvedAt?: string
}

export interface SupportReport {
  summary: string
  openTickets: number
  resolvedTickets: number
  avgResolutionTime: string
  commonIssues: string[]
  suggestions: string[]
}

export interface SupportMetrics {
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  criticalTickets: number
  highPriorityTickets: number
  avgResolutionMinutes: number
}

export class SupportAgent {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async createTicket(ticket: Omit<SupportTicket, 'id' | 'status' | 'createdAt'>): Promise<SupportTicket> {
    const { data } = await this.supabase.from('support_tickets').insert([{
      user_id: this.userId,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      category: ticket.category || 'general',
      customer_name: ticket.customerName,
      customer_email: ticket.customerEmail,
      status: 'open',
    }]).select('*').single()

    await this.log('ticket_created', `Ticket: ${ticket.subject.substring(0, 60)} | Priority: ${ticket.priority}`)
    return this.mapTicket(data)
  }

  async resolveTicket(ticketId: string, resolution: string): Promise<SupportTicket> {
    const { data } = await this.supabase.from('support_tickets').update({
      status: 'resolved',
      resolution,
      resolved_at: new Date().toISOString(),
    }).eq('id', ticketId).select('*').single()

    await this.log('ticket_resolved', `Ticket ${ticketId} resolved`)
    return this.mapTicket(data)
  }

  async assignTicket(ticketId: string, agentId: string): Promise<SupportTicket> {
    const { data } = await this.supabase.from('support_tickets').update({
      status: 'in_progress',
      assigned_agent_id: agentId,
    }).eq('id', ticketId).select('*').single()

    return this.mapTicket(data)
  }

  async getOpenTickets(limit = 20): Promise<SupportTicket[]> {
    const { data } = await this.supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', this.userId)
      .in('status', ['open', 'in_progress'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    return ((data ?? []) as any[]).map((d: any) => this.mapTicket(d))
  }

  async autoRespond(ticketId: string): Promise<string> {
    const ticket = await this.getTicket(ticketId)
    if (!ticket) throw new Error('Ticket not found')

    const systemPrompt = `You are a Customer Support AI. Draft a helpful response to this support ticket. Be professional, empathetic, and solution-oriented. Return only the response text.`

    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Customer issue: ${ticket.description}\n\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\n\nDraft a response:`,
      { systemPrompt }
    )

    const response = result.response || 'Thank you for reaching out. We are reviewing your request and will get back to you shortly.'

    await this.supabase.from('support_tickets').update({
      auto_response: response,
      auto_responded_at: new Date().toISOString(),
    }).eq('id', ticketId)

    await this.log('ticket_auto_responded', `Ticket ${ticketId} — auto-response sent`)
    return response
  }

  async batchProcessOpenTickets(maxTickets = 5): Promise<{ processed: number; errors: string[] }> {
    const tickets = await this.getOpenTickets(maxTickets)
    let processed = 0
    const errors: string[] = []

    for (const ticket of tickets) {
      try {
        await this.autoRespond(ticket.id!)
        processed++
      } catch (e: any) {
        errors.push(`Ticket ${ticket.id}: ${e.message}`)
      }
    }

    await this.log('ticket_batch_process', `Processed ${processed}/${tickets.length} tickets`)
    return { processed, errors }
  }

  async assessSupportPerformance(): Promise<SupportReport> {
    const start = Date.now()
    const metrics = await this.gatherMetrics()

    const systemPrompt = `You are a Customer Support Manager. Assess support performance. Return JSON:
{
  "summary": "support performance summary",
  "commonIssues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`

    const stateText = [
      `Total tickets: ${metrics.totalTickets}`,
      `Open: ${metrics.openTickets}`,
      `In progress: ${metrics.inProgressTickets}`,
      `Resolved: ${metrics.resolvedTickets}`,
      `Critical priority: ${metrics.criticalTickets}`,
      `High priority: ${metrics.highPriorityTickets}`,
      `Avg resolution time: ${metrics.avgResolutionMinutes}min`,
    ].join('\n')

    const result = await executeAgentTask(this.supabase, this.userId, null, stateText, { systemPrompt })
    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response }

    await storeMemory(this.supabase, this.userId, {
      category: 'support_report',
      content: { type: 'support_performance', metrics, report: parsed, assessedAt: new Date().toISOString() },
      tags: ['support', 'performance'],
    })

    await this.log('support_assessment', `${metrics.openTickets} open, ${metrics.resolvedTickets} resolved | ${(Date.now() - start)}ms`)
    return {
      summary: parsed.summary || 'Support assessment completed',
      openTickets: metrics.openTickets,
      resolvedTickets: metrics.resolvedTickets,
      avgResolutionTime: `${metrics.avgResolutionMinutes} minutes`,
      commonIssues: parsed.commonIssues || [],
      suggestions: parsed.suggestions || [],
    }
  }

  async runSupportCycle(): Promise<{
    assessment: SupportReport
    autoProcessed: number
    autoErrors: string[]
  }> {
    const assessment = await this.assessSupportPerformance()
    const { processed: autoProcessed, errors: autoErrors } = await this.batchProcessOpenTickets(5)
    return { assessment, autoProcessed, autoErrors }
  }

  private async getTicket(ticketId: string): Promise<SupportTicket | null> {
    const { data } = await this.supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single()
    return data ? this.mapTicket(data) : null
  }

  private async gatherMetrics(): Promise<SupportMetrics> {
    const { data: tickets } = await this.supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', this.userId)

    const allTickets = (tickets ?? []) as any[]
    const resolved = allTickets.filter((t: any) => t.status === 'resolved')
    const resolutionTimes = resolved
      .filter((t: any) => t.resolved_at && t.created_at)
      .map((t: any) => (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 60000)

    return {
      totalTickets: allTickets.length,
      openTickets: allTickets.filter((t: any) => t.status === 'open').length,
      inProgressTickets: allTickets.filter((t: any) => t.status === 'in_progress').length,
      resolvedTickets: resolved.length,
      closedTickets: allTickets.filter((t: any) => t.status === 'closed').length,
      criticalTickets: allTickets.filter((t: any) => t.priority === 'critical').length,
      highPriorityTickets: allTickets.filter((t: any) => t.priority === 'high').length,
      avgResolutionMinutes: resolutionTimes.length
        ? Math.round(resolutionTimes.reduce((a: number, b: number) => a + b, 0) / resolutionTimes.length)
        : 0,
    }
  }

  private mapTicket(d: any): SupportTicket {
    return {
      id: d.id,
      subject: d.subject,
      description: d.description,
      priority: d.priority,
      status: d.status,
      category: d.category || 'general',
      customerName: d.customer_name,
      customerEmail: d.customer_email,
      assignedAgentId: d.assigned_agent_id,
      resolution: d.resolution,
      createdAt: d.created_at,
      resolvedAt: d.resolved_at,
    }
  }

  private async log(action: string, message: string, status = 'success'): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null,
        action: `[Support] ${action}`, module: 'support', status, message,
      }])
    } catch { /* best effort */ }
  }
}
