import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'

export type ArchitectPlan = {
  goal: string
  title: string
  overview: string
  components: { name: string; description: string; priority: number; dependencies: string[] }[]
  phases: { phase: number; name: string; description: string; components: string[] }[]
  estimatedComplexity: 'low' | 'medium' | 'high'
  risks: string[]
}

export type PlannerTask = {
  id: string
  planTitle: string
  title: string
  description: string
  agentType: string
  priority: number
  dependencies: string[]
  estimatedMinutes: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export type BuildResult = {
  taskId: string
  taskTitle: string
  agentType: string
  success: boolean
  output: string
  filesChanged: string[]
  durationMs: number
  error?: string
}

export type ValidationResult = {
  taskId: string
  check: 'build' | 'test' | 'lint' | 'security'
  success: boolean
  output: string
  durationMs: number
  issues: string[]
}

export type DevelopmentCycleResult = {
  cycleId: string
  goal: string
  plan: ArchitectPlan | null
  tasks: PlannerTask[]
  builds: BuildResult[]
  validations: ValidationResult[]
  refactors: BuildResult[]
  lessonsLearned: number
  status: string
  errors: string[]
  summary: string
  filesCreated?: number
  spec?: any
  totalFiles?: number
  totalDirs?: number
  recommendations?: string[]
  patternsFound?: { type: string; description: string; action: string }[]
  totalAttempts?: number
  cycles?: any[]
}

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  architect: `You are the Architect Agent for Inlight Agency OS. Your role is to analyze development goals and create detailed implementation plans.

Rules:
- Analyze the goal carefully
- Break into clear components with dependencies
- Define implementation phases
- Identify risks and complexity
- Use existing Inlight Agency OS patterns:
  - Next.js 14 App Router with TypeScript
  - Supabase for database
  - Queue system at lib/queue/
  - Integration SDK at lib/integrations/
  - AI execution at lib/ai/execution
  - Memory at lib/ai/memory
  - Execution logs at execution_logs table

Output a structured plan with components, phases, dependencies, and risks.`,

  planner: `You are the Planner Agent. Your role is to break architectural plans into specific, executable tasks.

Rules:
- Each task must be assigned to exactly one agent type: 'backend' | 'frontend' | 'database' | 'integrations' | 'automation'
- Define clear dependencies between tasks
- Estimate effort in minutes
- Tasks should be small enough to complete in one session
- Order tasks for maximum parallel execution
- Plan database migrations first
- Plan backend APIs before frontend
- Plan integration configs alongside backend`,

  backend: `You are a Backend Builder Agent. You build Next.js API routes, server functions, and data access layers.

Rules:
- Use Next.js 14 App Router patterns (route.ts files)
- Use supabase-js for database access
- Use createClient() from @/lib/supabase/server
- Follow existing patterns in lib/
- Add types in types.ts files
- Add index.ts exports
- Keep functions focused and single-purpose`,

  frontend: `You are a Frontend Builder Agent. You build React components using Next.js App Router.

Rules:
- Use 'use client' directive for client components
- Use Tailwind CSS for styling
- Follow existing dashboard patterns
- Components go in components/
- Pages go in app/dashboard/
- Use fetch() for API calls
- Handle loading, error, and empty states`,

  database: `You are a Database Agent. You design and build database schemas.

Rules:
- Create migration files in supabase/migrations/
- Use 'create table if not exists'
- Add RLS policies for user isolation
- Add indexes for performance
- Use auth.users for user references
- Follow existing migration patterns`,

  integrations: `You are an Integrations Agent. You build provider integrations.

Rules:
- Extend IntegrationSDK in lib/integrations/sdk.ts
- Add providers in lib/integrations/providers.ts
- Add OAuth config in lib/integrations/oauth-config.ts
- Follow existing pattern of GmailProvider, LinkedInProvider
- Use real API calls, never mock data`,

  automation: `You are an Automation Agent. You build queue jobs and automated workflows.

Rules:
- Add job types to lib/queue/queue.ts
- Add handler in lib/queue/worker.ts
- Create engine files in lib/development/ or appropriate lib/
- Follow existing operation patterns`,

  validator: `You are the Validator Agent. You verify code quality and correctness.

Rules:
- Run 'npm run build' to check compilation
- Run 'npm run lint' to check code quality
- Check for TypeScript type errors
- Verify security patterns
- Check against Inlight Agency OS conventions:
  - No mock data in production code
  - Proper error handling
  - Auth checks on all API routes
  - Proper RLS policies
  - No hardcoded secrets`,

  refactor: `You are the Refactor Agent. You improve existing code.

Rules:
- Remove duplication by extracting shared logic
- Improve architectural patterns
- Split large files into modules
- Add missing error handling
- Improve type safety
- Keep backward compatibility
- Prefer small, focused refactors
- Always verify refactors pass build`,

  learner: `You are the Learning Agent. You analyze development history and extract lessons.

Rules:
- Identify successful patterns to repeat
- Identify failures to avoid
- Store fixes for common issues
- Track architecture decisions
- Update development patterns based on outcomes
- Focus on actionable improvements`,
}

export { AGENT_SYSTEM_PROMPTS }
