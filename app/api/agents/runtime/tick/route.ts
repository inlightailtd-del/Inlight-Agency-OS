import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentRuntime } from '@/lib/agents/runtime'

/**
 * POST /api/agents/runtime/tick
 *
 * Three execution modes via body:
 *   - {}                     → scheduled tick (drain queue)
 *   - { agentId, prompt }    → manual execution (one agent, one prompt)
 *   - { event, payload }     → event-driven execution
 *   - { plan, steps }        → multi-agent delegation
 *
 * Usage:
 *   POST /api/agents/runtime/tick          (scheduled — cron calls this)
 *   POST /api/agents/runtime/tick { agentId, prompt }  (manual — button click)
 *   POST /api/agents/runtime/tick { event, payload }   (event — webhook)
 *   POST /api/agents/runtime/tick { plan, steps }      (delegation — orchestrator)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const runtime = new AgentRuntime(supabase, user.id)

    // Parse body (optional — defaults to scheduled tick)
    let body: any = {}
    try { body = await request.json() } catch { /* no body, scheduled tick */ }

    // Dispatch by intent
    if (body.agentId && body.prompt) {
      // Manual — one agent, one prompt
      const result = await runtime.exec(body.agentId, body.prompt, {
        systemPrompt: body.systemPrompt,
        priority: body.priority,
      })
      return NextResponse.json({ mode: 'manual', result })
    }

    if (body.event) {
      // Event-driven
      const result = await runtime.on(body.event, body.payload ?? {}, body.plan)
      return NextResponse.json({ mode: 'event', result })
    }

    if (body.plan?.id && body.plan?.steps) {
      // Multi-agent delegation
      const result = await runtime.delegate(body.plan, { mode: 'manual' })
      return NextResponse.json({ mode: 'delegation', result })
    }

    // Default: scheduled tick
    const result = await runtime.tick({ maxTasks: body.maxTasks ?? 20 })
    return NextResponse.json({ mode: 'scheduled', result })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
