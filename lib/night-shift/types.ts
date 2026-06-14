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
