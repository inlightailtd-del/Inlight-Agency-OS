export interface V3CycleResult {
  objective: string
  status: 'completed' | 'failed' | 'running'
  phases: { phase: string; status: string; durationMs: number; detail: string }[]
  docsResearched: number
  browserActions: number
  archModules: number
  qualityScore: number
  testsGenerated: number
  branchesCreated: number
  rollbacks: number
  commits: number
  errors: string[]
  summary: string
}

export interface DocResearchResult {
  topic: string
  url: string
  summary: string
  relevance: number
}

export interface ArchModule {
  moduleName: string
  moduleType: string
  filePath: string
  imports: string[]
  exports: string[]
  complexity: number
  qualityScore: number
}

export interface TestResult {
  filePath: string
  testFilePath: string
  testType: string
  status: string
}

export interface BranchInfo {
  branchName: string
  baseBranch: string
  status: string
  commits: number
}

export interface RollbackResult {
  commitHash: string
  reason: string
  success: boolean
}
