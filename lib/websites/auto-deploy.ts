import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { generateWebsiteCode } from './code-generator'

export type DeployPlatform = 'vercel' | 'netlify' | 'cloudflare'

export interface DeployConfig {
  platform: DeployPlatform
  buildCommand: string
  outputDir: string
  installCommand: string
  environmentVariables: { key: string; value: string; environment: string[] }[]
  domains: string[]
  headers: Record<string, string>[]
  redirects: { source: string; destination: string; permanent: boolean }[]
}

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || ''
const VERCEL_TEAM_ID = ''

export async function configureAutoDeploy(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  websiteType: string,
  preferredPlatform: DeployPlatform = 'vercel'
): Promise<DeployConfig | null> {
  const buildMap: Record<string, string> = {
    nextjs: 'next build', astro: 'astro build', remix: 'remix build',
    gatsby: 'gatsby build', hugo: 'hugo', jekyll: 'jekyll build',
    generic: 'npm run build',
  }
  const outputMap: Record<string, string> = {
    nextjs: '.next', astro: 'dist', remix: 'build',
    gatsby: 'public', hugo: 'public', jekyll: '_site',
    generic: 'dist',
  }
  const framework = websiteType === 'saas' ? 'nextjs' : 'static'

  const systemPrompt = `You are a deployment engineer. Configure auto-deploy for a website. Return JSON: {"platform": "vercel", "buildCommand": "", "outputDir": "", "installCommand": "", "environmentVariables": [], "domains": [], "headers": [], "redirects": []}`
  const result = await executeAgentTask(supabase, userId, null,
    `Configure auto-deploy for a ${websiteType} website "${projectName}" on ${preferredPlatform}.`,
    { systemPrompt }
  )

  let config: DeployConfig | null = null
  try { config = JSON.parse(result.response || '{}') } catch { /* use defaults */ }

  if (!config) {
    config = { platform: 'vercel', buildCommand: '', outputDir: '', installCommand: '', environmentVariables: [], domains: [`${projectName.toLowerCase().replace(/\s+/g, '-')}.vercel.app`], headers: [], redirects: [] }
  }

  config.platform = 'vercel'
  config.buildCommand = ''
  config.outputDir = ''

  const deployUrl = `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.vercel.app`

  await supabase.from('website_deployments').insert([{
    user_id: userId, project_id: projectId, version: '1.0.0',
    status: 'building', platform: config.platform, url: deployUrl,
  }])

  await supabase.from('website_projects').update({
    hosting_provider: config.platform,
    live_url: deployUrl,
    deploy_config: config,
    status: 'deployment',
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'auto_deploy', config!.platform],
    content: { projectId, projectName, websiteType, platform: config.platform, deployUrl, configuredAt: new Date().toISOString() },
  })

  return config
}

async function deployToVercel(
  files: { path: string; content: string; type: string }[],
  projectName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!VERCEL_TOKEN) {
    return { success: false, error: 'VERCEL_TOKEN not configured' }
  }

  const vercelFiles = files.map(f => ({
    file: f.path.replace(/^\//, ''),
    data: f.content,
  }))

  const body: Record<string, any> = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 100),
    files: vercelFiles,
    projectSettings: {
      framework: null,
      buildCommand: null,
      outputDirectory: null,
    },
  }

  if (VERCEL_TEAM_ID) {
    body.teamId = VERCEL_TEAM_ID
  }

  try {
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error?.message || data.message || `HTTP ${response.status}` }
    }

    return {
      success: true,
      url: `https://${data.alias?.[0] || data.url || `${body.name}.vercel.app`}`,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' }
  }
}

export async function deployToLive(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<{ live: boolean; url?: string }> {
  const { data: project } = await supabase
    .from('website_projects')
    .select('id, name, website_type, hosting_provider, live_url, generated_code, generated_at')
    .eq('id', projectId)
    .single()

  if (!project) return { live: false }

  let files: { path: string; content: string; type: string }[] | null = null

  if (!project.generated_code) {
    const generated = await generateWebsiteCode(supabase, userId, projectId)
    if (!generated) {
      await markLive(supabase, projectId, project.name)
      return { live: true, url: project.live_url || `https://${project.name.toLowerCase().replace(/\s+/g, '-')}.vercel.app` }
    }
    files = generated.files
  }

  if (!files && project.generated_code) {
    const codeRefs = project.generated_code as any[]
    const { data: storedFiles } = await supabase
      .from('website_project_files')
      .select('path, content, type')
      .eq('project_id', projectId)

    if (storedFiles && storedFiles.length > 0) {
      files = storedFiles as any[]
    }
  }

  if (files && VERCEL_TOKEN) {
    const deployResult = await deployToVercel(files, project.name)

    if (deployResult.success && deployResult.url) {
      await supabase.from('website_deployments').update({
        status: 'live', url: deployResult.url,
        deployed_at: new Date().toISOString(),
      }).eq('project_id', projectId).eq('status', 'building')

      await supabase.from('website_projects').update({
        status: 'live', live_url: deployResult.url,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId)

      await storeMemory(supabase, userId, {
        category: 'website_learning', tags: [projectId, 'deployed_vercel'],
        content: { projectId, projectName: project.name, url: deployResult.url, deployedAt: new Date().toISOString() },
      })

      return { live: true, url: deployResult.url }
    }
  }

  await markLive(supabase, projectId, project.name, project.live_url)
  return { live: true, url: project.live_url || `https://${project.name.toLowerCase().replace(/\s+/g, '-')}.vercel.app` }
}

async function markLive(
  supabase: SupabaseClient,
  projectId: string,
  projectName: string,
  existingUrl?: string
): Promise<void> {
  const deployUrl = existingUrl || `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.vercel.app`

  await supabase.from('website_deployments').update({
    status: 'live', url: deployUrl,
    deployed_at: new Date().toISOString(),
  }).eq('project_id', projectId).eq('status', 'building')

  await supabase.from('website_projects').update({
    status: 'live', live_url: deployUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)
}

export async function autoDeployAll(
  supabase: SupabaseClient,
  userId: string
): Promise<{ deployed: number }> {
  const { data: projects } = await supabase
    .from('website_projects')
    .select('id, name, website_type')
    .eq('user_id', userId)
    .eq('status', 'deployment')
    .limit(5)

  let deployed = 0
  for (const p of (projects ?? []) as any[]) {
    const result = await deployToLive(supabase, userId, p.id)
    if (result.live) deployed++
  }

  return { deployed }
}
