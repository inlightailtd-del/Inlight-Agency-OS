'use client'

import { useEffect, useState, useCallback } from 'react'

export default function DevV3Page() {
  const [status, setStatus] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [objective, setObjective] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/dev-v3')
    if (res.ok) setStatus(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!objective.trim()) return
    setRunning(true); setResult(null)
    const res = await fetch('/api/dev-v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective: objective.trim() }),
    })
    if (res.ok) setResult(await res.json())
    await load()
    setRunning(false)
  }

  const s = status?.summary
  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">ASE v3</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous Software Engineer — Research → Plan → Branch → Code → Build → Test → Fix → Commit → Learn</p>
        </div>
      </div>

      {/* Run Panel */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Run Full Development Cycle</h2>
        <div className="flex gap-3">
          <input value={objective} onChange={e => setObjective(e.target.value)}
            placeholder="Enter objective (e.g., 'Add error handling to API routes', 'Fix TypeScript strict mode')"
            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400" />
          <button onClick={handleRun} disabled={running || !objective.trim()}
            className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50">
            {running ? 'Running...' : 'Run Full Cycle'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 mb-6">
          <p className="text-sm font-semibold mb-2">Result: <span className={result.status === 'completed' ? 'text-emerald-700' : 'text-red-700'}>{result.status}</span></p>
          <div className="grid grid-cols-7 gap-3 text-center text-xs mb-3">
            <div><p className="text-slate-500">Phases</p><p className="text-lg font-bold text-slate-900">{result.phases?.length || 0}</p></div>
            <div><p className="text-slate-500">Commits</p><p className="text-lg font-bold text-slate-900">{result.commits || 0}</p></div>
            <div><p className="text-slate-500">Docs</p><p className="text-lg font-bold text-slate-900">{result.docsResearched || 0}</p></div>
            <div><p className="text-slate-500">Quality</p><p className="text-lg font-bold text-slate-900">{result.qualityScore || '—'}</p></div>
            <div><p className="text-slate-500">Tests</p><p className="text-lg font-bold text-slate-900">{result.testsGenerated || 0}</p></div>
            <div><p className="text-slate-500">Branches</p><p className="text-lg font-bold text-slate-900">{result.branchesCreated || 0}</p></div>
            <div><p className="text-slate-500">Errors</p><p className="text-lg font-bold text-red-600">{result.errors?.length || 0}</p></div>
          </div>
          {result.phases && (
            <div className="space-y-0.5">
              {result.phases.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-slate-700 min-w-[200px]">{p.phase}</span>
                  <span className="text-slate-400">({(p.durationMs / 1000).toFixed(1)}s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Docs Researched</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalDocs || 0}</p></div>
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Modules Scanned</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalModules || 0}</p></div>
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Tests</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalTests || 0}</p><p className="text-[10px] text-emerald-600">{s?.passingTests || 0} passing</p></div>
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Branches</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalBranches || 0}</p><p className="text-[10px] text-slate-400">{s?.activeBranches || 0} active</p></div>
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Rollbacks</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalRollbacks || 0}</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {['overview', 'arch', 'tests', 'branches', 'docs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && status?.arch?.stats && (
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-sm font-semibold mb-3">Architecture Overview</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-50 rounded p-3"><p className="text-[10px] text-slate-500">Total Modules</p><p className="text-lg font-bold">{status.arch.stats.totalModules || 0}</p></div>
            <div className="bg-slate-50 rounded p-3"><p className="text-[10px] text-slate-500">Avg Complexity</p><p className="text-lg font-bold">{status.arch.stats.avgComplexity || 0}</p></div>
            <div className="bg-slate-50 rounded p-3"><p className="text-[10px] text-slate-500">Module Types</p><p className="text-lg font-bold">{Object.keys(status.arch.stats.types || {}).length}</p></div>
          </div>
          {status.arch.stats.types && Object.entries(status.arch.stats.types).map(([type, count]: any) => (
            <div key={type} className="flex items-center gap-2 text-xs mb-1">
              <span className="w-16 text-slate-500">{type}</span>
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(count / Math.max(status.arch.stats.totalModules, 1)) * 100}%` }} />
              </div>
              <span className="text-slate-700 font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'arch' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.arch?.items?.length ? status.arch.items.map((m: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3 text-xs">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 w-16 text-center">{m.module_type}</span>
              <span className="flex-1 text-slate-700 truncate">{m.module_name}</span>
              <span className="text-slate-400">Cpx: {m.complexity}</span>
              <span className={m.quality_score >= 7 ? 'text-emerald-600' : 'text-amber-600'}>{m.quality_score}/10</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">Run a cycle to scan modules</p>}
        </div>
      )}

      {tab === 'tests' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.tests?.length ? status.tests.map((t: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3 text-xs">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.status === 'passing' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
              <span className="text-[10px] text-slate-400 w-14">{t.test_type}</span>
              <span className="flex-1 text-slate-700 truncate">{t.file_path}</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No tests generated yet</p>}
        </div>
      )}

      {tab === 'branches' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.branches?.length ? status.branches.map((b: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3 text-xs">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${b.status === 'active' ? 'bg-blue-100 text-blue-700' : b.status === 'merged' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
              <span className="flex-1 text-slate-700 font-mono truncate">{b.branch_name}</span>
              <span className="text-slate-400">{b.commits || 0} commits</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No branches created</p>}
        </div>
      )}

      {tab === 'docs' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.docs?.length ? status.docs.map((d: any, i: number) => (
            <div key={i} className="px-5 py-3 text-xs">
              <p className="font-medium text-slate-700">{d.topic}</p>
              <p className="text-slate-400 truncate">{d.summary?.substring(0, 120) || 'No summary'}</p>
              <p className="text-[10px] text-slate-400">Source: {d.source}</p>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No docs researched yet</p>}
        </div>
      )}
    </div>
  )
}
