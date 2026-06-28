import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface DesignSystem {
  colors: { primary: string; secondary: string; accent: string; background: string; text: string; muted: string; border: string; success: string; warning: string; error: string }
  typography: { headings: { font: string; weights: number[]; sizes: Record<string, string> }; body: { font: string; weight: number; size: string; lineHeight: string }; monospace: { font: string; size: string } }
  spacing: { unit: number; scale: number[] }
  borderRadius: { sm: string; md: string; lg: string; full: string }
  shadows: { sm: string; md: string; lg: string; xl: string }
  breakpoints: { sm: number; md: number; lg: number; xl: number }
  animation: { duration: { fast: string; normal: string; slow: string }; easing: string }
}

export async function generateDesignSystem(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  websiteType: string,
  brandColors?: string[]
): Promise<DesignSystem | null> {
  const colorHint = brandColors?.length ? `Brand colors: ${brandColors.join(', ')}. ` : ''
  const systemPrompt = `You are a Design AI creating complete design systems. Return JSON: {"colors": {"primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "text": "#hex", "muted": "#hex", "border": "#hex", "success": "#hex", "warning": "#hex", "error": "#hex"}, "typography": {"headings": {"font": "Inter|Plus Jakarta Sans|DM Sans", "weights": [400,500,600,700], "sizes": {"h1": "4xl","h2": "3xl","h3": "2xl","h4": "xl","h5": "lg","h6": "base"}}, "body": {"font": "Inter|DM Sans", "weight": 400, "size": "1rem", "lineHeight": "1.625"}, "monospace": {"font": "JetBrains Mono|Fira Code", "size": "0.875rem"}}, "spacing": {"unit": 4, "scale": [0,1,2,3,4,5,6,8,10,12,16,20,24]}, "borderRadius": {"sm": "0.375rem", "md": "0.5rem", "lg": "0.75rem", "full": "9999px"}, "shadows": {"sm": "0 1px 2px...", "md": "0 4px 6px...", "lg": "0 10px 15px...", "xl": "0 20px 25px..."}, "breakpoints": {"sm": 640, "md": 768, "lg": 1024, "xl": 1280}, "animation": {"duration": {"fast": "150ms", "normal": "300ms", "slow": "500ms"}, "easing": "cubic-bezier(0.4, 0, 0.2, 1)"}}`
  const result = await executeAgentTask(supabase, userId, null,
    `${colorHint}Generate a complete design system for a ${websiteType} website "${projectName}". Include colors, typography, spacing, border radius, shadows, breakpoints, and animation. Ensure WCAG 2.1 AA contrast compliance.`, { systemPrompt }
  )

  let design: DesignSystem | null = null
  try { design = JSON.parse(result.response || '{}') } catch { return null }
  if (!design?.colors?.primary) return null

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'design_system', websiteType],
    content: { projectId, projectName, websiteType, designSystem: design, generatedAt: new Date().toISOString() },
  })

  await supabase.from('website_projects').update({
    design_system: design, updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  return design
}
