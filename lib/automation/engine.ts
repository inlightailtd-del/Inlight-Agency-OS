import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export const AUTO_STAGES = ['idea', 'requirements', 'workflow_design', 'integration_mapping', 'implementation', 'testing', 'deployment', 'monitoring', 'optimization'] as const
export type AutoStage = (typeof AUTO_STAGES)[number]

export const INTEGRATION_PROVIDERS = [
  'gmail', 'outlook', 'whatsapp', 'telegram', 'slack', 'discord',
  'linkedin', 'facebook', 'instagram', 'x',
  'hubspot', 'salesforce', 'stripe', 'calendly',
  'google_sheets', 'airtable', 'supabase', 'webhooks',
] as const

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number]

export interface AutoMetrics {
  total: number; byPipeline: Record<string, number>; byCategory: Record<string, number>
  activeCount: number; totalRuns: number; successRate: number; failedCount: number
  totalIntegrations: number; connectedIntegrations: number; totalTemplates: number
}

const AUTO_AGENTS = {
  architect: { role: 'Automation Architect', skills: ['automation_strategy', 'workflow_design', 'systems_thinking'] },
  designer: { role: 'Workflow Designer', skills: ['workflow_mapping', 'business_process', 'optimization'] },
  integration: { role: 'Integration Engineer', skills: ['integrations', 'api_mappings', 'middleware'] },
  api_connector: { role: 'API Connector', skills: ['rest', 'graphql', 'oauth', 'api_gateway'] },
  webhook: { role: 'Webhook Manager', skills: ['webhooks', 'event_driven', 'real_time'] },
  crm: { role: 'CRM Automation Specialist', skills: ['hubspot', 'salesforce', 'lead_routing', 'deal_automation'] },
  email: { role: 'Email Automation Specialist', skills: ['gmail', 'outlook', 'email_sequences', 'templates'] },
  social: { role: 'Social Automation Specialist', skills: ['social_media', 'scheduling', 'cross_platform'] },
  data: { role: 'Data Pipeline Engineer', skills: ['etl', 'google_sheets', 'airtable', 'data_sync'] },
  monitor: { role: 'Monitoring Agent', skills: ['observability', 'alerting', 'performance', 'bottlenecks'] },
}

export async function ensureAutomationAgents(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const [key, def] of Object.entries(AUTO_AGENTS)) {
    const { data: existing } = await supabase.from('agents').select('id').eq('user_id', userId).eq('role', def.role).limit(1)
    const rows = (existing ?? []) as any[]
    if (rows.length > 0) {
      ids[key] = rows[0].id
    } else {
      const { data: created } = await supabase.from('agents').insert([{
        user_id: userId, name: def.role, type: 'automation', role: def.role,
        department: 'operations', status: 'active', skills: def.skills,
        specialization: def.role.toLowerCase().replace(/\s+/g, '_'), level: 1,
        performance_score: 60, success_rate: 50, hired_at: new Date().toISOString(),
      }]).select('id').single()
      if (created) ids[key] = created.id
    }
  }
  return ids
}

export async function createWorkflowFromSales(supabase: SupabaseClient, userId: string, category: string): Promise<string | null> {
  const systemPrompt = 'You are an Automation Architect. Design an outreach automation workflow. Return JSON: {"name": "workflow name", "description": "desc", "steps": ["step"], "integrations": ["int"], "triggers": ["trigger"]}'
  const result = await executeAgentTask(supabase, userId, null,
    `Design a ${category} outreach automation workflow`, { systemPrompt }
  )
  let spec: any = { name: `${category} Outreach`, description: '', steps: [], integrations: [], triggers: [] }
  try { spec = JSON.parse(result.response || '{}') } catch { /* use defaults */ }

  const { data: wf } = await supabase.from('automations').insert([{
    user_id: userId, name: spec.name, description: spec.description,
    category, status: 'draft', pipeline_status: 'idea',
    config: { steps: spec.steps, integrations: spec.integrations, triggers: spec.triggers },
  }]).select('id').single()
  return wf?.id || null
}

export async function advancePipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const s of AUTO_STAGES) counts[s] = 0
  const agents = await ensureAutomationAgents(supabase, userId)
  const now = new Date().toISOString()

  // idea → requirements
  const { data: ideas } = await supabase.from('automations').select('id, name, description, category, config').eq('user_id', userId).eq('pipeline_status', 'idea').limit(5)
  for (const wf of (ideas ?? []) as any[]) {
    const systemPrompt = 'You are an Automation Architect. Define requirements for this workflow. Return JSON: {"requirements": ["req1"], "expectedOutcomes": ["outcome"], "successMetrics": ["metric"]}'
    const result = await executeAgentTask(supabase, userId, null,
      `Define automation requirements for: ${wf.name} (${wf.category})`, { systemPrompt }
    )
    let reqs: any = {}
    try { reqs = JSON.parse(result.response || '{}') } catch { /* ok */ }
    await supabase.from('automations').update({ pipeline_status: 'requirements', assignee_id: agents.architect, updated_at: now }).eq('id', wf.id)
    await assignTaskToEmployee(supabase, userId, agents.architect, `Define requirements: ${wf.name}`, `Create automation requirements for ${wf.category}`)
    counts['idea']++
  }

  // requirements → workflow_design
  const { data: reqd } = await supabase.from('automations').select('id, name, category, config').eq('user_id', userId).eq('pipeline_status', 'requirements').limit(5)
  for (const wf of (reqd ?? []) as any[]) {
    const systemPrompt = 'You are a Workflow Designer. Design the workflow steps. Return JSON: {"workflowSteps": [{"step": "name", "action": "desc", "condition": "if any"}], "estimatedDuration": number}'
    const result = await executeAgentTask(supabase, userId, null, `Design workflow for automation: ${wf.name}`, { systemPrompt })
    let design: any = {}
    try { design = JSON.parse(result.response || '{}') } catch { /* ok */ }
    await supabase.from('automations').update({ pipeline_status: 'workflow_design', workflow_doc: design.workflowSteps ? JSON.stringify(design.workflowSteps) : null, assignee_id: agents.designer, updated_at: now }).eq('id', wf.id)
    counts['requirements']++
  }

  // workflow_design → integration_mapping
  const { data: designed } = await supabase.from('automations').select('id, name, category, config').eq('user_id', userId).eq('pipeline_status', 'workflow_design').limit(5)
  for (const wf of (designed ?? []) as any[]) {
    const systemPrompt = 'You are an Integration Engineer. Map the required integrations for this workflow. Return JSON: {"integrations": [{"provider": "name", "purpose": "purpose", "dataFlow": "description"}], "webhooks": ["webhook1"]}'
    const result = await executeAgentTask(supabase, userId, null, `Map integrations for automation: ${wf.name} (${wf.category})`, { systemPrompt })
    let mapping: any = {}
    try { mapping = JSON.parse(result.response || '{}') } catch { /* ok */ }
    const integrations = mapping.integrations || []
    await supabase.from('automations').update({
      pipeline_status: 'integration_mapping',
      integration_mappings: mapping,
      assignee_id: agents.integration, updated_at: now,
    }).eq('id', wf.id)
    // Create integration records
    for (const int of integrations.slice(0, 3)) {
      const { data: existing } = await supabase.from('integrations').select('id').eq('user_id', userId).eq('provider', int.provider || 'webhooks').limit(1)
      if (!existing || existing.length === 0) {
        await supabase.from('integrations').insert([{
          user_id: userId, name: `${int.provider || 'Integration'} Connection`,
          provider: int.provider || 'webhooks', type: 'api', status: 'disconnected',
        }]).maybeSingle()
      }
    }
    counts['workflow_design']++
  }

  // integration_mapping → implementation
  const { data: mapped } = await supabase.from('automations').select('id, name, category, integration_mappings').eq('user_id', userId).eq('pipeline_status', 'integration_mapping').limit(5)
  for (const wf of (mapped ?? []) as any[]) {
    let mappings: any = {}
    try { mappings = typeof wf.integration_mappings === 'string' ? JSON.parse(wf.integration_mappings) : (wf.integration_mappings || {}) } catch { /* ok */ }
    const integrations = mappings.integrations || []
    const hasEmail = integrations.some((i: any) => ['gmail', 'outlook'].includes(i.provider))
    const hasSocial = integrations.some((i: any) => ['linkedin', 'facebook', 'instagram', 'x'].includes(i.provider))
    const hasCRM = integrations.some((i: any) => ['hubspot', 'salesforce'].includes(i.provider))
    const hasData = integrations.some((i: any) => ['google_sheets', 'airtable'].includes(i.provider))

    agents.email && (hasEmail ? await assignTaskToEmployee(supabase, userId, agents.email, `Email integration: ${wf.name}`, 'Set up email automation sequences') : null)
    agents.social && (hasSocial ? await assignTaskToEmployee(supabase, userId, agents.social, `Social integration: ${wf.name}`, 'Configure social media automation') : null)
    agents.crm && (hasCRM ? await assignTaskToEmployee(supabase, userId, agents.crm, `CRM integration: ${wf.name}`, 'Set up CRM automation pipeline') : null)
    agents.data && (hasData ? await assignTaskToEmployee(supabase, userId, agents.data, `Data pipeline: ${wf.name}`, 'Configure data sync automation') : null)

    await supabase.from('automations').update({ pipeline_status: 'implementation', assignee_id: agents.api_connector, updated_at: now }).eq('id', wf.id)
    counts['integration_mapping']++
  }

  // implementation → testing
  const { data: impl } = await supabase.from('automations').select('id, name').eq('user_id', userId).eq('pipeline_status', 'implementation').limit(5)
  for (const wf of (impl ?? []) as any[]) {
    await supabase.from('automations').update({ pipeline_status: 'testing', assignee_id: agents.webhook, updated_at: now }).eq('id', wf.id)
    await assignTaskToEmployee(supabase, userId, agents.webhook, `Test automation: ${wf.name}`, 'Run test scenarios, validate triggers and webhooks')
    counts['implementation']++
  }

  // testing → deployment
  const { data: tested } = await supabase.from('automations').select('id, name, category').eq('user_id', userId).eq('pipeline_status', 'testing').limit(5)
  for (const wf of (tested ?? []) as any[]) {
    await supabase.from('automations').update({ pipeline_status: 'deployment', status: 'active', assignee_id: agents.monitor, updated_at: now }).eq('id', wf.id)
    // Create trigger
    await supabase.from('workflow_triggers').insert([{
      user_id: userId, workflow_id: wf.id, trigger_type: 'event', config: { source: 'automation_cycle' }, is_active: true,
    }]).maybeSingle()
    // Save template
    await supabase.from('workflow_templates').insert([{
      user_id: userId, name: `${wf.name} Template`, category: wf.category,
      steps: [], integrations: [], triggers: ['event'],
    }]).maybeSingle()
    counts['testing']++
  }

  // deployment → monitoring
  const { data: deployed } = await supabase.from('automations').select('id, name').eq('user_id', userId).eq('pipeline_status', 'deployment').limit(5)
  for (const wf of (deployed ?? []) as any[]) {
    await supabase.from('automations').update({ pipeline_status: 'monitoring', updated_at: now }).eq('id', wf.id)
    // Log activation
    await supabase.from('automation_logs').insert([{
      user_id: userId, workflow_id: wf.id, level: 'info', message: `Automation ${wf.name} deployed and monitoring`,
    }])
    counts['deployment']++
  }

  // monitoring → optimization
  const { data: monitored } = await supabase.from('automations').select('id, name, total_runs, success_runs, failed_runs, category, config').eq('user_id', userId).eq('pipeline_status', 'monitoring').limit(5)
  for (const wf of (monitored ?? []) as any[]) {
    const successRate = wf.total_runs > 0 ? Math.round((wf.success_runs || 0) / wf.total_runs * 100) : 0
    const totalRuns = (wf.total_runs || 0) + 1
    const successRuns = (wf.success_runs || 0) + (successRate >= 50 ? 1 : 0)
    const failedRuns = (wf.failed_runs || 0) + (successRate < 50 ? 1 : 0)

    const systemPrompt = 'You are a Monitoring Agent. Analyze this automation and suggest optimizations. Return JSON: {"optimizations": ["opt1"], "bottlenecks": ["bn"], "recommendation": "summary"}'
    const result = await executeAgentTask(supabase, userId, null,
      `Analyze automation: ${wf.name}. Success rate: ${successRate}%, Total runs: ${totalRuns}`, { systemPrompt }
    )
    let analysis: any = {}
    try { analysis = JSON.parse(result.response || '{}') } catch { /* ok */ }

    await supabase.from('automations').update({
      pipeline_status: 'optimization', total_runs: totalRuns, success_runs: successRuns,
      failed_runs: failedRuns, performance_score: successRate,
      config: { ...((wf.config as any) || {}), optimizations: analysis.optimizations, bottlenecks: analysis.bottlenecks },
      updated_at: now,
    }).eq('id', wf.id)

    if (analysis.optimizations?.length) {
      await storeMemory(supabase, userId, {
        category: 'automation_learning', tags: [wf.id, 'optimization', wf.category],
        content: { workflowId: wf.id, name: wf.name, type: 'optimization', suggestions: analysis.optimizations, bottlenecks: analysis.bottlenecks, analyzedAt: now },
      })
    }
    counts['monitoring']++
  }

  return counts
}

export async function getAutoMetrics(supabase: SupabaseClient, userId: string): Promise<AutoMetrics> {
  const { data: workflows } = await supabase.from('automations').select('pipeline_status, status, category, total_runs, success_runs, failed_runs').eq('user_id', userId)
  const all = (workflows ?? []) as any[]
  const byPipeline: Record<string, number> = {}; const byCategory: Record<string, number> = {}
  let activeCount = 0; let totalRuns = 0; let successRuns = 0; let failedCount = 0
  for (const w of all) {
    if (w.pipeline_status) byPipeline[w.pipeline_status] = (byPipeline[w.pipeline_status] || 0) + 1
    byCategory[w.category] = (byCategory[w.category] || 0) + 1
    if (w.status === 'active') activeCount++
    totalRuns += w.total_runs || 0; successRuns += w.success_runs || 0; failedCount += w.failed_runs || 0
  }
  const { data: integrations } = await supabase.from('integrations').select('status').eq('user_id', userId)
  const { data: templates } = await supabase.from('workflow_templates').select('id').eq('user_id', userId)
  return {
    total: all.length, byPipeline, byCategory, activeCount,
    totalRuns, successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
    failedCount,
    totalIntegrations: (integrations ?? []).length,
    connectedIntegrations: (integrations ?? []).filter((i: any) => i.status === 'connected').length,
    totalTemplates: (templates ?? []).length,
  }
}

export async function getAutoPipeline(supabase: SupabaseClient, userId: string): Promise<Record<string, any[]>> {
  const { data } = await supabase.from('automations').select('*, agents!automations_assignee_id_fkey(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  const items = ((data ?? []) as any[]).map((r: any) => ({ ...r, assignee_name: r.agents?.name || null }))
  const pipeline: Record<string, any[]> = {}
  for (const stage of AUTO_STAGES) pipeline[stage] = []
  for (const item of items) {
    const ps = item.pipeline_status || 'idea'
    if (pipeline[ps]) pipeline[ps].push(item)
  }
  return pipeline
}

export async function runFullAutomationCycle(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  await ensureAutomationAgents(supabase, userId)

  // Create automations from various department triggers
  try {
    // Sales → outreach automations
    const { data: salesRes } = await supabase.from('automations').select('id').eq('user_id', userId).in('category', ['sales', 'lead_gen']).limit(1)
    if (!salesRes || salesRes.length === 0) {
      for (const cat of ['sales', 'lead_gen']) await createWorkflowFromSales(supabase, userId, cat)
    }
  } catch { /* ok */ }

  try {
    // Content → publishing automations
    const { data: contentRes } = await supabase.from('automations').select('id').eq('user_id', userId).eq('category', 'content').limit(1)
    if (!contentRes || contentRes.length === 0) {
      await supabase.from('automations').insert([{ user_id: userId, name: 'Content Publishing', category: 'content', status: 'draft', pipeline_status: 'idea', config: { steps: ['generate', 'approve', 'publish'], integrations: ['social_media'] } }]).maybeSingle()
    }
    // Social media automations
    const { data: socialRes } = await supabase.from('automations').select('id').eq('user_id', userId).eq('category', 'social_media').limit(1)
    if (!socialRes || socialRes.length === 0) {
      await supabase.from('automations').insert([{ user_id: userId, name: 'Social Media Scheduling', category: 'social_media', status: 'draft', pipeline_status: 'idea', config: { steps: ['schedule', 'post', 'monitor'], integrations: ['linkedin', 'facebook', 'instagram', 'x'] } }]).maybeSingle()
    }
  } catch { /* ok */ }

  const stages = await advancePipeline(supabase, userId)
  const metrics = await getAutoMetrics(supabase, userId)
  await storeMemory(supabase, userId, {
    category: 'automation_learning', tags: ['automation_cycle'],
    content: { stages, metrics, runAt: new Date().toISOString() },
  })
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action: '[Automation] Cycle completed', module: 'operations', status: 'success',
    message: Object.entries(stages).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', '),
  }])
  return stages
}
