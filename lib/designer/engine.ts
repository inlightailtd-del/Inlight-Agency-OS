import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface DesignerReport {
  summary: string
  designAssets: DesignAsset[]
  brandingGuidelines: string[]
  recommendations: string[]
}

export interface DesignAsset {
  type: 'logo' | 'social_visual' | 'ad_creative' | 'thumbnail' | 'presentation' | 'mockup' | 'brand_asset'
  name: string
  description: string
  specifications: string
  aiGeneratedPrompt: string
}

export interface DesignBrief {
  brandName: string
  style: string
  colors: string[]
  fonts: string[]
  mood: string
  references: string[]
}

export class DesignerAgent {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async createBrandIdentity(brandName: string, industry: string): Promise<DesignBrief> {
    const start = Date.now()

    const systemPrompt = `You are a Senior Brand Designer. Create a complete brand identity brief. Return JSON:
{
  "brandName": "the brand name",
  "style": "overall visual style direction",
  "colors": ["primary", "secondary", "accent hex codes"],
  "fonts": ["heading font", "body font"],
  "mood": "brand mood description",
  "references": ["style reference 1", "reference 2"]
}`

    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Create a brand identity for "${brandName}" in the ${industry} industry. Consider modern design trends.`,
      { systemPrompt }
    )

    let brief: DesignBrief = { brandName, style: '', colors: [], fonts: [], mood: '', references: [] }
    try { brief = { ...brief, ...JSON.parse(result.response || '{}') } } catch { brief.style = result.response || '' }

    await storeMemory(this.supabase, this.userId, {
      category: 'design_brand',
      content: { type: 'brand_identity', brief, createdAt: new Date().toISOString() },
      tags: ['designer', 'brand', industry],
    })

    await this.log('designer_brand_identity', `Brand: ${brandName} | ${(Date.now() - start)}ms`)
    return brief
  }

  async generateDesignAssets(project: string, count: number = 3): Promise<DesignAsset[]> {
    const start = Date.now()

    const systemPrompt = `You are a Digital Designer. Generate design asset specifications. Return JSON:
{
  "assets": [
    {
      "type": "logo|social_visual|ad_creative|thumbnail|presentation|mockup|brand_asset",
      "name": "asset name",
      "description": "visual description",
      "specifications": "technical specs (size, format, resolution)",
      "aiGeneratedPrompt": "detailed prompt for AI image generation"
    }
  ]
}`

    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Generate ${count} design assets for: ${project}. Include specifications suitable for AI image generation tools.`,
      { systemPrompt }
    )

    let assets: DesignAsset[] = []
    try { assets = JSON.parse(result.response || '{}').assets || [] } catch { /* use default */ }

    if (assets.length === 0) {
      assets = [{
        type: 'brand_asset', name: `${project} Visual`,
        description: `Brand visual for ${project}`,
        specifications: '1920x1080px, RGB, PNG',
        aiGeneratedPrompt: `Create a professional visual for ${project}`,
      }]
    }

    await storeMemory(this.supabase, this.userId, {
      category: 'design_assets',
      content: { type: 'generated_assets', project, assets, createdAt: new Date().toISOString() },
      tags: ['designer', 'assets', project.toLowerCase().replace(/\s+/g, '_')],
    })

    await this.log('designer_assets', `${assets.length} assets for: ${project.substring(0, 60)} | ${(Date.now() - start)}ms`)
    return assets
  }

  async createSocialVisuals(platform: string, topic: string): Promise<DesignAsset[]> {
    const systemPrompt = `You are a Social Media Designer. Create platform-optimized visual specs. Return JSON:
{
  "assets": [
    {
      "type": "social_visual",
      "name": "post visual name",
      "description": "visual concept description",
      "specifications": "platform-specific dimensions and format",
      "aiGeneratedPrompt": "detailed AI image generation prompt"
    }
  ]
}`

    const specs: Record<string, string> = {
      linkedin: '1200x627px, RGB, PNG — LinkedIn feed post',
      facebook: '1200x630px, RGB, PNG — Facebook feed post',
      instagram: '1080x1080px, RGB, PNG — Instagram square post',
      x: '1600x900px, RGB, PNG — X/Twitter card',
      youtube: '1280x720px, RGB, PNG — YouTube thumbnail',
    }

    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Create a ${platform} visual for topic: "${topic}". Platform specs: ${specs[platform] || specs.linkedin}`,
      { systemPrompt }
    )

    let assets: DesignAsset[] = []
    try { assets = JSON.parse(result.response || '{}').assets || [] } catch { /* use default */ }

    if (assets.length === 0) {
      assets = [{
        type: 'social_visual', name: `${platform} - ${topic}`,
        description: `${platform} visual for ${topic}`,
        specifications: specs[platform] || specs.linkedin,
        aiGeneratedPrompt: `Create a ${platform} visual about ${topic}`,
      }]
    }

    await this.log('designer_social_visual', `${platform}: ${topic.substring(0, 60)} | ${assets.length} assets`)
    return assets
  }

  async assessDesignNeeds(): Promise<DesignerReport> {
    const start = Date.now()
    const { data: content } = await this.supabase
      .from('content_requests')
      .select('title, content_type, status')
      .eq('user_id', this.userId)
      .in('status', ['generated', 'draft'])
      .limit(20)

    const items = (content ?? []) as any[]
    const context = items.map((c: any) => `${c.title} (${c.content_type}) — ${c.status}`).join('\n')

    const systemPrompt = `You are a Design Director. Assess design needs based on upcoming content. Return JSON:
{
  "summary": "design needs assessment",
  "designAssets": [
    {
      "type": "logo|social_visual|ad_creative|thumbnail|presentation|mockup|brand_asset",
      "name": "asset name",
      "description": "description",
      "specifications": "specs",
      "aiGeneratedPrompt": "prompt"
    }
  ],
  "brandingGuidelines": ["guideline1"],
  "recommendations": ["rec1"]
}`

    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Upcoming content needing design:\n${context || 'No upcoming content found. Suggest brand assets.'}\n\nAssess design needs.`,
      { systemPrompt }
    )

    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response }

    await this.log('designer_assessment', `Assets: ${parsed.designAssets?.length || 0} | ${(Date.now() - start)}ms`)
    return {
      summary: parsed.summary || 'Design assessment completed',
      designAssets: parsed.designAssets || [],
      brandingGuidelines: parsed.brandingGuidelines || [],
      recommendations: parsed.recommendations || [],
    }
  }

  private async log(action: string, message: string, status = 'success'): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null,
        action: `[Designer] ${action}`, module: 'designer', status, message,
      }])
    } catch { /* best effort */ }
  }
}
