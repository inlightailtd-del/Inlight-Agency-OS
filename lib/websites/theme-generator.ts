import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface ThemeConfig {
  name: string
  mode: 'light' | 'dark' | 'both'
  colors: {
    light: { primary: string; secondary: string; accent: string; background: string; surface: string; text: string; muted: string }
    dark?: { primary: string; secondary: string; accent: string; background: string; surface: string; text: string; muted: string }
  }
  fonts: { heading: string; body: string; display?: string }
  effects: { glassmorphism: boolean; gradients: boolean; animations: 'minimal' | 'moderate' | 'heavy' }
  style: 'modern' | 'minimal' | 'bold' | 'elegant' | 'playful' | 'corporate'
  cssVariables: Record<string, string>
}

const THEME_TEMPLATES: Record<string, Partial<ThemeConfig>> = {
  modern: { style: 'modern', effects: { glassmorphism: true, gradients: true, animations: 'moderate' }, fonts: { heading: 'Inter', body: 'Inter' } },
  minimal: { style: 'minimal', effects: { glassmorphism: false, gradients: false, animations: 'minimal' }, fonts: { heading: 'DM Sans', body: 'Inter' } },
  bold: { style: 'bold', effects: { glassmorphism: false, gradients: true, animations: 'moderate' }, fonts: { heading: 'Plus Jakarta Sans', body: 'DM Sans' } },
  elegant: { style: 'elegant', effects: { glassmorphism: true, gradients: false, animations: 'minimal' }, fonts: { heading: 'Playfair Display', body: 'Lora' } },
  playful: { style: 'playful', effects: { glassmorphism: true, gradients: true, animations: 'heavy' }, fonts: { heading: 'Space Grotesk', body: 'DM Sans' } },
  corporate: { style: 'corporate', effects: { glassmorphism: false, gradients: false, animations: 'minimal' }, fonts: { heading: 'Plus Jakarta Sans', body: 'Inter' } },
}

export async function generateTheme(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  websiteType: string,
  preferredStyle?: string
): Promise<ThemeConfig | null> {
  const styleHint = preferredStyle || (websiteType === 'saas' ? 'modern' : websiteType === 'agency' ? 'bold' : websiteType === 'ecommerce' ? 'modern' : websiteType === 'portfolio' ? 'minimal' : websiteType === 'blog' ? 'elegant' : 'corporate')
  const template = (THEME_TEMPLATES[styleHint] || THEME_TEMPLATES.modern) as ThemeConfig

  const effects = template.effects || { glassmorphism: false, gradients: false, animations: 'minimal' as const }
  const fonts = template.fonts || { heading: 'Inter', body: 'Inter' }
  const systemPrompt = `You are a Theme Generator AI. Generate a complete website theme. Return JSON: {"name": "string", "mode": "light|dark|both", "colors": {"light": {"primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "surface": "#hex", "text": "#hex", "muted": "#hex"}, "dark": {"primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "surface": "#hex", "text": "#hex", "muted": "#hex"}}, "fonts": {"heading": "Inter|Plus Jakarta Sans|DM Sans", "body": "Inter|DM Sans|Lora", "display": "string"}, "effects": {"glassmorphism": true, "gradients": true, "animations": "minimal|moderate|heavy"}, "style": "modern|minimal|bold|elegant|playful|corporate", "cssVariables": {"--color-primary": "#hex", "--color-bg": "#hex"}}`
  const result = await executeAgentTask(supabase, userId, null,
    `Generate a ${styleHint} theme for a ${websiteType} website "${projectName}". ${effects.glassmorphism ? 'Include glassmorphism effects.' : ''} ${effects.gradients ? 'Include gradient options.' : ''} Fonts: ${fonts.heading} for headings, ${fonts.body} for body.`, { systemPrompt }
  )

  let theme: ThemeConfig | null = null
  try { theme = JSON.parse(result.response || '{}') } catch { return null }
  if (!theme?.colors?.light?.primary) return null

  theme.style = (theme.style || styleHint) as ThemeConfig['style']
  if (!theme.fonts?.heading) theme.fonts = { heading: fonts.heading, body: fonts.body }

  await storeMemory(supabase, userId, {
    category: 'website_learning', tags: [projectId, 'theme', styleHint, websiteType],
    content: { projectId, projectName, websiteType, theme, generatedAt: new Date().toISOString() },
  })

  return theme
}

export function getThemeStyle(websiteType: string): string {
  const styleMap: Record<string, string> = {
    saas: 'modern', agency: 'bold', ecommerce: 'modern',
    portfolio: 'minimal', blog: 'elegant', business: 'corporate',
    landing_page: 'modern',
  }
  return styleMap[websiteType] || 'modern'
}
