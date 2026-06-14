import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DevLoopV2 } from '@/lib/dev-v2'
import { SelfImprovementLoop } from '@/lib/dev-v2'
import { RepoGraphEngine } from '@/lib/dev-v2'
import { GitEngine } from '@/lib/dev-v2'
import { RootCauseAnalysisEngine } from '@/lib/dev-v2'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const authHeader = request.headers.get('Authorization')
    let user

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data } = await supabase.auth.getUser(token)
      user = data.user
    } else {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const objective = body.objective || 'Run repository analysis and self-diagnostics'
    const mode = body.mode || 'full'

    const loop = new DevLoopV2(supabase, user.id)
    const result = await loop.run(objective, mode)

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const authHeader = request.headers.get('Authorization')
    let user

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data } = await supabase.auth.getUser(token)
      user = data.user
    } else {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [cycles, commits, adrs, rcas, graph, agents, improveStatus] = await Promise.all([
      supabase.from('dev_cycles').select('id, objective, mode, status, commit_count, file_count, duration_ms, started_at, completed_at').eq('user_id', user.id).order('started_at', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('dev_git_commits').select('id, message, hash, status, files_changed, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('dev_adr').select('id, title, status, tags, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('dev_rca').select('id, symptom, category, severity, fix_status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),
      supabase.from('dev_repo_graph').select('file_path, file_type, size_bytes, dependents').eq('user_id', user.id).limit(100).then(r => r.data || []),
      supabase.from('dev_swarm_agents').select('role, specialization, is_active, performance_metrics').eq('user_id', user.id).then(r => r.data || []),
      new SelfImprovementLoop(supabase, user.id).getStatus(),
    ])

    return NextResponse.json({
      summary: {
        totalCycles: cycles.length,
        runningCycles: cycles.filter((c: any) => c.status === 'running').length,
        completedCycles: cycles.filter((c: any) => c.status === 'completed').length,
        failedCycles: cycles.filter((c: any) => c.status === 'failed').length,
        totalCommits: commits.length,
        totalAdrs: adrs.length,
        totalRcas: rcas.length,
        totalFiles: graph.length,
        agents: agents.length,
      },
      cycles, commits, adrs, rcas,
      graph: {
        totalFiles: graph.length,
        fileTypes: [...new Set(graph.map((g: any) => g.file_type))],
        totalDependents: graph.reduce((s: number, g: any) => s + ((g.dependents as any[])?.length || 0), 0),
      },
      agents: agents.map((a: any) => ({
        role: a.role,
        specialization: a.specialization,
        isActive: a.is_active,
        performance: a.performance_metrics,
      })),
      selfImprovement: improveStatus,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
