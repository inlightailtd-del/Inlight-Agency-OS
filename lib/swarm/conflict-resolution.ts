import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SwarmConflict, SwarmRound, SwarmParticipant,
  ConflictType, ConflictSeverity, ConflictResolutionResult,
} from './types'
import { SharedMemorySystem } from './shared-memory'

const SEVERITY_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }

export class ConflictResolutionEngine {
  private sharedMemory: SharedMemorySystem

  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {
    this.sharedMemory = new SharedMemorySystem(supabase, userId)
  }

  async detectConflict(
    round: SwarmRound,
    agentsInvolved: string[],
    conflictType: ConflictType,
    title: string,
    description: string,
    severity: ConflictSeverity = 'medium'
  ): Promise<SwarmConflict> {
    const mediatorId = await this.selectMediator(agentsInvolved)

    const { data, error } = await this.supabase.from('swarm_conflicts').insert([{
      round_id: round.id,
      user_id: this.userId,
      title,
      description,
      conflict_type: conflictType,
      severity,
      agents_involved: agentsInvolved,
      mediator_agent_id: mediatorId,
      status: 'open',
    }]).select('*').single()

    if (error) throw new Error(`Failed to create conflict: ${error.message}`)
    return data as SwarmConflict
  }

  async resolve(
    conflict: SwarmConflict,
    participants: SwarmParticipant[],
    round: SwarmRound
  ): Promise<ConflictResolutionResult> {
    const start = Date.now()

    const strategy = await this.determineStrategy(conflict, participants)
    let resolution: string | null = null
    let status: 'resolved' | 'escalated' = 'resolved'
    let escalatedTo: string | null = null

    switch (strategy) {
      case 'auto_override': {
        const lead = participants.find((p) => p.role === 'lead')
        resolution = lead
          ? `Auto-override by lead agent ${lead.agent_id}: ${conflict.title} resolved by lead authority.`
          : `Auto-override: ${conflict.title} resolved with default approach.`
        break
      }
      case 'lead_decision': {
        const lead = participants.find((p) => p.role === 'lead')
        if (lead) {
          resolution = `Lead decision by ${lead.agent_id}: ${conflict.title} resolved per lead directive.`
        } else {
          escalatedTo = 'management'
          status = 'escalated'
          resolution = 'No lead available — escalated to management.'
        }
        break
      }
      case 'vote': {
        const { data: votes } = await this.supabase
          .from('swarm_consensus_votes')
          .select('*')
          .eq('round_id', conflict.round_id)
          .eq('proposal_key', `conflict:${conflict.id}`)

        const voteList = (votes ?? []) as any[]
        const approveWeight = voteList.filter((v) => v.vote === 'approve').reduce((s, v) => s + v.vote_weight, 0)
        const rejectWeight = voteList.filter((v) => v.vote === 'reject').reduce((s, v) => s + v.vote_weight, 0)
        const totalWeight = voteList.reduce((s, v) => s + v.vote_weight, 0)

        if (totalWeight > 0 && approveWeight / totalWeight >= 0.5) {
          resolution = `Vote resolved: approved (${approveWeight}/${totalWeight}).`
        } else if (totalWeight > 0) {
          resolution = `Vote resolved: rejected (${rejectWeight}/${totalWeight}). Alternative approach needed.`
        } else {
          resolution = `Vote inconclusive — escalated.`
          status = 'escalated'
          escalatedTo = 'management'
        }
        break
      }
      case 'escalate': {
        const lead = participants.find((p) => p.role === 'lead')
        escalatedTo = lead
          ? `lead:${lead.agent_id}`
          : `department:${round.department ?? 'management'}`
        resolution = `Escalated to ${escalatedTo} for resolution.`
        status = 'escalated'
        break
      }
    }

    const now = new Date().toISOString()
    await this.supabase.from('swarm_conflicts').update({
      status: status === 'escalated' ? 'escalated' : 'resolved',
      resolution,
      resolution_strategy: strategy,
      resolved_at: now,
      updated_at: now,
    }).eq('id', conflict.id)

    if (status === 'resolved') {
      const memoryKey = `resolved_conflict:${conflict.id}`
      await this.sharedMemory.write(memoryKey, {
        conflictId: conflict.id,
        title: conflict.title,
        type: conflict.conflict_type,
        resolution,
        resolvedBy: strategy,
        resolvedAt: now,
      }, { tags: ['resolved_conflict', conflict.conflict_type], overwrite: true })
    }

    return {
      conflict_id: conflict.id,
      status: status === 'escalated' ? 'escalated' : 'resolved',
      resolution,
      strategy,
      mediator_id: conflict.mediator_agent_id,
      escalated_to: escalatedTo,
      duration_ms: Date.now() - start,
    }
  }

  async getOpenConflicts(roundId: string): Promise<SwarmConflict[]> {
    const { data } = await this.supabase
      .from('swarm_conflicts')
      .select('*')
      .eq('round_id', roundId)
      .in('status', ['open', 'mediating'])
      .order('created_at', { ascending: true })
    return (data ?? []) as SwarmConflict[]
  }

  private async selectMediator(agentIds: string[]): Promise<string | null> {
    const { data: agents } = await this.supabase
      .from('agents')
      .select('id, performance_score, level')
      .in('id', agentIds)
      .order('performance_score', { ascending: false })

    if (!agents?.length) return null
    const sorted = agents as any[]
    return sorted.length >= 2 ? sorted[1]?.id ?? sorted[0].id : sorted[0].id
  }

  private async determineStrategy(
    conflict: SwarmConflict,
    participants: SwarmParticipant[]
  ): Promise<'auto_override' | 'lead_decision' | 'vote' | 'escalate'> {
    const severityLevel = SEVERITY_ORDER[conflict.severity] ?? 2
    const hasLead = participants.some((p) => p.role === 'lead')

    if (conflict.conflict_type === 'memory_write' && severityLevel <= 2) return 'auto_override'
    if (conflict.conflict_type === 'resource_allocation' && severityLevel >= 4) return 'escalate'
    if (hasLead && severityLevel <= 3) return 'lead_decision'
    if (participants.length >= 3) return 'vote'
    return 'escalate'
  }
}
