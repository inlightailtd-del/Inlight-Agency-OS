import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SwarmRound, SwarmParticipant, SwarmRoundStatus,
  SwarmConfig, SwarmEventType, SwarmEventHandler,
} from './types'
import { SharedMemorySystem } from './shared-memory'
import { NegotiationProtocol } from './negotiation'
import { ConflictResolutionEngine } from './conflict-resolution'
import { ConsensusEngine } from './consensus'
import { CrossDepartmentCollaboration } from './collaboration'
import { getVoteWeight } from './types'

export class SwarmEngine {
  private sharedMemory: SharedMemorySystem
  private negotiation: NegotiationProtocol
  private conflictEngine: ConflictResolutionEngine
  private consensus: ConsensusEngine
  private collaboration: CrossDepartmentCollaboration
  private eventHandlers: Map<SwarmEventType, SwarmEventHandler[]> = new Map()
  private config: Required<SwarmConfig>

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    config?: SwarmConfig
  ) {
    this.sharedMemory = new SharedMemorySystem(supabase, userId)
    this.negotiation = new NegotiationProtocol(supabase, userId)
    this.conflictEngine = new ConflictResolutionEngine(supabase, userId)
    this.consensus = new ConsensusEngine(supabase, userId)
    this.collaboration = new CrossDepartmentCollaboration(supabase, userId)

    this.config = {
      quorumRatio: config?.quorumRatio ?? 0.6,
      passThreshold: config?.passThreshold ?? 0.5,
      supermajorityThreshold: config?.supermajorityThreshold ?? 0.66,
      maxVoteRounds: config?.maxVoteRounds ?? 3,
      autoResolveConflicts: config?.autoResolveConflicts ?? true,
      logging: config?.logging ?? true,
    }
  }

  async initRound(params: {
    objective: string
    department?: string
    agentIds: { agentId: string; role: SwarmParticipant['role']; department?: string }[]
  }): Promise<SwarmRound> {
    const { data: round, error } = await this.supabase.from('swarm_rounds').insert([{
      user_id: this.userId,
      objective: params.objective,
      department: params.department ?? null,
      status: 'initiated',
      round_number: 1,
      context: {},
    }]).select('*').single()

    if (error) throw new Error(`Failed to init swarm round: ${error.message}`)
    const swarmRound = round as SwarmRound

    const agentIds = params.agentIds.map((a) => a.agentId)
    const { data: agents } = await this.supabase
      .from('agents')
      .select('id, performance_score, level, department')
      .in('id', agentIds)

    const agentMap = new Map((agents ?? []).map((a: any) => [a.id, a]))

    const participants = params.agentIds.map((a) => {
      const agent = agentMap.get(a.agentId) ?? { performance_score: 50, level: 1 }
      return {
        round_id: swarmRound.id,
        agent_id: a.agentId,
        role: a.role,
        department: a.department ?? agent.department ?? null,
        vote_weight: getVoteWeight(agent),
      }
    })

    if (participants.length > 0) {
      const { error: pErr } = await this.supabase
        .from('swarm_round_participants')
        .insert(participants)
      if (pErr) throw new Error(`Failed to add participants: ${pErr.message}`)
    }

    await this.updateRoundStatus(swarmRound.id, 'gathering')
    await this.log(`Swarm round started: "${params.objective}" with ${participants.length} agents`)

    await this.emit('swarm:round_started', { round: swarmRound, participants })
    return swarmRound
  }

  async runCycle(
    roundId: string,
    collaborationId?: string
  ): Promise<{
    round: SwarmRound
    status: SwarmRoundStatus
    tasksProcessed: number
    conflictsResolved: number
    consensusReached: boolean
  }> {
    const { data: raw } = await this.supabase
      .from('swarm_rounds')
      .select('*')
      .eq('id', roundId)
      .single()
    const round = raw as SwarmRound
    if (!round) throw new Error(`Round ${roundId} not found`)

    const { data: participants } = await this.supabase
      .from('swarm_round_participants')
      .select('*')
      .eq('round_id', roundId)
    const participantList = (participants ?? []) as SwarmParticipant[]

    await this.updateRoundStatus(roundId, 'negotiating')

    const openConflicts = await this.conflictEngine.getOpenConflicts(roundId)
    let conflictsResolved = 0

    if (this.config.autoResolveConflicts) {
      for (const conflict of openConflicts) {
        const result = await this.conflictEngine.resolve(conflict, participantList, round)
        if (result.status === 'resolved') conflictsResolved++
        await this.emit('swarm:conflict_resolved', { conflict, result })
      }
    }

    const remainingConflicts = await this.conflictEngine.getOpenConflicts(roundId)
    if (remainingConflicts.length > 0) {
      await this.updateRoundStatus(roundId, 'resolving')
      return {
        round, status: 'resolving',
        tasksProcessed: 0, conflictsResolved, consensusReached: false,
      }
    }

    const proposalKey = `round:${roundId}:objective`
    for (const p of participantList) {
      await this.consensus.castVote(
        round, p.agent_id, proposalKey, 'approve',
        `Auto-vote by ${p.role} ${p.agent_id}`
      )
    }

    const consensusResult = await this.consensus.runConsensusCycle(
      round, participantList, proposalKey, this.config.maxVoteRounds
    )

    await this.emit(
      consensusResult.passed ? 'swarm:consensus_reached' : 'swarm:consensus_failed',
      { round, result: consensusResult }
    )

    if (!consensusResult.passed) {
      await this.updateRoundStatus(roundId, 'failed')
      return {
        round, status: 'failed',
        tasksProcessed: 0, conflictsResolved, consensusReached: false,
      }
    }

    await this.updateRoundStatus(roundId, 'executing')

    let tasksProcessed = 0
    if (collaborationId) {
      const collabResult = await this.collaboration.orchestrateCrossDeptWorkflow(
        round, participantList, collaborationId
      )
      tasksProcessed = collabResult.tasksProcessed
    }

    await this.completeRound(round.id)
    await this.log(`Swarm round completed: "${round.objective}" — ${tasksProcessed} tasks, ${conflictsResolved} conflicts resolved`)

    await this.emit('swarm:round_completed', {
      round, tasksProcessed, conflictsResolved, consensusReached: true,
    })

    return {
      round, status: 'completed',
      tasksProcessed, conflictsResolved, consensusReached: true,
    }
  }

  async addParticipants(
    roundId: string,
    agents: { agentId: string; role: SwarmParticipant['role']; department?: string }[]
  ): Promise<void> {
    const { data: rawAgents } = await this.supabase
      .from('agents')
      .select('id, performance_score, level, department')
      .in('id', agents.map((a) => a.agentId))

    const agentMap = new Map((rawAgents ?? []).map((a: any) => [a.id, a]))

    const participants = agents.map((a) => {
      const agent = agentMap.get(a.agentId) ?? { performance_score: 50, level: 1 }
      return {
        round_id: roundId,
        agent_id: a.agentId,
        role: a.role,
        department: a.department ?? agent.department ?? null,
        vote_weight: getVoteWeight(agent),
      }
    })

    const { error } = await this.supabase
      .from('swarm_round_participants')
      .insert(participants)
    if (error) throw new Error(`Failed to add participants: ${error.message}`)
  }

  on(event: SwarmEventType, handler: SwarmEventHandler): void {
    const handlers = this.eventHandlers.get(event) ?? []
    handlers.push(handler)
    this.eventHandlers.set(event, handlers)
  }

  async getMemorySystem(): Promise<SharedMemorySystem> {
    return this.sharedMemory
  }

  async getNegotiationProtocol(): Promise<NegotiationProtocol> {
    return this.negotiation
  }

  async getConflictEngine(): Promise<ConflictResolutionEngine> {
    return this.conflictEngine
  }

  async getConsensusEngine(): Promise<ConsensusEngine> {
    return this.consensus
  }

  async getCollaborationSystem(): Promise<CrossDepartmentCollaboration> {
    return this.collaboration
  }

  private async emit(event: SwarmEventType, payload: any): Promise<void> {
    const handlers = this.eventHandlers.get(event) ?? []
    await Promise.allSettled(handlers.map((h) => h(payload)))
  }

  private async updateRoundStatus(roundId: string, status: SwarmRoundStatus): Promise<void> {
    await this.supabase.from('swarm_rounds').update({
      status,
      updated_at: new Date().toISOString(),
    }).eq('id', roundId)
  }

  private async completeRound(roundId: string): Promise<void> {
    const now = new Date().toISOString()
    await this.supabase.from('swarm_rounds').update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
    }).eq('id', roundId)
  }

  private async log(message: string): Promise<void> {
    if (!this.config.logging) return
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId,
        command_id: null,
        action: 'swarm_engine',
        module: 'swarm',
        entity_type: 'swarm_round',
        status: 'success',
        message,
      }])
    } catch { /* non-blocking */ }
  }
}
