import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { generateTheme, getThemeStyle } from './theme-generator'
import { generateDesignSystem } from './design-ai'

export interface LandingPageSection {
  type: 'hero' | 'features' | 'how_it_works' | 'testimonials' | 'pricing' | 'faq' | 'cta' | 'footer'
  title: string
  subtitle?: string
  content: string
  cta?: { text: string; href: string; variant: 'primary' | 'secondary' | 'outline' }
  image?: string
  items?: { title: string; description: string; icon?: string }[]
}

export interface LandingPageSpec {
  name: string
  headline: string
  subheadline: string
  sections: LandingPageSection[]
  seo: { title: string; description: string; keywords: string[]; ogImage: string }
  conversion: { primaryCta: string; secondaryCta?: string; formFields?: string[] }
  analytics: { googleTagId?: string; fbPixelId?: string; hotjarId?: string }
}

export async function buildLandingPage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  websiteType: string,
  goal: string = 'lead_generation'
): Promise<LandingPageSpec | null> {
  const systemPrompt = `You are a Landing Page Builder. Design a high-converting landing page. Return JSON: {"name": "string", "headline": "string", "subheadline": "string", "sections": [{"type": "hero|features|how_it_works|testimonials|pricing|faq|cta|footer", "title": "string", "subtitle": "string", "content": "string", "cta": {"text": "string", "href": "string", "variant": "primary|secondary|outline"}, "items": [{"title": "string", "description": "string"}]}], "seo": {"title": "string", "description": "string", "keywords": ["string"], "ogImage": "string"}, "conversion": {"primaryCta": "string", "secondaryCta": "string", "formFields": ["name","email","company"]}, "analytics": {"googleTagId": "G-XXXXXXXX", "fbPixelId": "XXXXXXXXX"}}`
  const result = await executeAgentTask(supabase, userId, null,
    `Design a ${websiteType} landing page for "${projectName}" with goal: ${goal}. Include persuasive hero section, feature highlights, social proof, and clear CTA. Follow conversion-centered design principles.`, { systemPrompt }
  )

  let spec: LandingPageSpec | null = null
  try { spec = JSON.parse(result.response || '{}') } catch { return null }
  if (!spec?.headline) return null

  const theme = await generateTheme(supabase, userId, projectId, spec.name || projectName, websiteType, getThemeStyle(websiteType))
  const designSystem = await generateDesignSystem(supabase, userId, projectId, spec.name || projectName, websiteType)

  await supabase.from('website_projects').update({
    landing_page_spec: spec,
    seo_title: spec.seo?.title,
    seo_description: spec.seo?.description,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'landing_page', websiteType, goal],
    content: { projectId, projectName, websiteType, goal, spec, hasTheme: !!theme, hasDesignSystem: !!designSystem, sectionCount: spec.sections?.length || 0, generatedAt: new Date().toISOString() },
  })

  return spec
}
