import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentRuntime } from '@/lib/agents/runtime'

/**
 * POST /api/agents/runtime/schedule
 *
 * Register a scheduled execution for an agent.
 * Body: { agentId, cronExpression, instruction, enabled? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    if (!body.agentId || !body.cronExpression || !body.instruction) {
      return NextResponse.json({ error: 'agentId, cronExpression, and instruction are required' }, { status: 400 })
    }

    const runtime = new AgentRuntime(supabase, user.id)
    await runtime.schedule({
      agentId: body.agentId,
      cronExpression: body.cronExpression,
      instruction: body.instruction,
      enabled: body.enabled,
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
