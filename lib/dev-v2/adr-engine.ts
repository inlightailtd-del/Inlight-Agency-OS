import type { ADR } from './types'

export class ADREngine {
  private supabase: any
  private userId: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async record(adr: ADR): Promise<{ id: string }> {
    const { data, error } = await this.supabase.from('dev_adr').insert([{
      user_id: this.userId,
      cycle_id: adr.cycleId || null,
      title: adr.title,
      context: adr.context,
      decision: adr.decision,
      alternatives: adr.alternatives,
      consequences: adr.consequences,
      status: adr.status || 'proposed',
      tags: adr.tags || [],
    }]).select('id').single()

    if (error) throw new Error(`ADR insert: ${error.message}`)
    return { id: (data as any).id }
  }

  async updateStatus(id: string, status: ADR['status'], supersededBy?: string) {
    const update: any = { status }
    if (supersededBy) update.superseded_by = supersededBy
    await this.supabase.from('dev_adr').update(update).eq('id', id)
  }

  async getActive(limit = 20): Promise<ADR[]> {
    const { data } = await this.supabase
      .from('dev_adr')
      .select('*')
      .eq('user_id', this.userId)
      .in('status', ['proposed', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(limit)
    return ((data as any[]) || []).map(this.mapAdr)
  }

  async getHistory(limit = 50): Promise<ADR[]> {
    const { data } = await this.supabase
      .from('dev_adr')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return ((data as any[]) || []).map(this.mapAdr)
  }

  async getByTag(tag: string): Promise<ADR[]> {
    const { data } = await this.supabase
      .from('dev_adr')
      .select('*')
      .eq('user_id', this.userId)
      .contains('tags', [tag])
      .order('created_at', { ascending: false })
    return ((data as any[]) || []).map(this.mapAdr)
  }

  async getDecisionContext(topic: string): Promise<string> {
    const { data } = await this.supabase
      .from('dev_adr')
      .select('title, decision, context')
      .eq('user_id', this.userId)
      .textSearch('title', topic, { config: 'english' })
      .limit(5)

    if (!(data as any[])?.length) return 'No previous decisions found on this topic.'
    return (data as any[]).map((d: any) => `- ${d.title}: ${d.decision.substring(0, 200)}`).join('\n')
  }

  async createFromDecision(title: string, context: string, decision: string, tags: string[] = []): Promise<ADR> {
    const adr: ADR = {
      title,
      context,
      decision,
      alternatives: [],
      consequences: 'Tracked automatically by ASE v2',
      status: 'accepted',
      tags: [...new Set(['ase-v2', ...tags])],
    }
    await this.record(adr)
    return adr
  }

  private mapAdr(d: any): ADR {
    return {
      id: d.id,
      cycleId: d.cycle_id,
      title: d.title,
      context: d.context,
      decision: d.decision,
      alternatives: d.alternatives || [],
      consequences: d.consequences || '',
      status: d.status,
      tags: d.tags || [],
    }
  }
}
