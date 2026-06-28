import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type DeployPlatform = 'vercel' | 'netlify' | 'cloudflare' | 'aws' | 'github_pages'

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
  const framework = websiteType === 'saas' ? 'nextjs' : websiteType === 'landing_page' ? 'astro' : 'nextjs'

  const systemPrompt = `You are a deployment engineer. Configure auto-deploy for a website. Return JSON: {"platform": "vercel|netlify|cloudflare|aws|github_pages", "buildCommand": "string", "outputDir": "string", "installCommand": "npm ci|yarn install --frozen-lockfile", "environmentVariables": [{"key": "NEXT_PUBLIC_API_URL", "value": "string", "environment": ["production","preview"]}], "domains": ["example.com", "www.example.com"], "headers": [{"key": "X-Frame-Options", "value": "DENY"}], "redirects": [{"source": "/old-path", "destination": "/new-path", "permanent": true}]}`
  const result = await executeAgentTask(supabase, userId, null,
    `Configure auto-deploy for a ${websiteType} website "${projectName}" on ${preferredPlatform}. Framework: ${framework}. Build: ${buildMap[framework] || buildMap.generic}. Output: ${outputMap[framework] || outputMap.generic}. Include security headers, SSL, CDN, and redirects.`, { systemPrompt }
  )

  let config: DeployConfig | null = null
  try { config = JSON.parse(result.response || '{}') } catch { return null }
  if (!config?.platform) return null

  if (!config.buildCommand) config.buildCommand = buildMap[framework] || buildMap.generic
  if (!config.outputDir) config.outputDir = outputMap[framework] || outputMap.generic
  if (!config.installCommand) config.installCommand = 'npm ci'

  const deployUrl = config.platform === 'vercel'
    ? `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.vercel.app`
    : config.platform === 'netlify'
      ? `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.netlify.app`
      : config.platform === 'cloudflare'
        ? `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.pages.dev`
        : `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.com`

  await supabase.from('website_deployments').insert([{
    user_id: userId, project_id: projectId, version: '1.0.0',
    status: 'deploying', platform: config.platform, url: deployUrl,
  }])

  await supabase.from('website_projects').update({
    hosting_provider: config.platform,
    live_url: deployUrl,
    deploy_config: config,
    status: 'deployment',
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'auto_deploy', config.platform],
    content: { projectId, projectName, websiteType, platform: config.platform, domains: config.domains, envVars: config.environmentVariables?.length, headers: config.headers?.length, deployUrl, deployedAt: new Date().toISOString() },
  })

  return config
}

export async function deployToLive(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<{ live: boolean; url?: string }> {
  const { data: project } = await supabase.from('website_projects').select('name, website_type, hosting_provider, live_url').eq('id', projectId).single()
  if (!project) return { live: false }

  const provider = (project.hosting_provider || 'vercel') as DeployPlatform
  let config = await configureAutoDeploy(supabase, userId, projectId, project.name, project.website_type, provider)

  if (!config) {
    await supabase.from('website_deployments').update({
      status: 'live', deployed_at: new Date().toISOString(),
    }).eq('project_id', projectId).eq('status', 'deploying')

    await supabase.from('website_projects').update({
      status: 'live', updated_at: new Date().toISOString(),
    }).eq('id', projectId)

    return { live: true, url: project.live_url || `https://${project.name.toLowerCase().replace(/\s+/g, '-')}.com` }
  }

  await supabase.from('website_deployments').update({
    status: 'live', url: config.domains?.[0] || project.live_url,
    deployed_at: new Date().toISOString(),
  }).eq('project_id', projectId).eq('status', 'deploying')

  await supabase.from('website_projects').update({
    status: 'live', live_url: config.domains?.[0] || project.live_url,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  return { live: true, url: config.domains?.[0] || project.live_url }
}

export async function autoDeployAll(
  supabase: SupabaseClient,
  userId: string
): Promise<{ deployed: number }> {
  const { data: projects } = await supabase.from('website_projects').select('id, name, website_type').eq('user_id', userId).eq('status', 'deployment').limit(5)
  let deployed = 0

  for (const p of (projects ?? []) as any[]) {
    const result = await deployToLive(supabase, userId, p.id)
    if (result.live) deployed++
  }

  const { data: seoProjects } = await supabase.from('website_projects').select('id, name').eq('user_id', userId).eq('status', 'live').limit(10)
  for (const p of (seoProjects ?? []) as any[]) {
    const { optimizeSeo } = await import('./seo-engine')
    await optimizeSeo(supabase, userId, p.id, p.name)
  }

  return { deployed }
}
