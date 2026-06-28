import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConsensusVote, ConsensusResult, SwarmRound, SwarmParticipant,
  VoteType,
} from './types'
import { getVoteWeight, CONSENSUS_DEFAULTS } from './types'

export class ConsensusEngine {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async castVote(
    round: SwarmRound,
    agentId: string,
    proposalKey: string,
    vote: VoteType,
    rationale?: string
  ): Promise<ConsensusVote> {
    const participant = await this.getParticipant(round.id, agentId)
    const weight = participant?.vote_weight ?? getVoteWeight({
      performance_score: 50,
      level: 1,
    })

    const { data, error } = await this.supabase.from('swarm_consensus_votes').insert([{
      round_id: round.id,
      user_id: this.userId,
      agent_id: agentId,
      proposal_key: proposalKey,
      vote,
      rationale: rationale ?? null,
      vote_weight: weight,
    }]).select('*').single()

    if (error) throw new Error(`Failed to cast vote: ${error.message}`)
    return data as ConsensusVote
  }

  async tally(
    round: SwarmRound,
    proposalKey: string,
    participants: SwarmParticipant[],
    opts?: {
      quorumRatio?: number
      passThreshold?: number
    }
  ): Promise<ConsensusResult> {
    const { data: votes } = await this.supabase
      .from('swarm_consensus_votes')
      .select('*')
      .eq('round_id', round.id)
      .eq('proposal_key', proposalKey)

    const voteList = (votes ?? []) as ConsensusVote[]
    const quorumRatio = opts?.quorumRatio ?? CONSENSUS_DEFAULTS.quorum_ratio
    const passThreshold = opts?.passThreshold ?? CONSENSUS_DEFAULTS.pass_threshold

    const totalPossibleWeight = participants.reduce((s, p) => s + p.vote_weight, 0)
    const votedAgentIds = new Set(voteList.map((v) => v.agent_id))
    const participatingWeight = participants
      .filter((p) => votedAgentIds.has(p.agent_id))
      .reduce((s, p) => s + p.vote_weight, 0)

    const quorumMet = participatingWeight / totalPossibleWeight >= quorumRatio
    const approveWeight = voteList.filter((v) => v.vote === 'approve').reduce((s, v) => s + v.vote_weight, 0)
    const rejectWeight = voteList.filter((v) => v.vote === 'reject').reduce((s, v) => s + v.vote_weight, 0)
    const abstainWeight = voteList.filter((v) => v.vote === 'abstain').reduce((s, v) => s + v.vote_weight, 0)

    let passed = false
    let status: ConsensusResult['status'] = 'failed'
    const totalVoteWeight = approveWeight + rejectWeight + abstainWeight

    if (!quorumMet) {
      status = 'failed'
    } else if (approveWeight > rejectWeight && approveWeight / totalVoteWeight >= passThreshold) {
      passed = true
      status = 'passed'
    } else if (approveWeight === rejectWeight) {
      status = 'tie'
    }

    const summary = quorumMet
      ? `${status.toUpperCase()}: ${approveWeight.toFixed(1)} approve, ${rejectWeight.toFixed(1)} reject, ${abstainWeight.toFixed(1)} abstain (${participatingWeight.toFixed(1)}/${totalPossibleWeight.toFixed(1)} weight, threshold ${(passThreshold * 100)}%)`
      : `FAILED (no quorum): ${participatingWeight.toFixed(1)}/${totalPossibleWeight.toFixed(1)} participated (need ${(quorumRatio * 100)}%)`

    return {
      proposal_key: proposalKey,
      status,
      total_weight: totalVoteWeight,
      approve_weight: approveWeight,
      reject_weight: rejectWeight,
      abstain_weight: abstainWeight,
      threshold: passThreshold,
      votes: voteList,
      passed,
      summary,
    }
  }

  async runConsensusCycle(
    round: SwarmRound,
    participants: SwarmParticipant[],
    proposalKey: string,
    maxRounds: number = CONSENSUS_DEFAULTS.max_vote_rounds
  ): Promise<ConsensusResult> {
    let result: ConsensusResult | null = null

    for (let r = 0; r < maxRounds; r++) {
      result = await this.tally(round, proposalKey, participants)

      if (result.status === 'passed' || r === maxRounds - 1) break

      const nonVoters = participants.filter(
        (p) => !result!.votes.some((v) => v.agent_id === p.agent_id)
      )

      for (const nv of nonVoters) {
        const defaultVote: VoteType = nv.role === 'observer' ? 'abstain' : 'reject'
        await this.castVote(round, nv.agent_id, proposalKey, defaultVote, 'Auto-cast: no response received')
      }
    }

    return result!
  }

  private async getParticipant(
    roundId: string,
    agentId: string
  ): Promise<SwarmParticipant | null> {
    const { data } = await this.supabase
      .from('swarm_round_participants')
      .select('*')
      .eq('round_id', roundId)
      .eq('agent_id', agentId)
      .single()
    return (data ?? null) as SwarmParticipant | null
  }
}
