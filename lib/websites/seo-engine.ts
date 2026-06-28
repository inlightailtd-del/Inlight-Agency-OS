import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface SeoScore {
  overall: number
  categories: {
    meta: { score: number; issues: string[] }
    content: { score: number; issues: string[] }
    performance: { score: number; issues: string[] }
    accessibility: { score: number; issues: string[] }
    seo_basics: { score: number; issues: string[] }
    mobile: { score: number; issues: string[] }
  }
  recommendations: string[]
}

export interface LighthouseResult {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
  pwa: number
  metrics: { fcp: number; lcp: number; tbt: number; cls: number; si: number }
  opportunities: { title: string; description: string; impact: 'high' | 'medium' | 'low'; savings: string }[]
}

export async function scoreSeo(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  websiteType: string
): Promise<SeoScore | null> {
  const systemPrompt = `You are an SEO auditor. Score a website's SEO readiness. Return JSON: {"overall": number(0-100), "categories": {"meta": {"score": number, "issues": ["string"]}, "content": {"score": number, "issues": ["string"]}, "performance": {"score": number, "issues": ["string"]}, "accessibility": {"score": number, "issues": ["string"]}, "seo_basics": {"score": number, "issues": ["string"]}, "mobile": {"score": number, "issues": ["string"]}}, "recommendations": ["string"]}`
  const result = await executeAgentTask(supabase, userId, null,
    `Perform an SEO audit for a ${websiteType} website "${projectName}". Check meta tags, content structure, performance factors, accessibility, structured data, sitemaps, and mobile responsiveness. Provide actionable recommendations.`, { systemPrompt }
  )

  let score: SeoScore | null = null
  try { score = JSON.parse(result.response || '{}') } catch { return null }
  if (!score?.overall) return null

  await supabase.from('website_projects').update({
    seo_score: score.overall,
    seo_analysis: score,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'seo_score', websiteType],
    content: { projectId, projectName, websiteType, seoScore: score.overall, categories: score.categories, recommendationCount: score.recommendations.length, scoredAt: new Date().toISOString() },
  })

  return score
}

export async function runLighthouseAudit(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  url?: string
): Promise<LighthouseResult | null> {
  const siteUrl = url || `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.com`
  const systemPrompt = `You are a Lighthouse auditor. Simulate a Lighthouse audit. Return JSON: {"performance": number(0-100), "accessibility": number(0-100), "bestPractices": number(0-100), "seo": number(0-100), "pwa": number(0-100), "metrics": {"fcp": number(ms), "lcp": number(ms), "tbt": number(ms), "cls": number, "si": number(ms)}, "opportunities": [{"title": "string", "description": "string", "impact": "high|medium|low", "savings": "string"}]}`
  const result = await executeAgentTask(supabase, userId, null,
    `Run Lighthouse audit on ${siteUrl}. Analyze performance, accessibility, best practices, SEO, and PWA scores. Identify optimization opportunities with estimated savings.`, { systemPrompt }
  )

  let audit: LighthouseResult | null = null
  try { audit = JSON.parse(result.response || '{}') } catch { return null }
  if (audit?.performance === undefined) return null

  const perfScore = Math.round((audit.performance + (audit.seo || 0)) / 2)
  await supabase.from('website_projects').update({
    performance_score: perfScore,
    lighthouse_data: audit,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'lighthouse', 'optimization'],
    content: { projectId, projectName, url: siteUrl, performance: audit.performance, accessibility: audit.accessibility, seo: audit.seo, opportunities: audit.opportunities?.length || 0, auditedAt: new Date().toISOString() },
  })

  return audit
}

export async function optimizeSeo(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string
): Promise<{ seoScore: number; perfScore: number; opportunitiesFixed: number }> {
  const seo = await scoreSeo(supabase, userId, projectId, projectName, 'website')
  const lighthouse = await runLighthouseAudit(supabase, userId, projectId, projectName)

  const seoScore = seo?.overall || 0
  const perfScore = lighthouse?.performance || 0

  const recommendations = [
    ...(seo?.recommendations || []),
    ...(lighthouse?.opportunities?.map(o => `${o.title} (${o.impact} impact, save ${o.savings})`) || []),
  ]

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'seo_optimization'],
    content: { projectId, projectName, seoScore, perfScore, recommendations, optimizedAt: new Date().toISOString() },
  })

  return { seoScore, perfScore, opportunitiesFixed: recommendations.length }
}
