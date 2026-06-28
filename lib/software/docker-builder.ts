import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface DockerConfig {
  baseImage: string
  dockerfile: string
  dockerCompose: string
  services: { name: string; image: string; ports: string[]; volumes: string[]; environment: Record<string, string>; dependsOn: string[] }[]
  dockerignore: string
  buildArgs: Record<string, string>
  healthcheck: { test: string[]; interval: string; timeout: string; retries: number }
}

export async function generateDockerConfig(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectType: string,
  techStack: string[],
  includeCompose: boolean = true
): Promise<DockerConfig | null> {
  const systemPrompt = `You are a DevOps engineer specializing in Docker. Generate Docker configuration. Return JSON: {"baseImage": "node:20-alpine|python:3.12-slim|rust:1.75-slim", "dockerfile": "full Dockerfile content", "dockerCompose": "docker-compose.yml content including services", "services": [{"name": "app", "image": "string", "ports": ["3000:3000"], "volumes": [".:/app"], "environment": {"NODE_ENV": "production"}, "dependsOn": ["db","redis"]}], "dockerignore": ".dockerignore content", "buildArgs": {"KEY": "value"}, "healthcheck": {"test": ["CMD","curl","-f","http://localhost"], "interval": "30s", "timeout": "10s", "retries": 3}}`
  const result = await executeAgentTask(supabase, userId, null,
    `Generate Docker configuration for a ${projectType} project using ${(techStack || []).join(', ')}.${includeCompose ? ' Include docker-compose.yml with database and cache services.' : ''} Generate real, working Dockerfile content.`, { systemPrompt }
  )

  let config: DockerConfig | null = null
  try { config = JSON.parse(result.response || '{}') } catch { return null }
  if (!config?.dockerfile) return null

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [projectId, 'docker_builder', projectType],
    content: { projectId, projectType, techStack, services: config.services?.length, hasCompose: !!config.dockerCompose, generatedAt: new Date().toISOString() },
  })

  return config
}
