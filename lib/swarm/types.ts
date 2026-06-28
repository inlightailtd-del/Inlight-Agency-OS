import type { SupabaseClient } from '@supabase/supabase-js'

export type SwarmRoundStatus = 'initiated' | 'gathering' | 'negotiating' | 'resolving' | 'consensus' | 'executing' | 'completed' | 'failed'
export type SwarmMessageType = 'proposal' | 'counter_offer' | 'vote' | 'objection' | 'resolution' | 'information'
export type VoteType = 'approve' | 'reject' | 'abstain' | 'amend'
export type ConflictType = 'resource_allocation' | 'priority' | 'approach' | 'budget' | 'timeline' | 'memory_write'
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ConflictStatus = 'open' | 'mediating' | 'resolved' | 'escalated'
export type ResolutionStrategy = 'auto_override' | 'lead_decision' | 'vote' | 'escalate'
export type CollaborationStatus = 'active' | 'blocked' | 'completed' | 'cancelled'

export interface SwarmRound {
  id: string
  user_id: string
  objective: string
  department: string | null
  status: SwarmRoundStatus
  round_number: number
  context: Record<string, any>
  started_at: string
  completed_at: string | null
}

export interface SwarmParticipant {
  id: string
  round_id: string
  agent_id: string
  role: 'lead' | 'contributor' | 'mediator' | 'observer'
  department: string | null
  vote_weight: number
  joined_at: string
}

export interface SwarmSharedMemory {
  id: string
  user_id: string
  key: string
  value: Record<string, any>
  writer_agent_id: string | null
  department: string | null
  tags: string[]
  version: number
  conflict_resolved: boolean
  created_at: string
  updated_at: string
}

export interface SwarmMessage {
  id: string
  round_id: string
  user_id: string
  from_agent_id: string
  to_agent_id: string | null
  message_type: SwarmMessageType
  subject: string | null
  body: string
  context: Record<string, any>
  created_at: string
}

export interface ConsensusVote {
  id: string
  round_id: string
  user_id: string
  agent_id: string
  proposal_key: string
  vote: VoteType
  rationale: string | null
  vote_weight: number
  created_at: string
}

export interface SwarmConflict {
  id: string
  round_id: string
  user_id: string
  title: string
  description: string | null
  conflict_type: ConflictType
  severity: ConflictSeverity
  agents_involved: string[]
  mediator_agent_id: string | null
  status: ConflictStatus
  resolution: string | null
  resolution_strategy: ResolutionStrategy | null
  created_at: string
  resolved_at: string | null
}

export interface SwarmCollaboration {
  id: string
  user_id: string
  title: string
  description: string | null
  departments: string[]
  lead_agent_id: string | null
  status: CollaborationStatus
  progress: number
  milestones: { title: string; completed: boolean; dueAt?: string }[]
  started_at: string
  completed_at: string | null
}

export interface SwarmCollabTask {
  id: string
  collaboration_id: string
  agent_id: string | null
  department: string | null
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'
  priority: string
  depends_on: string[]
  output: string | null
  started_at: string | null
  completed_at: string | null
}

export interface ConsensusResult {
  proposal_key: string
  status: 'passed' | 'failed' | 'tie'
  total_weight: number
  approve_weight: number
  reject_weight: number
  abstain_weight: number
  threshold: number
  votes: ConsensusVote[]
  passed: boolean
  summary: string
}

export interface NegotiationRound {
  id: string
  round_id: string
  topic: string
  status: 'open' | 'accepted' | 'rejected' | 'compromise'
  proposals: {
    agent_id: string
    proposal: string
    counter_proposals: { agent_id: string; proposal: string }[]
  }[]
  concluded_at: string | null
}

export interface ConflictResolutionResult {
  conflict_id: string
  status: ConflictStatus
  resolution: string | null
  strategy: ResolutionStrategy | null
  mediator_id: string | null
  escalated_to: string | null
  duration_ms: number
}

export interface MemorySubscription {
  key_pattern: string
  agent_id: string
  callback: string
  created_at: string
}

export interface DepartmentAuthorityScore {
  department: string
  authority: number
}

export const DEPARTMENT_AUTHORITY: Record<string, number> = {
  ceo: 1.0,
  management: 0.9,
  finance: 0.85,
  operations: 0.8,
  sales: 0.75,
  marketing: 0.7,
  content: 0.65,
  development: 0.7,
  design: 0.6,
  hr: 0.65,
}

export const CONSENSUS_DEFAULTS = {
  quorum_ratio: 0.6,
  pass_threshold: 0.5,
  supermajority_threshold: 0.66,
  max_vote_rounds: 3,
}

export function getVoteWeight(
  agent: { performance_score: number; level: number; department?: string | null }
): number {
  const perfWeight = agent.performance_score / 100
  const levelWeight = agent.level / 5
  const deptAuthority = agent.department ? (DEPARTMENT_AUTHORITY[agent.department] ?? 0.5) : 0.5
  return Number(((perfWeight * 0.4 + levelWeight * 0.3 + deptAuthority * 0.3)).toFixed(2))
}

export type SwarmEventType =
  | 'swarm:round_started'
  | 'swarm:round_completed'
  | 'swarm:round_failed'
  | 'swarm:message_sent'
  | 'swarm:memory_updated'
  | 'swarm:conflict_detected'
  | 'swarm:conflict_resolved'
  | 'swarm:consensus_reached'
  | 'swarm:consensus_failed'
  | 'swarm:vote_cast'
  | 'swarm:collaboration_updated'

export type SwarmEventHandler = (payload: any) => Promise<void>

export interface SwarmConfig {
  quorumRatio?: number
  passThreshold?: number
  supermajorityThreshold?: number
  maxVoteRounds?: number
  autoResolveConflicts?: boolean
  logging?: boolean
}
