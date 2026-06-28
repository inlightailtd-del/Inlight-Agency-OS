import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type SaasTier = 'free' | 'starter' | 'professional' | 'enterprise'

export interface SaasBlueprint {
  name: string
  description: string
  features: string[]
  techStack: string[]
  pricingTiers: { name: string; price: number; features: string[] }[]
  authProvider: string
  paymentProvider: string
  hostingPlatform: string
  databaseType: string
  apiArchitecture: string
  estimatedDevWeeks: number
}

export async function generateSaaSBlueprint(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  idea: string
): Promise<SaasBlueprint | null> {
  const systemPrompt = `You are a SaaS Architect. Design a complete SaaS product blueprint. Return JSON: {"name": "string", "description": "string", "features": ["string"], "techStack": ["string"], "pricingTiers": [{"name": "free|starter|professional|enterprise", "price": number, "features": ["string"]}], "authProvider": "clerk|nextauth|cognito|firebase", "paymentProvider": "stripe|paddle|lemonsqueezy", "hostingPlatform": "vercel|aws|gcp|azure", "databaseType": "postgres|mysql|mongodb|sqlite", "apiArchitecture": "rest|graphql|trpc|grpc", "estimatedDevWeeks": number}`
  const result = await executeAgentTask(supabase, userId, null,
    `Design a SaaS product based on this idea: ${idea}. Include pricing tiers, tech stack, and architecture decisions.`, { systemPrompt }
  )

  let blueprint: SaasBlueprint | null = null
  try { blueprint = JSON.parse(result.response || '{}') } catch { return null }
  if (!blueprint?.name) return null

  await storeMemory(supabase, userId, {
    category: 'software_learning', tags: ['saas_generator', projectId, 'blueprint'],
    content: { projectId, blueprint, generatedAt: new Date().toISOString() },
  })

  await supabase.from('software_projects').update({
    saas_blueprint: blueprint,
    tech_stack: blueprint.techStack || [],
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  return blueprint
}

export async function generateSaasProject(
  supabase: SupabaseClient,
  userId: string,
  idea: string
): Promise<string | null> {
  const blueprint = await generateSaaSBlueprint(supabase, userId, '', idea)
  if (!blueprint) return null

  const { data: project } = await supabase.from('software_projects').insert([{
    user_id: userId, name: blueprint.name,
    description: blueprint.description,
    project_type: 'saas', status: 'idea',
    tech_stack: blueprint.techStack || [],
    saas_blueprint: blueprint,
  }]).select('id').single()

  if (!project) return null

  await generateSaaSBlueprint(supabase, userId, project.id, idea)
  return project.id
}
