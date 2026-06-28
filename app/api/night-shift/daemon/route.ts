import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NightShiftRuntime } from '@/lib/night-shift/runtime'
import type { DaemonConfig, DaemonStatus } from '@/lib/night-shift/types'

const activeDaemons = new Map<string, NightShiftRuntime>()

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const action: string = body.action || 'start'
    const config: Partial<DaemonConfig> | undefined = body.config

    let runtime = activeDaemons.get(user.id)

    switch (action) {
      case 'start': {
        if (!runtime) {
          runtime = new NightShiftRuntime(supabase as any, user.id)
          activeDaemons.set(user.id, runtime)
        }
        await runtime.start(config)
        const state = runtime.getDaemon().getState()
        return NextResponse.json({ status: state.status, daemonId: state.id, loopCount: state.totalLoops })
      }

      case 'stop': {
        if (!runtime) return NextResponse.json({ error: 'No active daemon' }, { status: 404 })
        await runtime.stop()
        activeDaemons.delete(user.id)
        return NextResponse.json({ status: 'stopped' })
      }

      case 'pause': {
        if (!runtime) return NextResponse.json({ error: 'No active daemon' }, { status: 404 })
        await runtime.pause()
        return NextResponse.json({ status: 'paused' })
      }

      case 'resume': {
        if (!runtime) return NextResponse.json({ error: 'No active daemon' }, { status: 404 })
        await runtime.resume()
        return NextResponse.json({ status: 'resumed' })
      }

      case 'status': {
        if (!runtime) return NextResponse.json({ status: 'idle' })
        const state = runtime.getDaemon().getState()
        const report = await runtime.getMonitor().generateReport(state, 0, 0)
        return NextResponse.json({
          status: state.status,
          daemonId: state.id,
          loopCount: state.totalLoops,
          uptime: Date.now() - (state.startedAt ? new Date(state.startedAt).getTime() : Date.now()),
          healthScore: report.healthScore,
          metrics: report.metrics,
        })
      }

      case 'cycle': {
        if (!runtime) {
          runtime = new NightShiftRuntime(supabase as any, user.id)
        }
        const result = await runtime.runCycle()
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtime = activeDaemons.get(user.id)
  if (!runtime) return NextResponse.json({ status: 'idle' })

  const state = runtime.getDaemon().getState()
  return NextResponse.json({
    status: state.status,
    daemonId: state.id,
    loopCount: state.totalLoops,
    config: state.config,
    startedAt: state.startedAt,
    lastHeartbeat: state.lastHeartbeat,
    errors: state.errors.slice(-10),
  })
}
