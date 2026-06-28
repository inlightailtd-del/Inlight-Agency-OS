import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface CicdPipeline {
  provider: 'github_actions' | 'gitlab_ci' | 'circleci' | 'jenkins'
  stages: CicdStage[]
  environmentVariables: { key: string; value: string; env: string[] }[]
  notifications: { onSuccess: string[]; onFailure: string[] }
}

export interface CicdStage {
  name: string
  image?: string
  commands: string[]
  artifacts?: string[]
  cache?: string[]
  environment?: string
  requireApproval?: boolean
  timeout?: number
}

const STAGE_TEMPLATES: Record<string, string> = {
  install: 'npm ci, pip install -r requirements.txt, bundle install',
  lint: 'npm run lint, ruff check ., rubocop',
  test: 'npm run test, pytest, rspec, vitest run',
  build: 'npm run build, docker build, webpack',
  deploy: 'vercel --prod, aws ecs deploy, kubectl apply',
  security: 'npm audit, snyk test, trivy scan',
}

export async function buildCicdPipeline(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectType: string,
  deployTarget: string
): Promise<CicdPipeline | null> {
  const availableStages = Object.keys(STAGE_TEMPLATES).join(', ')
  const systemPrompt = `You are a CI/CD engineer. Design a CI/CD pipeline. Return JSON: {"provider": "github_actions|gitlab_ci|circleci|jenkins", "stages": [{"name": "string", "image": "string", "commands": ["string"], "artifacts": ["string"], "cache": ["string"], "environment": "string", "requireApproval": false}], "environmentVariables": [{"key": "string", "value": "string", "env": ["staging","production"]}], "notifications": {"onSuccess": ["slack","email"], "onFailure": ["slack","email","pagerduty"]}}`
  const result = await executeAgentTask(supabase, userId, null,
    `Design a CI/CD pipeline for a ${projectType} project deploying to ${deployTarget}. Available stages: ${availableStages}. Choose the right stages and configure them.`, { systemPrompt }
  )

  let pipeline: CicdPipeline | null = null
  try { pipeline = JSON.parse(result.response || '{}') } catch { return null }
  if (!pipeline?.stages?.length) return null

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [projectId, 'cicd_builder', pipeline.provider],
    content: { projectId, projectType, deployTarget, pipeline, generatedAt: new Date().toISOString() },
  })

  return pipeline
}
