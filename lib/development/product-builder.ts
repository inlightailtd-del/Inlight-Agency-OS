import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { RepoIntelligenceEngine } from './repo-intelligence'
import { ResearchEngine } from './research-engine'
import { ExecutionEngine, type FileOp } from './execution-engine'
import { ArchitectAgent } from './architect'
import { PlannerAgent } from './planner'

export interface ProductSpec {
  name: string
  description: string
  targetAudience: string
  coreFeatures: string[]
  techStack: string[]
  databaseSchema: string
  apiEndpoints: string[]
  frontendPages: string[]
}

export class ProductBuilder {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async build(productRequest: string): Promise<{
    spec: ProductSpec | null
    filesCreated: number
    errors: string[]
  }> {
    const errors: string[] = []
    
    // Phase 1: Research
    const research = new ResearchEngine(this.supabase, this.userId)
    const researchResult = await research.research('product:' + productRequest, 'Product to build within Inlight Agency OS ecosystem')

    // Phase 2: Architecture
    const repoIntel = new RepoIntelligenceEngine(this.supabase, this.userId)
    const arch = await repoIntel.scan()

    const architect = new ArchitectAgent(this.supabase, this.userId)
    const plan = await architect.createPlan(
      `Build: ${productRequest}`,
      `Existing architecture has ${arch.totalFiles} files across lib, api, and dashboard modules. Database has ${arch.dbMigrations.length} migrations. Queue has ${arch.queueJobs.length} job types.`
    )

    // Phase 3: Generate product spec
    const prompt = `Design a complete product specification for:

REQUEST: ${productRequest}
ARCHITECTURE PLAN: ${JSON.stringify(plan)}
RECOMMENDED TECHNOLOGIES: ${JSON.stringify(researchResult.recommendations.slice(0, 5))}

Output a JSON product specification:
{
  "name": "Product name",
  "description": "What it does",
  "targetAudience": "Who it's for",
  "coreFeatures": ["feature1", "feature2"],
  "techStack": ["Next.js", "Supabase", "TypeScript"],
  "databaseSchema": "List of tables with columns",
  "apiEndpoints": ["POST /api/..."],
  "frontendPages": ["/dashboard/product-name"]
}

RULES:
- Build on top of Inlight Agency OS
- Use existing auth, queue, integrations systems
- Follow existing patterns in lib/, app/api/, app/dashboard/`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: `You are a Senior Product Architect. You design complete, production-ready product specifications that integrate with existing systems. You never suggest new architecture — you extend what exists.`,
    })

    const spec: ProductSpec | null = this.extractSpec(result.response || '')

    // Phase 4: Generate implementation files
    let filesCreated = 0
    if (spec) {
      const planner = new PlannerAgent(this.supabase, this.userId)
      const tasks = await planner.createTasks(plan)

      const fileOps: FileOp[] = []
      const implPrompt = `Generate the actual implementation files for:

PRODUCT: ${spec.name}
FEATURES: ${spec.coreFeatures.join(', ')}
DB SCHEMA: ${spec.databaseSchema}
API: ${spec.apiEndpoints.join(', ')}

Generate complete, production-ready files. Output them as code blocks.`

      const implResult = await executeAgentTask(this.supabase, this.userId, null, implPrompt, {
        systemPrompt: `You implement production-ready Next.js 14 code. Every file must compile. Use real API calls, never mock data. Follow Inlight Agency OS patterns exactly.`,
      })

      // Extract file blocks from response
      const fileBlocks = implResult.response?.match(/```[\w]*:(.+?)\n([\s\S]*?)```/g) || []
      for (const block of fileBlocks) {
        const header = block.match(/```[\w]*:(.+?)\n/)
        const code = block.replace(/```[\w]*:(.+?)\n/, '').replace(/```$/, '')
        if (header) {
          const filePath = header[1].trim()
          fileOps.push({
            operation: 'create',
            path: filePath,
            content: code,
            description: `Created for ${spec.name}`,
          })
        }
      }

      const execEngine = new ExecutionEngine(this.supabase, this.userId)
      const execResult = await execEngine.execute(fileOps)
      filesCreated = execResult.filesChanged

      // Store in development memory
      await this.supabase.from('development_memory').insert([{
        user_id: this.userId,
        type: 'plan',
        name: `Product: ${spec.name}`,
        description: `${filesCreated} files created`,
        content: { spec, filesCreated, buildSuccess: execResult.buildSuccess, createdAt: new Date().toISOString() },
        tags: ['development', 'product', spec.name.toLowerCase().replace(/\s+/g, '-')],
        status: 'active',
      }])
    }

    return { spec, filesCreated, errors }
  }

  private extractSpec(text: string): ProductSpec | null {
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch {}
    return null
  }
}
