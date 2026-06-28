import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type BoilerplateType = 'nextjs' | 'express' | 'fastapi' | 'flask' | 'django' | 'rails' | 'spring' | 'remix' | 'nuxt' | 'astro'

export interface BoilerplateConfig {
  type: BoilerplateType
  name: string
  description: string
  files: { path: string; content: string }[]
  dependencies: string[]
  devDependencies: string[]
  scripts: Record<string, string>
  envVars: { key: string; description: string; default?: string }[]
  readme: string
}

const BOILERPLATE_PROMPTS: Record<string, string> = {
  nextjs: 'next.config.js, tsconfig.json, tailwind.config.js, .env.local, app/layout.tsx, app/page.tsx, components/',
  express: 'package.json, tsconfig.json, src/index.ts, src/routes/, src/middleware/, .env, src/types/',
  fastapi: 'requirements.txt, main.py, routers/, models/, schemas/, .env, alembic.ini',
  flask: 'requirements.txt, app.py, routes/, models/, templates/, static/, .env, config.py',
  django: 'requirements.txt, settings.py, urls.py, models.py, views.py, serializers.py, .env',
  rails: 'Gemfile, config/routes.rb, app/models/, app/controllers/, app/views/, config/database.yml',
  spring: 'pom.xml, application.yml, src/main/java/, src/main/resources/, Dockerfile',
  remix: 'remix.config.js, tsconfig.json, app/root.tsx, app/routes/, app/components/, .env',
  nuxt: 'nuxt.config.ts, tsconfig.json, pages/, components/, layouts/, .env, app/',
  astro: 'astro.config.mjs, tsconfig.json, src/pages/, src/components/, src/layouts/, .env',
}

export async function generateBoilerplate(
  supabase: SupabaseClient,
  userId: string,
  type: BoilerplateType,
  projectName: string,
  options?: { includeAuth?: boolean; includeDatabase?: boolean; includeTests?: boolean; includeDocker?: boolean }
): Promise<BoilerplateConfig | null> {
  const includeDetails = [
    options?.includeAuth ? 'auth (NextAuth/Clerk)' : '',
    options?.includeDatabase ? 'database (Postgres with Prisma/Drizzle)' : '',
    options?.includeTests ? 'testing (Vitest/Playwright)' : '',
    options?.includeDocker ? 'Dockerfile + docker-compose' : '',
  ].filter(Boolean).join(', ')
  const structureHint = BOILERPLATE_PROMPTS[type] || 'standard project structure'
  const systemPrompt = `You are a boilerplate generator. Generate a complete ${type} project boilerplate. Return JSON: {"type": "${type}", "name": "string", "description": "string", "files": [{"path": "string", "content": "string"}], "dependencies": ["string"], "devDependencies": ["string"], "scripts": {"dev": "string", "build": "string", "start": "string"}, "envVars": [{"key": "string", "description": "string", "default": "string"}], "readme": "string"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Generate a ${type} boilerplate for "${projectName}". Include ${structureHint}.${includeDetails ? ` Include: ${includeDetails}.` : ''} Generate real, working code files.`, { systemPrompt }
  )

  let config: BoilerplateConfig | null = null
  try { config = JSON.parse(result.response || '{}') } catch { return null }
  if (!config?.files?.length) return null

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: ['boilerplate', type, projectName],
    content: { type, projectName, fileCount: config.files.length, dependencies: config.dependencies, envVars: config.envVars, generatedAt: new Date().toISOString() },
  })

  return config
}

export async function scaffoldFromBoilerplate(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  type: BoilerplateType,
  projectName: string
): Promise<number> {
  const config = await generateBoilerplate(supabase, userId, type, projectName, {
    includeAuth: true, includeDatabase: true, includeTests: true, includeDocker: true,
  })
  if (!config) return 0

  await supabase.from('software_projects').update({
    tech_stack: [...new Set([...(config.dependencies || []), ...(config.devDependencies || [])])],
    boilerplate_type: type,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [projectId, 'boilerplate_scaffold', type],
    content: { projectId, type, projectName, fileCount: config.files.length, scripts: config.scripts, envVars: config.envVars, readmeLength: config.readme?.length, generatedAt: new Date().toISOString() },
  })

  return config.files.length
}
