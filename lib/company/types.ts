export interface CompanyState {
  id: string
  status: 'initialized' | 'running' | 'paused' | 'stopped' | 'error'
  startedAt: string | null
  currentCycle: number
  totalCycles: number
  lastRunAt: string | null
  lastApprovalCheckAt: string | null
  errors: string[]
  approvedActions: number
  pendingApprovals: number
}

export interface CompanyCycleResult {
  cycleId: string
  startedAt: string
  completedAt: string
  durationMs: number
  phases: CompanyPhaseResult[]
  summary: string
  errors: string[]
  pendingApprovals: ApprovalItem[]
}

export interface CompanyPhaseResult {
  phase: string
  agent: string
  status: 'completed' | 'failed' | 'skipped' | 'pending_approval'
  durationMs: number
  summary: string
  error?: string
}

export interface ApprovalItem {
  id: string
  agent: string
  action: string
  description: string
  impact: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
}

export interface CompanyReport {
  reportDate: string
  period: 'morning' | 'evening' | 'daily'
  totalCycles: number
  completedPhases: number
  failedPhases: number
  pendingApprovals: number
  approvedActions: number
  ceoSummary: string
  ctoSummary: string
  cmoSummary: string
  cooSummary: string
  salesSummary: string
  devSummary: string
  mediaBuyerSummary: string
  designerSummary: string
  videoEditorSummary: string
  supportSummary: string
  topIssues: string[]
  recommendedActions: string[]
  generatedAt: string
}

export type CompanyAgentRole =
  | 'ceo' | 'cto' | 'cmo' | 'coo'
  | 'sales' | 'developer' | 'media_buyer'
  | 'designer' | 'video_editor' | 'support'
