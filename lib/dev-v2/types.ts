export interface GitCommit {
  id?: string
  cycleId?: string
  branch: string
  message: string
  filesChanged: string[]
  additions: number
  deletions: number
  status: 'staged' | 'committed' | 'pushed' | 'failed'
  hash?: string
  authorName?: string
  authorEmail?: string
}

export interface ADR {
  id?: string
  cycleId?: string
  title: string
  context: string
  decision: string
  alternatives: string[]
  consequences: string
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded'
  tags: string[]
}

export interface RCA {
  id?: string
  cycleId?: string
  symptom: string
  rootCause: string
  impact: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'build' | 'test' | 'runtime' | 'logic' | 'config'
  stacktrace?: string
  fix: string
  fixStatus: 'pending' | 'applied' | 'verified' | 'failed'
  prevention: string
}

export interface SwarmAgent {
  id?: string
  role: string
  specialization: string
  model: string
  temperature: number
  maxIterations: number
  isActive: boolean
  performanceMetrics: { successRate: number; avgDurationMs: number; tasksCompleted: number }
  instructions: string
}

export interface DevCycle {
  id?: string
  objective: string
  mode: 'full' | 'quick' | 'fix' | 'feature' | 'refactor'
  status: 'running' | 'completed' | 'failed' | 'learning'
  architectPlan?: any
  swarmComposition?: any
  executionLog: any[]
  errors: string[]
  lessonsLearned: any[]
  commitCount: number
  fileCount: number
  durationMs?: number
  startedAt: string
  completedAt?: string
}

export interface RepoNode {
  filePath: string
  fileType: string
  imports: string[]
  exportedBy: string[]
  dependencies: string[]
  dependents: string[]
  sizeBytes: number
  hash: string
}

export interface SwarmTask {
  id: string
  cycleId: string
  role: string
  instruction: string
  files: { operation: 'create' | 'modify' | 'delete'; path: string; content?: string; description: string }[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'review'
  output: string
  buildOutput: string
  durationMs: number
  error?: string
}

export interface V2CycleResult {
  objective: string
  status: string
  cycles: number
  commits: number
  filesChanged: number
  adrsCreated: number
  rcasLogged: number
  errors: string[]
  summary: string
  phases: { phase: string; status: string; durationMs: number; detail: string }[]
}
