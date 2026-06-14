import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { ExecutionEngine, type FileOp } from './execution-engine'

export interface WebsiteSpec {
  businessName: string
  industry: string
  pages: { name: string; sections: string[] }[]
  seoKeywords: string[]
  competitors: { name: string; strengths: string[] }[]
  colorScheme: string
  typography: string
}

export class WebsiteBuilder {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async build(request: string): Promise<{
    spec: WebsiteSpec | null
    filesCreated: number
    errors: string[]
  }> {
    const errors: string[] = []

    // Phase 1: Competitor analysis + structure generation
    const designPrompt = `Design a complete website for:

REQUEST: ${request}

Output a JSON website specification:
{
  "businessName": "Company name",
  "industry": "Industry",
  "pages": [
    { "name": "Home", "sections": ["Hero", "Features", "Testimonials", "CTA"] },
    { "name": "About", "sections": ["Story", "Team", "Mission"] },
    { "name": "Services", "sections": ["Service cards", "Process", "Pricing"] },
    { "name": "Contact", "sections": ["Form", "Map", "Social"] }
  ],
  "seoKeywords": ["keyword1", "keyword2"],
  "competitors": [{ "name": "Competitor", "strengths": ["strength1"] }],
  "colorScheme": "description of colors",
  "typography": "font choices"
}`

    const designResult = await executeAgentTask(this.supabase, this.userId, null, designPrompt, {
      systemPrompt: `You are a Senior Web Designer and Strategist. You create detailed website specifications optimized for conversion, SEO, and user experience.`,
    })

    const spec = this.extractSpec(designResult.response || '')

    // Phase 2: Generate pages
    let filesCreated = 0
    if (spec) {
      const fileOps: FileOp[] = []

      for (const page of spec.pages) {
        const pagePrompt = `Generate a complete Next.js 14 page component for:

WEBSITE: ${spec.businessName}
PAGE: ${page.name}
SECTIONS: ${page.sections.join(', ')}
INDUSTRY: ${spec.industry}
SEO KEYWORDS: ${spec.seoKeywords.join(', ')}
COLORS: ${spec.colorScheme}

Output the complete component code with Tailwind CSS styling.
Use proper SEO meta tags, responsive design, and conversion-optimized layouts.
File path: website/pages/${page.name.toLowerCase().replace(/\s+/g, '-')}.tsx`

        const pageResult = await executeAgentTask(this.supabase, this.userId, null, pagePrompt, {
          systemPrompt: `You build production-ready Next.js 14 pages with Tailwind CSS. Every page must be responsive, SEO-optimized, and conversion-focused. Use 'use client' only when needed.`,
        })

        // Extract code blocks
        const blocks = pageResult.response?.match(/```[\w]*:(.+?)\n([\s\S]*?)```/g) || []
        for (const block of blocks) {
          const header = block.match(/```[\w]*:(.+?)\n/)
          const code = block.replace(/```[\w]*:(.+?)\n/, '').replace(/```$/, '')
          if (header) {
            fileOps.push({
              operation: 'create',
              path: header[1].trim(),
              content: code,
              description: `${page.name} page for ${spec.businessName}`,
            })
          }
        }
      }

      // Generate copywriting
      const copyPrompt = `Write compelling copy for:

WEBSITE: ${spec.businessName}
INDUSTRY: ${spec.industry}
PAGES: ${spec.pages.map(p => p.name).join(', ')}

For each page, provide:
- Headline (max 10 words)
- Subheadline (max 20 words)
- 3 key value propositions
- Primary CTA text

Output as JSON.`

      const copyResult = await executeAgentTask(this.supabase, this.userId, null, copyPrompt, {
        systemPrompt: `You are a copywriter specializing in high-conversion website copy. You write clear, benefit-driven copy that drives action.`,
      })

      fileOps.push({
        operation: 'create',
        path: `website/copy/${spec.businessName.toLowerCase().replace(/\s+/g, '-')}.json`,
        content: copyResult.response || '',
        description: 'Website copywriting',
      })

      const execEngine = new ExecutionEngine(this.supabase, this.userId)
      const execResult = await execEngine.execute(fileOps)
      filesCreated = execResult.filesChanged

      // Store in development memory
      await this.supabase.from('development_memory').insert([{
        user_id: this.userId,
        type: 'plan',
        name: `Website: ${spec.businessName}`,
        description: `${spec.pages.length} pages, ${filesCreated} files created`,
        content: { spec, filesCreated, createdAt: new Date().toISOString() },
        tags: ['development', 'website', spec.businessName.toLowerCase().replace(/\s+/g, '-')],
        status: 'active',
      }])
    }

    return { spec, filesCreated, errors }
  }

  private extractSpec(text: string): WebsiteSpec | null {
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch {}
    return null
  }
}
