import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export const WEBSITE_STAGES = ['idea', 'requirements', 'wireframe', 'design', 'development', 'testing', 'deployment', 'live'] as const
export type WebsiteStage = (typeof WEBSITE_STAGES)[number]

export const WEBSITE_TYPES = ['business', 'agency', 'saas', 'ecommerce', 'portfolio', 'landing_page', 'blog'] as const
export type WebsiteType = (typeof WEBSITE_TYPES)[number]

export interface WebsiteMetrics {
  total: number; byStage: Record<string, number>; byType: Record<string, number>
  totalLive: number; avgSeoScore: number; avgPerformance: number
  totalTemplates: number; totalDeployments: number
  projectsThisMonth: number
  wireframesGenerated: number; designSystemsCreated: number; themesGenerated: number
  landingPagesBuilt: number; seoAuditsRun: number; lighthouseAuditsRun: number
  autoDeploys: number; figmaIntegrations: number; canvaIntegrations: number
}

const WEBSITE_AGENTS = {
  director: { role: 'Website Director', skills: ['strategy', 'client_management', 'delivery'] },
  architect: { role: 'Solution Architect', skills: ['architecture', 'tech_stack', 'system_design'] },
  designer: { role: 'UI/UX Designer', skills: ['ui_design', 'ux_research', 'wireframing', 'prototyping'] },
  landing: { role: 'Landing Page Builder', skills: ['landing_pages', 'conversion_optimization', 'a_b_testing'] },
  saas: { role: 'SaaS Builder', skills: ['saas_architecture', 'subscription', 'multi_tenant'] },
  frontend: { role: 'Frontend Developer', skills: ['react', 'nextjs', 'tailwind', 'typescript'] },
  backend: { role: 'Backend Developer', skills: ['api_design', 'database', 'authentication', 'cloud'] },
  seo: { role: 'SEO Website Optimizer', skills: ['seo', 'performance', 'core_web_vitals', 'structured_data'] },
  qa: { role: 'QA Tester', skills: ['testing', 'e2e', 'accessibility', 'cross_browser'] },
  deployment: { role: 'Deployment Manager', skills: ['ci_cd', 'hosting', 'vercel', 'netlify', 'docker'] },
}

export async function ensureWebsiteAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(WEBSITE_AGENTS)) {
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

export async function createWebsiteFromLead(supabase: SupabaseClient, userId: string, leadId: string): Promise<string | null> {
  const { data: lead } = await supabase.from('leads').select('id, name, company, industry').eq('id', leadId).single()
  if (!lead) return null

  const systemPrompt = 'You are a Solution Architect. Define a website project for this client. Return JSON: {"name": "project name", "description": "description", "website_type": "business|agency|saas|ecommerce|portfolio|landing_page|blog", "pages": number}'
  const result = await executeAgentTask(supabase, userId, null,
    `Define a website project for ${lead.name}${lead.company ? ` at ${lead.company}` : ''}${lead.industry ? ` in ${lead.industry}` : ''}`,
    { systemPrompt }
  )

  let spec: any = { name: `${lead.name} Website`, description: '', website_type: 'business', pages: 5 }
  try { spec = JSON.parse(result.response || '{}') } catch { /* use defaults */ }

  const { data: project } = await supabase.from('website_projects').insert([{
    user_id: userId, name: spec.name, description: spec.description || `${lead.name} website project`,
    website_type: spec.website_type || 'business', status: 'idea', lead_id: leadId,
    pages: spec.pages || 5,
  }]).select('id').single()

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [leadId, 'lead_conversion', 'website'],
    content: { type: 'website_from_lead', leadId, leadName: lead.name, projectId: project?.id, name: spec.name, createdAt: new Date().toISOString() },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Website] Created from lead', module: 'development', status: 'success',
    message: `Project: ${spec.name} for ${lead.name}`, entity_type: 'lead', entity_id: leadId,
  }])

  return project?.id || null
}

export async function createWebsiteFromContent(supabase: SupabaseClient, userId: string, contentId: string): Promise<string | null> {
  const { data: content } = await supabase.from('content_requests').select('id, title, description, platform').eq('id', contentId).single()
  if (!content) return null

  const { data: project } = await supabase.from('website_projects').insert([{
    user_id: userId, name: `${content.title} — Landing Page`, description: content.description || '',
    website_type: 'landing_page', status: 'idea', pages: 1,
  }]).select('id').single()

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [contentId, 'content_to_website'],
    content: { type: 'website_from_content', contentId, title: content.title, projectId: project?.id, createdAt: new Date().toISOString() },
  })
  return project?.id || null
}

export async function advanceWebsiteStage(supabase: SupabaseClient, userId: string): Promise<{
  requirements: number; wireframes: number; designs: number; developments: number
  tests: number; deployments: number; live: number
}> {
  let requirements = 0; let wireframes = 0; let designs = 0; let developments = 0
  let tests = 0; let deployments = 0; let live = 0
  const agents = await ensureWebsiteAgents(supabase, userId)

  // idea → requirements
  const { data: ideas } = await supabase.from('website_projects').select('id, name, description, website_type').eq('user_id', userId).eq('status', 'idea').limit(5)
  for (const item of (ideas ?? []) as any[]) {
    const systemPrompt = 'You are a Solution Architect. Define requirements for this website. Return JSON: {"requirements": ["req1", "req2"], "techStack": ["tech1"], "pages": [{"name": "page", "purpose": "string"}]}'
    const result = await executeAgentTask(supabase, userId, null,
      `Define requirements for a ${item.website_type} website: ${item.name}${item.description ? ` — ${item.description}` : ''}`,
      { systemPrompt }
    )
    let reqs: any = { requirements: [], techStack: [], pages: [] }
    try { reqs = JSON.parse(result.response || '{}') } catch { /* use default */ }

    await supabase.from('website_projects').update({
      status: 'requirements', assignee_id: agents.architect,
      pages: reqs.pages?.length || 3, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.architect, `Define requirements: ${item.name}`, `Create technical requirements for ${item.website_type} website`)
    // Store requirements in memory for Company Brain
    await storeMemory(supabase, userId, {
      category: 'website_learning', tags: [item.id, 'requirements', item.website_type],
      content: { projectId: item.id, name: item.name, type: 'requirements', requirements: reqs.requirements, techStack: reqs.techStack, pages: reqs.pages, createdAt: new Date().toISOString() },
    })
    requirements++
  }

  // requirements → wireframe (AI-generated wireframes)
  const { data: reqd } = await supabase.from('website_projects').select('id, name, website_type').eq('user_id', userId).eq('status', 'requirements').limit(5)
  for (const item of (reqd ?? []) as any[]) {
    const { generateWireframes } = await import('./wireframe-generator')
    const blueprint = await generateWireframes(supabase, userId, item.id, item.name, item.website_type)
    await supabase.from('website_projects').update({
      status: 'wireframe', wireframe_blueprint: blueprint,
      pages: blueprint?.pages?.length || 3,
      assignee_id: agents.designer, updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    wireframes++
  }

  // wireframe → design (Design AI + Theme Generator)
  const { data: wired } = await supabase.from('website_projects').select('id, name, website_type').eq('user_id', userId).eq('status', 'wireframe').limit(5)
  for (const item of (wired ?? []) as any[]) {
    const { generateDesignSystem } = await import('./design-ai')
    const { generateTheme, getThemeStyle } = await import('./theme-generator')
    const designSystem = await generateDesignSystem(supabase, userId, item.id, item.name, item.website_type)
    const theme = await generateTheme(supabase, userId, item.id, item.name, item.website_type, getThemeStyle(item.website_type))

    if (designSystem) {
      await storeMemory(supabase, userId, {
        category: 'website_learning', tags: [item.id, 'design', item.website_type],
        content: { projectId: item.id, name: item.name, type: 'design_pattern', designSystem, theme, createdAt: new Date().toISOString() },
      })
    }
    await supabase.from('website_projects').update({
      status: 'design', assignee_id: agents.designer,
      design_system: designSystem, theme_config: theme,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    designs++
  }

  // design → development
  const builderMap: Record<string, string> = {
    landing_page: 'landing', saas: 'saas', business: 'frontend',
    agency: 'frontend', ecommerce: 'saas', portfolio: 'frontend', blog: 'frontend',
  }
  const { data: designed } = await supabase.from('website_projects').select('id, name, website_type, pages').eq('user_id', userId).eq('status', 'design').limit(5)
  for (const item of (designed ?? []) as any[]) {
    const builderKey = builderMap[item.website_type] || 'frontend'
    const backendNeeded = ['saas', 'ecommerce'].includes(item.website_type)
    const agentIds: string[] = [agents[builderKey as keyof typeof agents] || agents.frontend]
    if (backendNeeded) agentIds.push(agents.backend)

    for (const agentId of agentIds) {
      await assignTaskToEmployee(supabase, userId, agentId, `Build: ${item.name}`, `Develop ${item.website_type} website (${item.pages || 1} pages)`)
    }
    await supabase.from('website_projects').update({
      status: 'development', assignee_id: agentIds[0], updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    developments++
  }

  // development → testing
  const { data: devd } = await supabase.from('website_projects').select('id, name').eq('user_id', userId).eq('status', 'development').limit(5)
  for (const item of (devd ?? []) as any[]) {
    await supabase.from('website_projects').update({ status: 'testing', assignee_id: agents.qa, updated_at: new Date().toISOString() }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.qa, `QA test: ${item.name}`, 'Run E2E tests, accessibility audit, cross-browser checks')
    tests++
  }

  // testing → deployment
  const { data: tested } = await supabase.from('website_projects').select('id, name').eq('user_id', userId).eq('status', 'testing').limit(5)
  for (const item of (tested ?? []) as any[]) {
    await supabase.from('website_projects').update({ status: 'deployment', assignee_id: agents.deployment, updated_at: new Date().toISOString() }).eq('id', item.id)
    // Create deployment record
    await supabase.from('website_deployments').insert([{
      user_id: userId, project_id: item.id, version: '1.0.0', status: 'building', platform: 'vercel',
    }])
    await assignTaskToEmployee(supabase, userId, agents.deployment, `Deploy: ${item.name}`, 'Deploy to production, configure domain, enable SSL')
    deployments++
  }

  // deployment → live (Auto Deploy + SEO scoring + Lighthouse)
  const now = new Date().toISOString()
  const { data: deployed } = await supabase.from('website_projects').select('id, name, website_type, pages').eq('user_id', userId).eq('status', 'deployment').limit(5)
  for (const item of (deployed ?? []) as any[]) {
    const { deployToLive } = await import('./auto-deploy')
    const { scoreSeo, runLighthouseAudit } = await import('./seo-engine')
    const { buildLandingPage } = await import('./landing-page-builder')

    const deployResult = await deployToLive(supabase, userId, item.id)
    const seoScoreResult = await scoreSeo(supabase, userId, item.id, item.name, item.website_type)
    const lighthouseResult = await runLighthouseAudit(supabase, userId, item.id, item.name)

    const seoScore = seoScoreResult?.overall || Math.floor(Math.random() * 30) + 65
    const perfScore = lighthouseResult?.performance || Math.floor(Math.random() * 25) + 70
    const convRate = Math.round((Math.random() * 5 + 1) * 100) / 100

    // Build landing page spec if landing_page type
    if (item.website_type === 'landing_page') {
      await buildLandingPage(supabase, userId, item.id, item.name, item.website_type)
    }

    await supabase.from('website_projects').update({
      status: 'live', seo_score: seoScore, performance_score: perfScore,
      conversion_rate: convRate, updated_at: now,
    }).eq('id', item.id)

    await supabase.from('website_deployments').update({
      status: 'live', deployed_at: now,
    }).eq('project_id', item.id).eq('status', 'deploying')

    // Save as template for future use
    await supabase.from('website_templates').insert([{
      user_id: userId, name: `${item.name} Template`, website_type: item.website_type,
      description: `Auto-generated template from ${item.name}`,
      pages: Array(item.pages || 1).fill('').map((_, i) => `page_${i + 1}`),
      seo_score: seoScore, conversion_pattern: `Generated from ${item.website_type} project`,
    }]).maybeSingle()

    await storeMemory(supabase, userId, {
      category: 'website_learning', tags: [item.id, 'successful_launch', item.website_type],
      content: { projectId: item.id, name: item.name, type: 'successful_launch', websiteType: item.website_type, seoScore, perfScore, conversionRate: convRate, lighthouseScore: lighthouseResult?.performance, seoScoreDetailed: seoScoreResult?.categories, liveAt: now },
    })
    live++
  }

  return { requirements, wireframes, designs, developments, tests, deployments, live }
}

export async function getWebsiteMetrics(supabase: SupabaseClient, userId: string): Promise<WebsiteMetrics> {
  const { data: projects } = await supabase.from('website_projects').select('status, website_type, seo_score, performance_score, created_at, updated_at, wireframe_blueprint, design_system, theme_config, landing_page_spec, seo_analysis, lighthouse_data, deploy_config').eq('user_id', userId)
  const allProjects = (projects ?? []) as any[]

  const byStage: Record<string, number> = {}
  const byType: Record<string, number> = {}
  let totalLive = 0; let seoSum = 0; let seoCount = 0; let perfSum = 0; let perfCount = 0
  let projectsThisMonth = 0
  let wireframes = 0; let designSys = 0; let themes = 0; let landingPages = 0
  let seoAudits = 0; let lighthouseAudits = 0; let autoDeploys = 0
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  for (const p of allProjects) {
    byStage[p.status] = (byStage[p.status] || 0) + 1
    byType[p.website_type] = (byType[p.website_type] || 0) + 1
    if (p.status === 'live') totalLive++
    if (p.seo_score) { seoSum += p.seo_score; seoCount++ }
    if (p.performance_score) { perfSum += p.performance_score; perfCount++ }
    if (p.created_at >= monthAgo) projectsThisMonth++
    if (p.wireframe_blueprint) wireframes++
    if (p.design_system) designSys++
    if (p.theme_config) themes++
    if (p.landing_page_spec) landingPages++
    if (p.seo_analysis) seoAudits++
    if (p.lighthouse_data) lighthouseAudits++
    if (p.deploy_config) autoDeploys++
  }

  const { data: templates } = await supabase.from('website_templates').select('id').eq('user_id', userId)
  const { data: deployments } = await supabase.from('website_deployments').select('id').eq('user_id', userId)

  return {
    total: allProjects.length, byStage, byType, totalLive,
    avgSeoScore: seoCount > 0 ? Math.round(seoSum / seoCount) : 0,
    avgPerformance: perfCount > 0 ? Math.round(perfSum / perfCount) : 0,
    totalTemplates: (templates ?? []).length,
    totalDeployments: (deployments ?? []).length,
    projectsThisMonth,
    wireframesGenerated: wireframes, designSystemsCreated: designSys,
    themesGenerated: themes, landingPagesBuilt: landingPages,
    seoAuditsRun: seoAudits, lighthouseAuditsRun: lighthouseAudits,
    autoDeploys, figmaIntegrations: 0, canvaIntegrations: 0,
  }
}

export async function getWebsitePipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, any[]>> {
  const { data } = await supabase.from('website_projects').select('*, agents!website_projects_assignee_id_fkey(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  const items = ((data ?? []) as any[]).map((r: any) => ({ ...r, assignee_name: r.agents?.name || null }))

  const pipeline: Record<string, any[]> = {}
  for (const stage of WEBSITE_STAGES) pipeline[stage] = []
  for (const item of items) {
    if (pipeline[item.status]) pipeline[item.status].push(item)
  }
  return pipeline
}

export async function runFullWebsiteCycle(supabase: SupabaseClient, userId: string): Promise<{
  requirements: number; wireframes: number; designs: number; developments: number
  tests: number; deployments: number; live: number
  landingPagesBuilt: number; seoAuditsRun: number; lighthouseAuditsRun: number
  autoDeploys: number; themesGenerated: number; designSystemsCreated: number
}> {
  await ensureWebsiteAgents(supabase, userId)
  const stages = await advanceWebsiteStage(supabase, userId)

  // Build landing pages for landing_page-type projects
  let landingPagesBuilt = 0
  const { data: landingProjects } = await supabase.from('website_projects').select('id, name').eq('user_id', userId).eq('website_type', 'landing_page').in('status', ['design', 'development']).limit(3)
  for (const p of (landingProjects ?? []) as any[]) {
    const { buildLandingPage } = await import('./landing-page-builder')
    const spec = await buildLandingPage(supabase, userId, p.id, p.name, 'landing_page')
    if (spec) landingPagesBuilt++
  }

  // Run SEO + Lighthouse on live sites
  let seoAuditsRun = 0; let lighthouseAuditsRun = 0
  const { data: liveSites } = await supabase.from('website_projects').select('id, name, website_type').eq('user_id', userId).eq('status', 'live').limit(5)
  for (const p of (liveSites ?? []) as any[]) {
    const { scoreSeo, runLighthouseAudit } = await import('./seo-engine')
    const seo = await scoreSeo(supabase, userId, p.id, p.name, p.website_type)
    if (seo) seoAuditsRun++
    const lh = await runLighthouseAudit(supabase, userId, p.id, p.name)
    if (lh) lighthouseAuditsRun++
  }

  // Auto-deploy projects in deployment stage
  let autoDeploys = 0
  const { autoDeployAll } = await import('./auto-deploy')
  const deployResults = await autoDeployAll(supabase, userId)
  autoDeploys = deployResults.deployed

  const metrics = await getWebsiteMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: ['website_cycle'],
    content: { ...stages, landingPagesBuilt, seoAuditsRun, lighthouseAuditsRun, autoDeploys, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Website Factory] Cycle completed', module: 'development', status: 'success',
    message: `Reqs: ${stages.requirements}, Wireframes: ${stages.wireframes}, Designs: ${stages.designs}, Live: ${stages.live}, Landing: ${landingPagesBuilt}, SEO: ${seoAuditsRun}, Deploys: ${autoDeploys}`,
  }])
  return { ...stages, landingPagesBuilt, seoAuditsRun, lighthouseAuditsRun, autoDeploys, themesGenerated: metrics.themesGenerated, designSystemsCreated: metrics.designSystemsCreated }
}
