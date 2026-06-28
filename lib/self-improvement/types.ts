import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'

export interface PromptVersion {
  id: string
  name: string
  version: number
  systemPrompt: string
  userPromptTemplate: string | null
  agentType: string
  model: string | null
  tags: string[]
  score: number
  totalRuns: number
  successRate: number
  avgTokens: number
  avgDurationMs: number
  parentVersion: number | null
  isActive: boolean
  createdAt: string
}

export interface PromptTestResult {
  versionId: string
  runs: number
  successRate: number
  avgTokens: number
  avgDurationMs: number
  avgQuality: number
  score: number
}

export interface WorkflowPattern {
  id: string
  workflowType: string
  pattern: string
  frequency: number
  avgDurationMs: number
  successRate: number
  optimization: string | null
  impact: 'high' | 'medium' | 'low'
  applied: boolean
  detectedAt: string
}

export interface AgentKnowledge {
  agentId: string
  agentType: string
  department: string | null
  skills: string[]
  strengths: string[]
  weaknesses: string[]
  performanceScore: number
  successRate: number
  learnings: { pattern: string; source: string; applied: boolean }[]
  knowledgeAge: number
}

export interface SkillDownload {
  id: string
  skillName: string
  agentId: string
  agentType: string
  source: string
  priority: number
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  completedAt: string | null
  durationMs: number | null
}

export interface Bottleneck {
  id: string
  type: 'agent' | 'workflow' | 'integration' | 'memory' | 'queue' | 'prompt'
  targetId: string | null
  targetName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metric: string
  currentValue: number
  thresholdValue: number
  impact: string
  recommendation: string | null
  status: 'open' | 'resolved' | 'ignored'
  detectedAt: string
  resolvedAt: string | null
}

export interface SystemUpgrade {
  id: string
  title: string
  description: string
  category: 'prompt' | 'workflow' | 'agent_config' | 'system_config' | 'integration' | 'skill'
  priority: number
  expectedImpact: string
  source: string
  status: 'proposed' | 'approved' | 'applied' | 'failed' | 'rolled_back'
  appliedAt: string | null
  resultSummary: string | null
}

export interface ImprovementCycleResult {
  cycleId: string
  promptsOptimized: number
  workflowsImproved: number
  agentsTrained: number
  skillsDownloaded: number
  bottlenecksFound: number
  upgradesApplied: number
  score: number
  errors: string[]
  summary: string
  durationMs: number
}

export abstract class BaseSelfImprovementModule {
  protected supabase: SupabaseClient
  protected userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  protected async log(action: string, message: string, status = 'success') {
    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: `[SelfImprovement] ${action}`, module: 'self_improvement',
      status, message,
    }])
  }

  protected async storeBrain(category: string, content: Record<string, any>, tags: string[]) {
    await storeMemory(this.supabase, this.userId, {
      category: `self_improvement_${category}`, content, tags: ['self_improvement', ...tags],
    })
  }
}

export const PROMPT_OPTIMIZATION_THRESHOLDS = {
  minRunsForComparison: 10,
  significantImprovement: 0.05,
  autoPromoteThreshold: 0.10,
  maxVersionsPerPrompt: 20,
}

export const BOTTLENECK_THRESHOLDS = {
  agentSuccessRate: 60,
  workflowDurationMs: 60000,
  queueDepth: 20,
  memoryUsageMb: 500,
  errorRate: 0.1,
  integrationFailureRate: 0.15,
}
