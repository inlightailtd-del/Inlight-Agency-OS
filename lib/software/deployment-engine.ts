import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type DeployTarget = 'vercel' | 'cloudflare' | 'aws' | 'gcp' | 'azure' | 'docker'
export type DeployStatus = 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'rolled_back'

export interface DeploymentRecord {
  id: string
  projectId: string
  version: string
  target: DeployTarget
  status: DeployStatus
  url: string
  buildLog: string
  rollbackTo: string | null
  deployedAt: string
}

export async function deployToVercel(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  projectType: string,
  environment: 'production' | 'preview' = 'production'
): Promise<DeploymentRecord | null> {
  const systemPrompt = `You are a Vercel deployment engineer. Configure and execute a Vercel deployment. Return JSON: {"version": "1.0.0", "url": "https://project-name.vercel.app", "buildLog": "string", "status": "live|failed"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Deploy "${projectName}" (${projectType}) to Vercel ${environment}. Configure build settings, environment variables, and domains.`, { systemPrompt }
  )

  let deploy: any = {}
  try { deploy = JSON.parse(result.response || '{}') } catch { return null }

  const { data: record } = await supabase.from('deployments_sw').insert([{
    user_id: userId, project_id: projectId, version: deploy.version || '1.0.0',
    status: deploy.status === 'live' ? 'live' : 'failed',
    platform: 'vercel', environment, url: deploy.url || '',
    build_log: deploy.buildLog || '',
  }]).select('id').single()

  if (deploy.status === 'live') {
    const { data: current } = await supabase.from('software_projects').select('deploy_count').eq('id', projectId).single()
    await supabase.from('software_projects').update({
      status: 'maintenance', live_url: deploy.url || `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.vercel.app`,
      deploy_count: ((current as any)?.deploy_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId)
  }

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [projectId, 'vercel_deploy', environment],
    content: { projectId, version: deploy.version, url: deploy.url, environment, status: deploy.status, deployedAt: new Date().toISOString() },
  })

  return record ? { id: record.id, projectId, version: deploy.version || '1.0.0', target: 'vercel', status: (deploy.status || 'failed') as DeployStatus, url: deploy.url || '', buildLog: deploy.buildLog || '', rollbackTo: null, deployedAt: new Date().toISOString() } : null
}

export async function deployToCloudflare(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  projectType: string
): Promise<DeploymentRecord | null> {
  const systemPrompt = `You are a Cloudflare deployment engineer. Configure and execute a Cloudflare Pages deployment. Return JSON: {"version": "1.0.0", "url": "https://project-name.pages.dev", "buildLog": "string", "status": "live|failed"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Deploy "${projectName}" (${projectType}) to Cloudflare Pages. Configure build settings, environment variables, and custom domain.`, { systemPrompt }
  )

  let deploy: any = {}
  try { deploy = JSON.parse(result.response || '{}') } catch { return null }

  const platform = 'cloudflare'
  const { data: record } = await supabase.from('deployments_sw').insert([{
    user_id: userId, project_id: projectId, version: deploy.version || '1.0.0',
    status: deploy.status === 'live' ? 'live' : 'failed',
    platform, environment: 'production', url: deploy.url || '',
    build_log: deploy.buildLog || '',
  }]).select('id').single()

  if (deploy.status === 'live') {
    await supabase.from('software_projects').update({
      status: 'maintenance', live_url: deploy.url || `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.pages.dev`,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId)
  }

  return record ? { id: record.id, projectId, version: deploy.version || '1.0.0', target: 'cloudflare', status: (deploy.status || 'failed') as DeployStatus, url: deploy.url || '', buildLog: deploy.buildLog || '', rollbackTo: null, deployedAt: new Date().toISOString() } : null
}

export async function rollbackDeployment(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  target: DeployTarget,
  toVersion?: string
): Promise<DeploymentRecord | null> {
  const { data: project } = await supabase.from('software_projects').select('name, project_type').eq('id', projectId).single()
  if (!project) return null

  const { data: currentDeploy } = await supabase.from('deployments_sw').select('id, version, url').eq('project_id', projectId).eq('status', 'live').order('created_at', { ascending: false }).limit(1).maybeSingle()

  const { data: targetDeploy } = toVersion
    ? await supabase.from('deployments_sw').select('id, version, url').eq('project_id', projectId).eq('version', toVersion).order('created_at', { ascending: false }).limit(1).maybeSingle()
    : await supabase.from('deployments_sw').select('id, version, url').eq('project_id', projectId).eq('status', 'live').order('created_at', { ascending: true }).limit(1).maybeSingle()

  const rollbackVersion = targetDeploy?.version || '1.0.0'
  const rollbackUrl = targetDeploy?.url || project.name

  const systemPrompt = `You are a DevOps engineer. Execute a deployment rollback. Return JSON: {"success": true, "message": "Rolled back to v${rollbackVersion}", "newUrl": "${rollbackUrl}"}`
  await executeAgentTask(supabase, userId, null,
    `Rollback ${project.name} on ${target} from version ${currentDeploy?.version || 'unknown'} to version ${rollbackVersion}.`, { systemPrompt }
  )

  if (currentDeploy) {
    await supabase.from('deployments_sw').update({
      status: 'rolled_back', updated_at: new Date().toISOString(),
    }).eq('id', currentDeploy.id)
  }

  const { data: record } = await supabase.from('deployments_sw').insert([{
    user_id: userId, project_id: projectId, version: rollbackVersion,
    status: 'live', platform: target, environment: 'production',
    url: rollbackUrl, rollback_from: currentDeploy?.version || null,
  }]).select('id').single()

  await supabase.from('software_projects').update({
    live_url: rollbackUrl, updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [projectId, 'rollback', target],
    content: { projectId, fromVersion: currentDeploy?.version, toVersion: rollbackVersion, target, rolledBackAt: new Date().toISOString() },
  })

  return record ? { id: record.id, projectId, version: rollbackVersion, target, status: 'live', url: rollbackUrl, buildLog: `Rolled back from ${currentDeploy?.version || 'unknown'} to ${rollbackVersion}`, rollbackTo: currentDeploy?.version || null, deployedAt: new Date().toISOString() } : null
}

export async function deploySoftwareProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  target: DeployTarget = 'vercel'
): Promise<{ deployed: number; url?: string }> {
  const { data: project } = await supabase.from('software_projects').select('id, name, project_type').eq('id', projectId).single()
  if (!project) return { deployed: 0 }

  const record = target === 'cloudflare'
    ? await deployToCloudflare(supabase, userId, projectId, project.name, project.project_type)
    : await deployToVercel(supabase, userId, projectId, project.name, project.project_type)

  return { deployed: record ? 1 : 0, url: record?.url }
}

export async function deployMultipleProjects(
  supabase: SupabaseClient,
  userId: string,
  target: DeployTarget = 'vercel'
): Promise<{ deployed: number; rollbacks: number }> {
  const { data: projects } = await supabase.from('software_projects').select('id, name, project_type').eq('user_id', userId).eq('status', 'deployment').limit(5)
  let deployed = 0

  for (const p of (projects ?? []) as any[]) {
    const result = await deploySoftwareProject(supabase, userId, p.id, target)
    if (result.deployed) deployed++
  }

  const { data: failedDeploys } = await supabase.from('deployments_sw').select('project_id, version').eq('user_id', userId).eq('status', 'failed').limit(3)
  let rollbacks = 0
  for (const d of (failedDeploys ?? []) as any[]) {
    const result = await rollbackDeployment(supabase, userId, d.project_id, target)
    if (result) rollbacks++
  }

  return { deployed, rollbacks }
}
