import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DevelopmentSystemOrchestrator } from '@/lib/development'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({ goal: 'Improve Inlight Agency OS' }))

    const orchestrator = new DevelopmentSystemOrchestrator(supabase, user.id)

    // Route to correct mode
    const mode = body.mode || 'full'
    let result: any

    switch (mode) {
      case 'goal':
        result = await orchestrator.runGoalMode(body.goal)
        break
      case 'repo-scan':
        const { RepoIntelligenceEngine } = await import('@/lib/development/repo-intelligence')
        const repo = new RepoIntelligenceEngine(supabase, user.id)
        result = await repo.scan()
        break
      case 'research':
        const { ResearchEngine } = await import('@/lib/development/research-engine')
        const research = new ResearchEngine(supabase, user.id)
        result = await research.research(body.goal, body.context)
        break
      case 'debug':
        const { DebugEngine } = await import('@/lib/development/debug-engine')
        const debug = new DebugEngine(supabase, user.id)
        result = await debug.debug(body.maxAttempts || 5)
        break
      case 'product':
        const { ProductBuilder } = await import('@/lib/development/product-builder')
        const pb = new ProductBuilder(supabase, user.id)
        result = await pb.build(body.goal)
        break
      case 'website':
        const { WebsiteBuilder } = await import('@/lib/development/website-builder')
        const wb = new WebsiteBuilder(supabase, user.id)
        result = await wb.build(body.goal)
        break
      case 'improve':
        const { SelfImprovementEngine } = await import('@/lib/development/self-improvement')
        const si = new SelfImprovementEngine(supabase, user.id)
        result = await si.analyze()
        break
      default:
        result = await orchestrator.runFullCycle(body.goal, body.context)
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
