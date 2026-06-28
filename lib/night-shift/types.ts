// ─── Existing Types (preserved) ───────────────────────────

export interface NightShiftGoal {
  id?: string; objective: string; priority: number; category: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped'
  tags: string[]; maxRetries: number; retryCount: number; scheduledFor?: string
  resultSummary?: string; resultData?: any; errorMessage?: string
}

export interface NightShiftReport {
  id?: string; reportDate: string; period: 'night' | 'day' | 'custom'
  totalGoals: number; completedGoals: number; failedGoals: number; skippedGoals: number
  totalPhases: number; totalCommits: number; totalErrors: number; totalDurationSeconds: number
  qualityScore: number; summary: string; topIssues: string[]; suggestedNext: string[]; lessons: any[]
}

export interface NightShiftResult {
  cycleCount: number; goalsCompleted: number; goalsFailed: number; goalsSkipped: number
  totalPhases: number; totalCommits: number; totalErrors: number; totalDurationMs: number
  report: NightShiftReport | null; errors: string[]; summary: string
}

// ─── Daemon Types ─────────────────────────────────────────

export type DaemonStatus = 'idle' | 'running' | 'paused' | 'error' | 'stopped'

export interface DaemonState {
  id: string
  status: DaemonStatus
  startedAt: string | null
  currentLoop: number
  totalLoops: number
  lastHeartbeat: string | null
  errors: string[]
  pid: number | null
  mode: 'auto' | 'manual'
  config: DaemonConfig
}

export interface DaemonConfig {
  loopIntervalMs: number
  maxConsecutiveErrors: number
  healthCheckIntervalMs: number
  gitAutoSync: boolean
  autoMergeEnabled: boolean
  autoRollbackEnabled: boolean
  maxGoalsPerCycle: number
}

export const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  loopIntervalMs: 30000,
  maxConsecutiveErrors: 5,
  healthCheckIntervalMs: 60000,
  gitAutoSync: true,
  autoMergeEnabled: true,
  autoRollbackEnabled: true,
  maxGoalsPerCycle: 3,
}

// ─── Git Operations Types ─────────────────────────────────

export interface GitBranch {
  name: string
  sha: string
  isDefault: boolean
  isProtected: boolean
  createdAt: string | null
  lastCommit: string | null
}

export interface GitCommit {
  sha: string
  message: string
  author: string
  date: string
  files: string[]
}

export interface GitPullRequest {
  id: number | string
  title: string
  description: string | null
  sourceBranch: string
  targetBranch: string
  state: 'open' | 'closed' | 'merged'
  mergeable: boolean
  checks: GitCheck[]
  createdAt: string
}

export interface GitCheck {
  name: string
  status: 'pending' | 'passed' | 'failed'
  description: string | null
}

export interface GitMergeResult {
  success: boolean
  prId: number | string | null
  sha: string | null
  mergedAt: string | null
  error: string | null
}

export interface GitRollbackResult {
  success: boolean
  fromSha: string
  toSha: string
  reason: string
  filesRestored: number
  timestamp: string
}

// ─── Monitoring Types ─────────────────────────────────────

export interface HealthMetric {
  name: string
  value: number
  unit: string
  status: 'ok' | 'warning' | 'critical'
  threshold: number
  measuredAt: string
}

export interface Heartbeat {
  daemonId: string
  timestamp: string
  uptime: number
  loopCount: number
  status: DaemonStatus
  metrics: HealthMetric[]
  errors: string[]
}

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  title: string
  message: string
  metadata: Record<string, any>
  acknowledged: boolean
  createdAt: string
}

export interface MonitoringReport {
  daemonId: string
  uptime: number
  totalLoops: number
  goalsCompleted: number
  goalsFailed: number
  branchesCreated: number
  prsMerged: number
  rollbacksPerformed: number
  errorsLast24h: number
  avgCycleTime: number
  healthScore: number
  alerts: Alert[]
  metrics: HealthMetric[]
}
