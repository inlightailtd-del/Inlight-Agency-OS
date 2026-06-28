import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface WireframeSection {
  name: string
  type: 'hero' | 'features' | 'pricing' | 'testimonials' | 'cta' | 'footer' | 'navigation' | 'content' | 'gallery' | 'faq' | 'contact' | 'stats'
  layout: string
  components: { type: string; content: string; position: string }[]
  notes: string
}

export interface WireframePage {
  name: string
  path: string
  purpose: string
  sections: WireframeSection[]
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface WireframeBlueprint {
  projectName: string
  websiteType: string
  pages: WireframePage[]
  globalElements: { navigation: string[]; footer: string[] }
  designNotes: string[]
}

export async function generateWireframes(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  websiteType: string
): Promise<WireframeBlueprint | null> {
  const systemPrompt = `You are a UX/UI designer creating wireframe blueprints. Return JSON: {"projectName": "string", "websiteType": "string", "pages": [{"name": "string", "path": "string", "purpose": "string", "priority": "critical|high|medium|low", "sections": [{"name": "string", "type": "hero|features|pricing|testimonials|cta|footer|navigation|content|gallery|faq|contact|stats", "layout": "full-width|grid|split|cards|list", "components": [{"type": "string", "content": "string", "position": "top|center|bottom"}], "notes": "string"}]}], "globalElements": {"navigation": ["Home","Features","Pricing","Contact"], "footer": ["About","Privacy","Terms"]}, "designNotes": ["string"]}`
  const result = await executeAgentTask(supabase, userId, null,
    `Design wireframe blueprints for a ${websiteType} website: "${projectName}". Include 3-6 pages with detailed sections per page. Consider mobile responsiveness and user flows.`, { systemPrompt }
  )

  let blueprint: WireframeBlueprint | null = null
  try { blueprint = JSON.parse(result.response || '{}') } catch { return null }
  if (!blueprint?.pages?.length) return null

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'wireframe', websiteType],
    content: { projectId, projectName, websiteType, pageCount: blueprint.pages.length, totalSections: blueprint.pages.reduce((s: number, p: WireframePage) => s + p.sections.length, 0), designNotes: blueprint.designNotes, generatedAt: new Date().toISOString() },
  })

  return blueprint
}
