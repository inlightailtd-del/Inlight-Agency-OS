import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BusinessGrowthOrchestrator } from '@/lib/business'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({ industry: 'AI Agency' }))
    const orchestrator = new BusinessGrowthOrchestrator(supabase, user.id)
    const result = await orchestrator.runFullCycle(body.industry, body.niche)

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
