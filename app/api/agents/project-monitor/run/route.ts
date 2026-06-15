import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentRuntime } from '@/lib/agents/runtime'
import { runProjectMonitor, PROJECT_MONITOR_SYSTEM_PROMPT } from '@/lib/agents/project-monitor'

/**
 * POST /api/agents/project-monitor/run
 *
 * Run the Project Monitor Agent via the AgentRuntime.
 * Uses manual execution mode — finds an idle agent and runs the monitor scan.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Find a capable agent (prefer automation type, fallback to any idle agent)
    let { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'automation')
      .eq('status', 'idle')
      .order('performance_score', { ascending: false })
      .limit(1)
      .single()

    if (!agent) {
      const { data: fallback } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'idle')
        .order('performance_score', { ascending: false })
        .limit(1)
        .single()
      agent = fallback
    }

    if (!agent) {
      return NextResponse.json(
        { ok: false, error: 'No idle agent available. Create one in /dashboard/agents first.' },
        { status: 400 }
      )
    }

    // Run the monitor via the runtime (manual execution)
    const runtime = new AgentRuntime(supabase, user.id)
    const execResult = await runtime.exec(agent.id, 'Scan all active projects and report risks.', {
      systemPrompt: PROJECT_MONITOR_SYSTEM_PROMPT,
      priority: 'high',
    })

    // Run the structured analysis in parallel
    const analysisResult = await runProjectMonitor(supabase, user.id, agent as any)

    return NextResponse.json({
      ok: true,
      agent: agent.name,
      execution: execResult,
      analysis: analysisResult,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
