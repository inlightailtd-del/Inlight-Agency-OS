import type { SupabaseClient } from '@supabase/supabase-js'
import type { SwarmMessage, SwarmRound, SwarmParticipant, NegotiationRound } from './types'

export class NegotiationProtocol {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async propose(
    round: SwarmRound,
    fromAgentId: string,
    subject: string,
    body: string,
    context?: Record<string, any>
  ): Promise<SwarmMessage> {
    const { data, error } = await this.supabase.from('swarm_messages').insert([{
      round_id: round.id,
      user_id: this.userId,
      from_agent_id: fromAgentId,
      to_agent_id: null,
      message_type: 'proposal',
      subject,
      body,
      context: context ?? {},
    }]).select('*').single()

    if (error) throw new Error(`Failed to create proposal: ${error.message}`)
    return data as SwarmMessage
  }

  async counterOffer(
    originalMessage: SwarmMessage,
    fromAgentId: string,
    body: string,
    context?: Record<string, any>
  ): Promise<SwarmMessage> {
    const { data, error } = await this.supabase.from('swarm_messages').insert([{
      round_id: originalMessage.round_id,
      user_id: this.userId,
      from_agent_id: fromAgentId,
      to_agent_id: originalMessage.from_agent_id,
      message_type: 'counter_offer',
      subject: `Re: ${originalMessage.subject}`,
      body,
      context: { in_reply_to: originalMessage.id, ...context },
    }]).select('*').single()

    if (error) throw new Error(`Failed to create counter-offer: ${error.message}`)
    return data as SwarmMessage
  }

  async objection(
    round: SwarmRound,
    fromAgentId: string,
    subject: string,
    body: string,
    context?: Record<string, any>
  ): Promise<SwarmMessage> {
    const { data, error } = await this.supabase.from('swarm_messages').insert([{
      round_id: round.id,
      user_id: this.userId,
      from_agent_id: fromAgentId,
      to_agent_id: null,
      message_type: 'objection',
      subject,
      body,
      context: context ?? {},
    }]).select('*').single()

    if (error) throw new Error(`Failed to create objection: ${error.message}`)
    return data as SwarmMessage
  }

  async getProposalThread(
    roundId: string,
    subject?: string
  ): Promise<SwarmMessage[]> {
    let q = this.supabase
      .from('swarm_messages')
      .select('*')
      .eq('round_id', roundId)
      .in('message_type', ['proposal', 'counter_offer', 'objection'])
      .order('created_at', { ascending: true })

    if (subject) {
      q = q.eq('subject', subject)
    }

    const { data } = await q
    return (data ?? []) as SwarmMessage[]
  }

  async negotiate(
    round: SwarmRound,
    participants: SwarmParticipant[],
    topic: string,
    proposerAgentId: string,
    proposal: string,
    maxRounds: number = 3
  ): Promise<NegotiationRound> {
    const negotiation: NegotiationRound = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      round_id: round.id,
      topic,
      status: 'open',
      proposals: [{
        agent_id: proposerAgentId,
        proposal,
        counter_proposals: [],
      }],
      concluded_at: null,
    }

    const initial = await this.propose(round, proposerAgentId, topic, proposal)

    for (let r = 0; r < maxRounds; r++) {
      const others = participants.filter((p) => p.agent_id !== proposerAgentId)

      for (const participant of others) {
        const thread = await this.getProposalThread(round.id, topic)
        const lastProposal = thread[thread.length - 1]

        if (lastProposal && lastProposal.from_agent_id !== participant.agent_id) {
          const counter = await this.counterOffer(
            lastProposal,
            participant.agent_id,
            `Response from ${participant.agent_id}: Reviewing proposal "${topic}". ${participant.role === 'mediator' ? 'Neutral assessment: ' : ''}Consider alternative approach.`
          )
          negotiation.proposals[0].counter_proposals.push({
            agent_id: participant.agent_id,
            proposal: counter.body,
          })
        }
      }

      const allAgreed = await this.checkConsensus(round.id, topic, participants)
      if (allAgreed) {
        negotiation.status = 'accepted'
        break
      }
    }

    if (negotiation.status === 'open') {
      negotiation.status = 'compromise'
    }

    negotiation.concluded_at = new Date().toISOString()
    return negotiation
  }

  private async checkConsensus(
    roundId: string,
    topic: string,
    participants: SwarmParticipant[]
  ): Promise<boolean> {
    const messages = await this.getProposalThread(roundId, topic)
    if (messages.length === 0) return false

    const participantIds = new Set(participants.map((p) => p.agent_id))
    const respondents = new Set(messages.map((m) => m.from_agent_id))
    const objectionCount = messages.filter((m) => m.message_type === 'objection').length

    return respondents.size >= participantIds.size * 0.6 && objectionCount === 0
  }
}
