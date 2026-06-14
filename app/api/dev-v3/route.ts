import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DevLoopV3 } from '@/lib/dev-v3'
import { ArchGraphEngine } from '@/lib/dev-v3'
import { CodeQualityEngine } from '@/lib/dev-v3'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = request.headers.get('Authorization')
    let user
    if (auth?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(auth.slice(7))
      user = data.user
    } else {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const objective = body.objective || 'Run ASE v3 diagnostics and quality analysis'

    const loop = new DevLoopV3(supabase, user.id)
    const result = await loop.run(objective)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = request.headers.get('Authorization')
    let user
    if (auth?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(auth.slice(7))
      user = data.user
    } else {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [docs, arch, tests, branches, rollbacks, logs] = await Promise.all([
      supabase.from('dev_v3_docs').select('topic,summary,source').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10).then(r => r.data || []),
      supabase.from('dev_v3_arch_graph').select('module_name,module_type,complexity,quality_score').eq('user_id', user.id).limit(50).then(r => r.data || []),
      supabase.from('dev_v3_tests').select('file_path,test_type,status').eq('user_id', user.id).limit(20).then(r => r.data || []),
      supabase.from('dev_v3_branches').select('branch_name,status,commits').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10).then(r => r.data || []),
      supabase.from('dev_v3_rollbacks').select('commit_hash,reason,success').eq('user_id', user.id).order('restored_at', { ascending: false }).limit(5).then(r => r.data || []),
      supabase.from('execution_logs').select('action,status,message').eq('user_id', user.id).eq('module', 'development').order('created_at', { ascending: false }).limit(5).then(r => r.data || []),
    ])

    const archStats = arch.reduce((acc: any, m: any) => {
      acc.totalModules = (acc.totalModules || 0) + 1
      acc.avgComplexity = (acc.avgComplexity || 0) + (m.complexity || 0)
      acc.types[m.module_type] = (acc.types[m.module_type] || 0) + 1
      return acc
    }, { totalModules: 0, avgComplexity: 0, types: {} })
    if (archStats.totalModules) archStats.avgComplexity = Math.round(archStats.avgComplexity / archStats.totalModules)

    return NextResponse.json({
      summary: {
        totalDocs: docs.length,
        totalModules: arch.length,
        totalTests: tests.length,
        totalBranches: branches.length,
        totalRollbacks: rollbacks.length,
        passingTests: tests.filter((t: any) => t.status === 'passing').length,
        activeBranches: branches.filter((b: any) => b.status === 'active').length,
      },
      docs, arch: { items: arch, stats: archStats }, tests, branches, rollbacks, logs,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
