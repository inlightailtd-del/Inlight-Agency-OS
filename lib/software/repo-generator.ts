import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface RepoConfig {
  name: string
  description: string
  visibility: 'public' | 'private'
  provider: 'github' | 'gitlab' | 'bitbucket'
  branches: string[]
  hasIssues: boolean
  hasWiki: boolean
  hasProjects: boolean
  template: string
  license: string
  gitignore: string
}

export interface WorkflowConfig {
  name: string
  on: string[]
  jobs: {
    name: string
    runsOn: string
    steps: { name: string; uses?: string; run?: string; env?: Record<string, string> }[]
  }[]
}

export async function generateRepository(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  projectType: string
): Promise<RepoConfig | null> {
  const systemPrompt = `You are a DevOps engineer. Design a git repository configuration. Return JSON: {"name": "string", "description": "string", "visibility": "public|private", "provider": "github|gitlab|bitbucket", "branches": ["main", "develop", "staging"], "hasIssues": true, "hasWiki": true, "hasProjects": true, "template": "string", "license": "MIT|Apache-2.0|GPL-3.0|BSD-3", "gitignore": "Node|Python|Rust|Go"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Design a git repository for "${projectName}" (${projectType} project). Include branch strategy, license, and gitignore choices.`, { systemPrompt }
  )

  let config: RepoConfig | null = null
  try { config = JSON.parse(result.response || '{}') } catch { return null }
  if (!config?.name) return null

  await supabase.from('code_repositories').insert([{
    user_id: userId, project_id: projectId, name: config.name,
    provider: config.provider, url: `https://${config.provider}.com/inlight/${config.name}`,
    language: projectType === 'saas' ? 'TypeScript' : 'JavaScript',
    visibility: config.visibility, license: config.license,
    total_commits: 0, branches: config.branches || ['main'],
  }]).maybeSingle()

  await supabase.from('software_projects').update({
    repo_config: config, updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [projectId, 'repo_generator', config.provider],
    content: { projectId, projectName, config, generatedAt: new Date().toISOString() },
  })

  return config
}

export async function generateGithubActions(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectType: string,
  techStack: string[]
): Promise<WorkflowConfig[]> {
  const systemPrompt = `You are a CI/CD engineer. Design GitHub Actions workflows. Return JSON: {"workflows": [{"name": "string", "on": ["push", "pull_request"], "jobs": [{"name": "string", "runsOn": "ubuntu-latest", "steps": [{"name": "string", "uses": "string", "run": "string", "env": {"key": "value"}}]}]}]}`
  const result = await executeAgentTask(supabase, userId, null,
    `Design GitHub Actions workflows for a ${projectType} project using ${(techStack || []).join(', ')}. Include CI, lint, test, and deploy workflows.`, { systemPrompt }
  )

  let workflows: WorkflowConfig[] = []
  try { workflows = JSON.parse(result.response || '{}').workflows || [] } catch { return [] }

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [projectId, 'github_actions', 'ci_cd'],
    content: { projectId, workflowCount: workflows.length, workflows, generatedAt: new Date().toISOString() },
  })

  return workflows
}
