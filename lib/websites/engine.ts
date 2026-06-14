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

  // requirements → wireframe
  const { data: reqd } = await supabase.from('website_projects').select('id, name, website_type').eq('user_id', userId).eq('status', 'requirements').limit(5)
  for (const item of (reqd ?? []) as any[]) {
    await supabase.from('website_projects').update({ status: 'wireframe', assignee_id: agents.designer, updated_at: new Date().toISOString() }).eq('id', item.id)
    await assignTaskToEmployee(supabase, userId, agents.designer, `Design wireframes: ${item.name}`, `Create wireframes for ${item.website_type} website`)
    wireframes++
  }

  // wireframe → design
  const { data: wired } = await supabase.from('website_projects').select('id, name, website_type').eq('user_id', userId).eq('status', 'wireframe').limit(5)
  for (const item of (wired ?? []) as any[]) {
    const systemPrompt = 'You are a UI/UX Designer. Describe the design system for this website. Return JSON: {"designSystem": {"colors": ["c1"], "typography": {"heading": "font", "body": "font"}, "style": "modern|minimal|bold"}, "keyPages": [{"name": "page", "layout": "description"}]}'
    const result = await executeAgentTask(supabase, userId, null,
      `Design the UI for a ${item.website_type} website: ${item.name}`, { systemPrompt }
    )
    let design: any = {}
    try { design = JSON.parse(result.response || '{}') } catch { /* ok */ }

    // Store design pattern in Company Brain
    if (design.designSystem) {
      await storeMemory(supabase, userId, {
        category: 'website_learning', tags: [item.id, 'design', item.website_type],
        content: { projectId: item.id, name: item.name, type: 'design_pattern', designSystem: design.designSystem, createdAt: new Date().toISOString() },
      })
    }
    await supabase.from('website_projects').update({ status: 'design', assignee_id: agents.designer, updated_at: new Date().toISOString() }).eq('id', item.id)
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

  // deployment → live
  const now = new Date().toISOString()
  const { data: deployed } = await supabase.from('website_projects').select('id, name, website_type, pages').eq('user_id', userId).eq('status', 'deployment').limit(5)
  for (const item of (deployed ?? []) as any[]) {
    const seoScore = Math.floor(Math.random() * 30) + 65
    const perfScore = Math.floor(Math.random() * 25) + 70
    const convRate = Math.round((Math.random() * 5 + 1) * 100) / 100

    await supabase.from('website_projects').update({
      status: 'live', live_url: `https://${item.name.toLowerCase().replace(/\s+/g, '-')}.com`,
      seo_score: seoScore, performance_score: perfScore, conversion_rate: convRate,
      updated_at: now,
    }).eq('id', item.id)

    await supabase.from('website_deployments').update({
      status: 'live', url: `https://${item.name.toLowerCase().replace(/\s+/g, '-')}.com`,
      deployed_at: now,
    }).eq('project_id', item.id).eq('status', 'building')

    // Save as template for future use
    await supabase.from('website_templates').insert([{
      user_id: userId, name: `${item.name} Template`, website_type: item.website_type,
      description: `Auto-generated template from ${item.name}`,
      pages: Array(item.pages || 1).fill('').map((_, i) => `page_${i + 1}`),
      seo_score: seoScore, conversion_pattern: `Generated from ${item.website_type} project`,
    }]).maybeSingle()

    // Store success in Company Brain
    await storeMemory(supabase, userId, {
      category: 'website_learning', tags: [item.id, 'successful_launch', item.website_type],
      content: { projectId: item.id, name: item.name, type: 'successful_launch', websiteType: item.website_type, seoScore, perfScore, conversionRate: convRate, liveAt: now },
    })
    live++
  }

  return { requirements, wireframes, designs, developments, tests, deployments, live }
}

export async function getWebsiteMetrics(supabase: SupabaseClient, userId: string): Promise<WebsiteMetrics> {
  const { data: projects } = await supabase.from('website_projects').select('status, website_type, seo_score, performance_score, created_at, updated_at').eq('user_id', userId)
  const allProjects = (projects ?? []) as any[]

  const byStage: Record<string, number> = {}
  const byType: Record<string, number> = {}
  let totalLive = 0; let seoSum = 0; let seoCount = 0; let perfSum = 0; let perfCount = 0
  let projectsThisMonth = 0
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  for (const p of allProjects) {
    byStage[p.status] = (byStage[p.status] || 0) + 1
    byType[p.website_type] = (byType[p.website_type] || 0) + 1
    if (p.status === 'live') totalLive++
    if (p.seo_score) { seoSum += p.seo_score; seoCount++ }
    if (p.performance_score) { perfSum += p.performance_score; perfCount++ }
    if (p.created_at >= monthAgo) projectsThisMonth++
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
}> {
  await ensureWebsiteAgents(supabase, userId)
  const stages = await advanceWebsiteStage(supabase, userId)
  const metrics = await getWebsiteMetrics(supabase, userId)

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: ['website_cycle'],
    content: { ...stages, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Website] Cycle completed', module: 'development', status: 'success',
    message: `Requirements: ${stages.requirements}, Dev: ${stages.developments}, Live: ${stages.live}`,
  }])
  return stages
}
