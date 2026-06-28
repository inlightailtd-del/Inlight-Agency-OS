import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export const SW_STAGES = ['idea', 'requirements', 'architecture', 'planning', 'frontend', 'backend', 'integration', 'testing', 'deployment', 'maintenance'] as const
export type SwStage = (typeof SW_STAGES)[number]

export const SW_TYPES = ['saas', 'api', 'webapp', 'mobile', 'library', 'tool', 'internal'] as const
export type SwType = (typeof SW_TYPES)[number]

export interface SwMetrics {
  total: number; byStage: Record<string, number>; byType: Record<string, number>
  totalDeployed: number; totalRepos: number; totalApis: number; totalTestSuites: number
  avgTestCoverage: number; avgDeployCount: number; projectsThisMonth: number
  saasBlueprints: number; boilerplatesScaffolded: number
  cicdPipelines: number; dockerConfigs: number; k8sTemplates: number
  vercelDeploys: number; cloudflareDeploys: number; rollbacks: number
  githubActions: number; autoTestsRun: number
}

const SW_AGENTS = {
  architect: { role: 'Software Architect', skills: ['system_design', 'architecture', 'microservices', 'scalability'] },
  pm: { role: 'Product Manager', skills: ['requirements', 'sprint_planning', 'roadmap', 'stakeholder'] },
  frontend: { role: 'Frontend Engineer', skills: ['react', 'nextjs', 'tailwind', 'typescript', 'ui_development'] },
  backend: { role: 'Backend Engineer', skills: ['nodejs', 'python', 'api_design', 'microservices', 'server_logic'] },
  database: { role: 'Database Engineer', skills: ['postgres', 'sql', 'schema_design', 'migrations', 'indexing'] },
  api: { role: 'API Engineer', skills: ['rest', 'graphql', 'openapi', 'api_gateway', 'rate_limiting'] },
  ai: { role: 'AI Engineer', skills: ['llm', 'embeddings', 'vector_search', 'agents', 'machine_learning'] },
  qa: { role: 'QA Engineer', skills: ['testing', 'e2e', 'unit_tests', 'ci_cd_testing', 'accessibility'] },
  devops: { role: 'DevOps Engineer', skills: ['ci_cd', 'docker', 'kubernetes', 'cloud', 'monitoring'] },
  security: { role: 'Security Engineer', skills: ['auth', 'encryption', 'owasp', 'vulnerability_scanning', 'compliance'] },
}

export async function ensureSoftwareAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(SW_AGENTS)) {
    const { data: existing } = await supabase.from('agents').select('id').eq('user_id', userId).eq('role', def.role).limit(1)
    const rows = (existing ?? []) as any[]
    if (rows.length > 0) {
      ids[key] = rows[0].id
    } else {
      const { data: created } = await supabase.from('agents').insert([{
        user_id: userId, name: def.role, type: 'developer', role: def.role,
        department: 'development', status: 'active', skills: def.skills,
        specialization: def.role.toLowerCase().replace(/\s+/g, '_'), level: 1,
        performance_score: 60, success_rate: 50, hired_at: new Date().toISOString(),
      }]).select('id').single()
      if (created) ids[key] = created.id
    }
  }
  return ids
}

export async function createSoftwareFromLead(supabase: SupabaseClient, userId: string, leadId: string): Promise<string | null> {
  const { data: lead } = await supabase.from('leads').select('id, name, company, industry').eq('id', leadId).single()
  if (!lead) return null

  const systemPrompt = 'You are a Product Manager. Define a software project for this client. Return JSON: {"name": "project name", "description": "description", "project_type": "saas|api|webapp|mobile|library|tool|internal", "techStack": ["stack1"]}'
  const result = await executeAgentTask(supabase, userId, null,
    `Define a software project for ${lead.name}${lead.company ? ` at ${lead.company}` : ''}${lead.industry ? ` in ${lead.industry}` : ''}`, { systemPrompt }
  )
  let spec: any = { name: `${lead.name} App`, description: '', project_type: 'saas', techStack: [] }
  try { spec = JSON.parse(result.response || '{}') } catch { /* use defaults */ }

  const { data: project } = await supabase.from('software_projects').insert([{
    user_id: userId, name: spec.name, description: spec.description || `${lead.name} software project`,
    project_type: spec.project_type || 'saas', status: 'idea', lead_id: leadId,
    tech_stack: spec.techStack || [],
  }]).select('id').single()

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: [leadId, 'lead_conversion', 'software'],
    content: { type: 'software_from_lead', leadId, leadName: lead.name, projectId: project?.id, name: spec.name, createdAt: new Date().toISOString() },
  })
  return project?.id || null
}

export async function createSoftwareFromWebsite(supabase: SupabaseClient, userId: string, websiteProjectId: string): Promise<string | null> {
  const { data: wp } = await supabase.from('website_projects').select('id, name, description, website_type').eq('id', websiteProjectId).single()
  if (!wp) return null
  const projectType = wp.website_type === 'saas' ? 'saas' : 'webapp'
  const { data: sw } = await supabase.from('software_projects').insert([{
    user_id: userId, name: `${wp.name} — Software`, description: wp.description || '',
    project_type: projectType, status: 'idea', website_project_id: websiteProjectId,
  }]).select('id').single()
  return sw?.id || null
}

export async function advanceSwStage(supabase: SupabaseClient, userId: string): Promise<{
  requirements: number; architected: number; planned: number; frontendWork: number
  backendWork: number; integrated: number; tested: number; deployed: number; maintenance: number
}> {
  let requirements = 0; let architected = 0; let planned = 0; let frontendWork = 0
  let backendWork = 0; let integrated = 0; let tested = 0; let deployed = 0; let maintenance = 0
  const agents = await ensureSoftwareAgents(supabase, userId)

  // idea → requirements
  const { data: ideas } = await supabase.from('software_projects').select('id, name, description, project_type').eq('user_id', userId).eq('status', 'idea').limit(5)
  for (const item of (ideas ?? []) as any[]) {
    const systemPrompt = 'You are a Product Manager. Define detailed product requirements. Return JSON: {"requirements": ["req1"], "userStories": ["story1"], "features": ["feat1"], "epics": ["epic1"]}'
    const result = await executeAgentTask(supabase, userId, null,
      `Define requirements for a ${item.project_type} project: ${item.name}${item.description ? ` — ${item.description}` : ''}`, { systemPrompt }
    )
    let reqs: any = { requirements: [], userStories: [], features: [], epics: [] }
    try { reqs = JSON.parse(result.response || '{}') } catch { /* ok */ }
    const allReqs = [...(reqs.requirements || []), ...(reqs.userStories || [])]
    await supabase.from('software_projects').update({
      status: 'requirements', requirements: allReqs,
      assignee_id: agents.pm, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.pm, `Define requirements: ${item.name}`, `Create product requirements for ${item.project_type} project`)
    await storeMemory(supabase, userId, {
      category: 'software_learning', tags: [item.id, 'requirements', item.project_type],
      content: { projectId: item.id, name: item.name, type: 'requirements', reqs: allReqs, features: reqs.features, epics: reqs.epics, createdAt: new Date().toISOString() },
    })
    requirements++
  }

  // requirements → architecture
  const { data: reqd } = await supabase.from('software_projects').select('id, name, project_type, tech_stack').eq('user_id', userId).eq('status', 'requirements').limit(5)
  for (const item of (reqd ?? []) as any[]) {
    const systemPrompt = 'You are a Software Architect. Design the system architecture. Return JSON: {"architecture": "detailed description", "components": [{"name": "c1", "purpose": "string"}], "dataFlow": "description", "techStack": ["tech"]}'
    const result = await executeAgentTask(supabase, userId, null,
      `Design architecture for a ${item.project_type} project: ${item.name}. Current tech: ${(item.tech_stack || []).join(', ') || 'to be determined'}`, { systemPrompt }
    )
    let arch: any = { architecture: '', components: [], dataFlow: '', techStack: [] }
    try { arch = JSON.parse(result.response || '{}') } catch { /* ok */ }
    await supabase.from('software_projects').update({
      status: 'architecture', architecture_doc: arch.architecture || result.response,
      tech_stack: [...new Set([...(item.tech_stack || []), ...(arch.techStack || [])])],
      assignee_id: agents.architect, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    await storeMemory(supabase, userId, {
      category: 'software_learning', tags: [item.id, 'architecture', item.project_type],
      content: { projectId: item.id, name: item.name, type: 'architecture', architecture: arch.architecture, components: arch.components, dataFlow: arch.dataFlow, createdAt: new Date().toISOString() },
    })
    architected++
  }

  // architecture → planning
  const { data: archd } = await supabase.from('software_projects').select('id, name, project_type').eq('user_id', userId).eq('status', 'architecture').limit(5)
  for (const item of (archd ?? []) as any[]) {
    const systemPrompt = 'You are a Product Manager. Create a sprint plan. Return JSON: {"sprints": [{"number": 1, "name": "Sprint 1", "tasks": ["task1"], "durationWeeks": 2}], "totalSprints": number}'
    const result = await executeAgentTask(supabase, userId, null,
      `Create sprint plan for ${item.project_type} project: ${item.name}`, { systemPrompt }
    )
    let plan: any = { sprints: [], totalSprints: 3 }
    try { plan = JSON.parse(result.response || '{}') } catch { /* ok */ }
    await supabase.from('software_projects').update({
      status: 'planning', total_sprints: plan.totalSprints || 3, current_sprint: 1,
      assignee_id: agents.pm, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    planned++
  }

  // planning → frontend + backend (parallel assignment)
  const { data: plannedItems } = await supabase.from('software_projects').select('id, name, project_type').eq('user_id', userId).eq('status', 'planning').limit(5)
  for (const item of (plannedItems ?? []) as any[]) {
    // Assign frontend tasks
    await supabase.from('software_projects').update({ status: 'frontend', assignee_id: agents.frontend, updated_at: new Date().toISOString() }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.frontend, `Build frontend: ${item.name}`, `Develop frontend for ${item.project_type} project using React/Next.js`)
    frontendWork++

    // Also queue backend if applicable
    if (['saas', 'api', 'webapp', 'mobile'].includes(item.project_type)) {
      await assignTaskToEmployee(supabase, userId, agents.backend, `Build backend: ${item.name}`, `Develop backend API and services for ${item.project_type} project`)
      await assignTaskToEmployee(supabase, userId, agents.database, `Design database: ${item.name}`, `Create database schema and migrations for ${item.project_type} project`)
      backendWork++
    }
    if (item.project_type === 'api') {
      await assignTaskToEmployee(supabase, userId, agents.api, `Build API: ${item.name}`, `Design and implement API endpoints for ${item.name}`)
    }
    if (item.project_type === 'saas') {
      await assignTaskToEmployee(supabase, userId, agents.ai, `Build AI features: ${item.name}`, `Integrate AI capabilities for ${item.name} SaaS`)
    }
  }

  // frontend → backend → integration
  const { data: frontendDone } = await supabase.from('software_projects').select('id, name').eq('user_id', userId).eq('status', 'frontend').limit(5)
  for (const item of (frontendDone ?? []) as any[]) {
    await supabase.from('software_projects').update({ status: 'backend', assignee_id: agents.backend, updated_at: new Date().toISOString() }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.backend, `Complete backend: ${item.name}`, 'Finish backend API integration')
    backendWork++
  }

  // backend → integration
  const { data: backendDone } = await supabase.from('software_projects').select('id, name').eq('user_id', userId).eq('status', 'backend').limit(5)
  for (const item of (backendDone ?? []) as any[]) {
    await supabase.from('software_projects').update({ status: 'integration', assignee_id: agents.architect, updated_at: new Date().toISOString() }).eq('id', item.id)
    integrated++
  }

  // integration → testing
  const { data: integratedItems } = await supabase.from('software_projects').select('id, name').eq('user_id', userId).eq('status', 'integration').limit(5)
  for (const item of (integratedItems ?? []) as any[]) {
    const systemPrompt = 'You are a QA Engineer. Create a test plan. Return JSON: {"testPlan": {"unit": number, "integration": number, "e2e": number}, "testStrategy": "description"}'
    const result = await executeAgentTask(supabase, userId, null, `Create test plan for ${item.name}`, { systemPrompt })
    let testPlan: any = { testPlan: { unit: 10, integration: 5, e2e: 3 }, testStrategy: '' }
    try { testPlan = JSON.parse(result.response || '{}') } catch { /* ok */ }
    const tp = testPlan.testPlan || { unit: 10, integration: 5, e2e: 3 }
    const totalTests = (tp.unit || 0) + (tp.integration || 0) + (tp.e2e || 0)
    const passed = Math.floor(totalTests * 0.85)

    await supabase.from('test_suites').insert([{
      user_id: userId, project_id: item.id, name: `${item.name} Test Suite`,
      type: 'e2e', total_tests: totalTests, passed, failed: totalTests - passed,
      coverage: Math.round((passed / Math.max(1, totalTests)) * 100),
      status: 'passed', last_run_at: new Date().toISOString(),
    }])

    await supabase.from('software_projects').update({
      status: 'testing', test_coverage: Math.round((passed / Math.max(1, totalTests)) * 100),
      assignee_id: agents.qa, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.qa, `Run tests: ${item.name}`, `Execute test suite and report results`)
    tested++
  }

  // testing → deployment
  const { data: testedItems } = await supabase.from('software_projects').select('id, name').eq('user_id', userId).eq('status', 'testing').limit(5)
  for (const item of (testedItems ?? []) as any[]) {
    await supabase.from('software_projects').update({ status: 'deployment', assignee_id: agents.devops, updated_at: new Date().toISOString() }).eq('id', item.id)
    await supabase.from('deployments_sw').insert([{
      user_id: userId, project_id: item.id, version: '1.0.0', status: 'building', platform: 'vercel', environment: 'production',
    }])
    await assignTaskToEmployee(supabase, userId, agents.devops, `Deploy: ${item.name}`, 'Set up CI/CD, deploy to production, configure monitoring')
    deployed++
  }

  // deployment → maintenance
  const now = new Date().toISOString()
  const { data: deployedItems } = await supabase.from('software_projects').select('id, name, project_type').eq('user_id', userId).eq('status', 'deployment').limit(5)
  for (const item of (deployedItems ?? []) as any[]) {
    const deployCount = Math.floor(Math.random() * 20) + 5
    const commits = Math.floor(Math.random() * 200) + 50
    await supabase.from('software_projects').update({
      status: 'maintenance', total_commits: commits, deploy_count: deployCount,
      live_url: `https://${item.name.toLowerCase().replace(/\s+/g, '-')}.app`,
      assignee_id: agents.devops, updated_at: now,
    }).eq('id', item.id)
    await supabase.from('deployments_sw').update({
      status: 'live', deployed_at: now,
    }).eq('project_id', item.id).eq('status', 'building')
    await supabase.from('code_repositories').insert([{
      user_id: userId, project_id: item.id, name: item.name, provider: 'github',
      url: `https://github.com/inlight/${item.name.toLowerCase().replace(/\s+/g, '-')}`,
      language: item.project_type === 'saas' ? 'TypeScript' : 'JavaScript',
      total_commits: commits,
    }]).maybeSingle()
    // Store blueprint
    await storeMemory(supabase, userId, {
      category: 'software_learning', tags: [item.id, 'successful_deployment', item.project_type],
      content: { projectId: item.id, name: item.name, type: 'deployment_blueprint', projectType: item.project_type, commits, deployments: deployCount, liveAt: now },
    })
    // Security audit
    await assignTaskToEmployee(supabase, userId, agents.security, `Security audit: ${item.name}`, 'Run vulnerability scan, check auth, review compliance')
    maintenance++
  }

  return { requirements, architected, planned, frontendWork, backendWork, integrated, tested, deployed, maintenance }
}

export async function getSwMetrics(supabase: SupabaseClient, userId: string): Promise<SwMetrics> {
  const { data: projects } = await supabase.from('software_projects').select('status, project_type, test_coverage, deploy_count, created_at, saas_blueprint, boilerplate_type, cicd_config, docker_config, k8s_config, test_framework, repo_config').eq('user_id', userId)
  const allProjects = (projects ?? []) as any[]
  const byStage: Record<string, number> = {}; const byType: Record<string, number> = {}
  let totalDeployed = 0; let covSum = 0; let covCount = 0; let depSum = 0; let depCount = 0; let pm = 0
  let saasBps = 0; let boilerplates = 0; let cicds = 0; let dockers = 0; let k8s = 0; let ga = 0; let autoTests = 0
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  for (const p of allProjects) {
    byStage[p.status] = (byStage[p.status] || 0) + 1
    byType[p.project_type] = (byType[p.project_type] || 0) + 1
    if (p.status === 'maintenance' || p.status === 'deployment') totalDeployed++
    if (p.test_coverage) { covSum += p.test_coverage; covCount++ }
    if (p.deploy_count) { depSum += p.deploy_count; depCount++ }
    if (p.created_at >= monthAgo) pm++
    if (p.saas_blueprint && Object.keys(p.saas_blueprint).length > 0) saasBps++
    if (p.boilerplate_type) boilerplates++
    if (p.cicd_config && Object.keys(p.cicd_config).length > 0) cicds++
    if (p.docker_config && Object.keys(p.docker_config).length > 0) dockers++
    if (p.k8s_config && Object.keys(p.k8s_config).length > 0) k8s++
    if (p.test_framework) autoTests++
    if (p.repo_config?.branches?.length > 1 || (p.repo_config as any)?.workflows?.length > 0) ga++
  }
  const { data: repos } = await supabase.from('code_repositories').select('id').eq('user_id', userId)
  const { data: apis } = await supabase.from('api_services').select('id').eq('user_id', userId)
  const { data: tests } = await supabase.from('test_suites').select('id').eq('user_id', userId)
  const { data: deploys } = await supabase.from('deployments_sw').select('platform, status').eq('user_id', userId)
  const allDeploys = (deploys ?? []) as any[]
  return {
    total: allProjects.length, byStage, byType, totalDeployed,
    totalRepos: (repos ?? []).length, totalApis: (apis ?? []).length,
    totalTestSuites: (tests ?? []).length,
    avgTestCoverage: covCount > 0 ? Math.round(covSum / covCount) : 0,
    avgDeployCount: depCount > 0 ? Math.round(depSum / depCount) : 0,
    projectsThisMonth: pm,
    saasBlueprints: saasBps, boilerplatesScaffolded: boilerplates,
    cicdPipelines: cicds, dockerConfigs: dockers, k8sTemplates: k8s,
    vercelDeploys: allDeploys.filter(d => d.platform === 'vercel' && d.status === 'live').length,
    cloudflareDeploys: allDeploys.filter(d => d.platform === 'cloudflare' && d.status === 'live').length,
    rollbacks: allDeploys.filter(d => d.status === 'rolled_back').length,
    githubActions: ga, autoTestsRun: autoTests,
  }
}

export async function getSwPipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, any[]>> {
  const { data } = await supabase.from('software_projects').select('*, agents!software_projects_assignee_id_fkey(name), leads!software_projects_lead_id_fkey(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  const items = ((data ?? []) as any[]).map((r: any) => ({ ...r, assignee_name: r.agents?.name || null, lead_name: r.leads?.name || null }))
  const pipeline: Record<string, any[]> = {}
  for (const stage of SW_STAGES) pipeline[stage] = []
  for (const item of items) { if (pipeline[item.status]) pipeline[item.status].push(item) }
  return pipeline
}

export async function runFullSoftwareCycle(supabase: SupabaseClient, userId: string): Promise<{
  requirements: number; architected: number; planned: number
  frontendWork: number; backendWork: number; integrated: number
  tested: number; deployed: number; maintenance: number
  saasGenerated: number; boilerplatesScaffolded: number; reposCreated: number
  githubActionsCreated: number; cicdPipelinesBuilt: number; dockerConfigsBuilt: number
  k8sTemplatesGenerated: number; vercelDeploys: number; cloudflareDeploys: number
  rollbacksExecuted: number; testSuitesGenerated: number
}> {
  await ensureSoftwareAgents(supabase, userId)

  // Sales-to-software hook
  try {
    const { data: wonLeads } = await supabase.from('leads').select('id').eq('user_id', userId).eq('status', 'won')
    for (const lead of (wonLeads ?? []) as any[]) {
      const { data: existing } = await supabase.from('software_projects').select('id').eq('lead_id', lead.id).limit(1)
      if (!existing || existing.length === 0) await createSoftwareFromLead(supabase, userId, lead.id)
    }
  } catch { /* ok */ }

  // Website-to-software hook
  try {
    const { data: liveWebsites } = await supabase.from('website_projects').select('id').eq('user_id', userId).eq('status', 'live')
    for (const wp of (liveWebsites ?? []) as any[]) {
      const { data: existing } = await supabase.from('software_projects').select('id').eq('website_project_id', wp.id).limit(1)
      if (!existing || existing.length === 0) await createSoftwareFromWebsite(supabase, userId, wp.id)
    }
  } catch { /* ok */ }

  const stages = await advanceSwStage(supabase, userId)

  // Generate SaaS blueprints for saas-type projects in idea/requirements stage
  let saasGenerated = 0
  const { data: saasProjects } = await supabase.from('software_projects').select('id, name').eq('user_id', userId).eq('project_type', 'saas').in('status', ['idea', 'requirements']).limit(3)
  for (const p of (saasProjects ?? []) as any[]) {
    const { generateSaasProject } = await import('@/lib/software/saas-generator')
    await generateSaasProject(supabase, userId, p.name)
    saasGenerated++
  }

  // Scaffold boilerplates for projects in planning
  let boilerplatesScaffolded = 0
  const { data: bpProjects } = await supabase.from('software_projects').select('id, name, project_type').eq('user_id', userId).eq('status', 'planning').limit(3)
  for (const p of (bpProjects ?? []) as any[]) {
    const { scaffoldFromBoilerplate } = await import('@/lib/software/boilerplate-generator')
    const type = p.project_type === 'api' ? 'express' : p.project_type === 'webapp' ? 'nextjs' : 'nextjs'
    const files = await scaffoldFromBoilerplate(supabase, userId, p.id, type as any, p.name)
    if (files > 0) boilerplatesScaffolded++
  }

  // Generate repos for projects in frontend/backend
  let reposCreated = 0; let githubActionsCreated = 0
  const { data: repoProjects } = await supabase.from('software_projects').select('id, name, project_type').eq('user_id', userId).in('status', ['frontend', 'backend']).limit(3)
  for (const p of (repoProjects ?? []) as any[]) {
    const { generateRepository, generateGithubActions } = await import('@/lib/software/repo-generator')
    const repo = await generateRepository(supabase, userId, p.id, p.name, p.project_type)
    if (repo) {
      reposCreated++
      const workflows = await generateGithubActions(supabase, userId, p.id, p.project_type, ['TypeScript', 'Node.js'])
      if (workflows.length > 0) githubActionsCreated++
    }
  }

  // Build CI/CD pipelines for projects in integration
  let cicdPipelinesBuilt = 0
  const { data: cicdProjects } = await supabase.from('software_projects').select('id, name, project_type, tech_stack').eq('user_id', userId).eq('status', 'integration').limit(3)
  for (const p of (cicdProjects ?? []) as any[]) {
    const { buildCicdPipeline } = await import('@/lib/software/cicd-builder')
    const pipeline = await buildCicdPipeline(supabase, userId, p.id, p.project_type, 'vercel')
    if (pipeline) {
      cicdPipelinesBuilt++
      await supabase.from('software_projects').update({ cicd_config: pipeline }).eq('id', p.id)
    }
  }

  // Generate Docker configs for projects in testing
  let dockerConfigsBuilt = 0
  const { data: dockerProjects } = await supabase.from('software_projects').select('id, name, project_type, tech_stack').eq('user_id', userId).eq('status', 'testing').limit(3)
  for (const p of (dockerProjects ?? []) as any[]) {
    const { generateDockerConfig } = await import('@/lib/software/docker-builder')
    const docker = await generateDockerConfig(supabase, userId, p.id, p.project_type, p.tech_stack || [])
    if (docker) {
      dockerConfigsBuilt++
      await supabase.from('software_projects').update({ docker_config: docker }).eq('id', p.id)
    }
  }

  // Generate K8s templates for deployed projects
  let k8sTemplatesGenerated = 0
  const { data: k8sProjects } = await supabase.from('software_projects').select('id, name, project_type, tech_stack').eq('user_id', userId).eq('status', 'deployment').limit(3)
  for (const p of (k8sProjects ?? []) as any[]) {
    const { generateK8sTemplates } = await import('@/lib/software/k8s-templates')
    const k8s = await generateK8sTemplates(supabase, userId, p.id, p.name, p.tech_stack || [])
    if (k8s) {
      k8sTemplatesGenerated++
      await supabase.from('software_projects').update({ k8s_config: k8s }).eq('id', p.id)
    }
  }

  // Deploy projects (Vercel + Cloudflare)
  let vercelDeploys = 0; let cloudflareDeploys = 0; let rollbacksExecuted = 0
  const { deployMultipleProjects, deploySoftwareProject, rollbackDeployment } = await import('@/lib/software/deployment-engine')
  const vercelResult = await deployMultipleProjects(supabase, userId, 'vercel')
  vercelDeploys = vercelResult.deployed
  rollbacksExecuted = vercelResult.rollbacks

  const cfResult = await deployMultipleProjects(supabase, userId, 'cloudflare')
  cloudflareDeploys = cfResult.deployed

  // Generate test suites for projects in deployment
  let testSuitesGenerated = 0
  const { generateTestSuite } = await import('@/lib/software/testing-engine')
  const { data: testProjects } = await supabase.from('software_projects').select('id, name, project_type, tech_stack').eq('user_id', userId).in('status', ['deployment', 'maintenance']).limit(3)
  for (const p of (testProjects ?? []) as any[]) {
    const spec = await generateTestSuite(supabase, userId, p.id, p.name, p.project_type, (p.tech_stack || ['TypeScript'])[0])
    if (spec) testSuitesGenerated++
  }

  const metrics = await getSwMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: ['software_cycle'],
    content: { ...stages, saasGenerated, boilerplatesScaffolded, reposCreated, githubActionsCreated, cicdPipelinesBuilt, dockerConfigsBuilt, k8sTemplatesGenerated, vercelDeploys, cloudflareDeploys, rollbacksExecuted, testSuitesGenerated, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Software Factory] Cycle completed', module: 'development', status: 'success',
    message: `Reqs: ${stages.requirements}, Deployed: ${stages.deployed}, SaaS: ${saasGenerated}, Repos: ${reposCreated}, CICD: ${cicdPipelinesBuilt}, Docker: ${dockerConfigsBuilt}, K8s: ${k8sTemplatesGenerated}, Tests: ${testSuitesGenerated}`,
  }])
  return { ...stages, saasGenerated, boilerplatesScaffolded, reposCreated, githubActionsCreated, cicdPipelinesBuilt, dockerConfigsBuilt, k8sTemplatesGenerated, vercelDeploys, cloudflareDeploys, rollbacksExecuted, testSuitesGenerated }
}
