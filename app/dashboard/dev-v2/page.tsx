'use client'

import { useEffect, useState, useCallback } from 'react'

export default function DevV2Page() {
  const [status, setStatus] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('cycles')
  const [objective, setObjective] = useState('')
  const [mode, setMode] = useState('full')

  const load = useCallback(async () => {
    const res = await fetch('/api/dev-v2')
    if (res.ok) setStatus(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!objective.trim()) return
    setRunning(true); setResult(null)
    try {
      const res = await fetch('/api/dev-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, mode }),
      })
      setResult(await res.json())
      await load()
    } catch {}
    setRunning(false)
  }

  const s = status?.summary
  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">ASE v2</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous Software Engineer — Continuous Development System</p>
        </div>
      </div>

      {/* Run Panel */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Run Development Cycle</h2>
        <div className="flex gap-3 mb-3">
          <input value={objective} onChange={e => setObjective(e.target.value)}
            placeholder="Enter objective (e.g., 'Fix TypeScript errors', 'Add API endpoint', 'Refactor auth')"
            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <select value={mode} onChange={e => setMode(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg bg-white">
            <option value="full">Full Cycle</option>
            <option value="fix">Quick Fix</option>
            <option value="feature">Feature</option>
            <option value="refactor">Refactor</option>
          </select>
          <button onClick={handleRun} disabled={running || !objective.trim()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
            {running ? 'Running...' : 'Run Cycle'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 mb-6">
          <p className="text-sm font-semibold mb-2">Result: {result.status}</p>
          <div className="grid grid-cols-5 gap-3 text-center text-xs">
            <div><p className="text-slate-500">Phases</p><p className="text-lg font-bold text-slate-900">{result.phases?.length || 0}</p></div>
            <div><p className="text-slate-500">Commits</p><p className="text-lg font-bold text-slate-900">{result.commits || 0}</p></div>
            <div><p className="text-slate-500">ADRs</p><p className="text-lg font-bold text-slate-900">{result.adrsCreated || 0}</p></div>
            <div><p className="text-slate-500">Files</p><p className="text-lg font-bold text-slate-900">{result.filesChanged || 0}</p></div>
            <div><p className="text-slate-500">Errors</p><p className="text-lg font-bold text-red-600">{result.errors?.length || 0}</p></div>
          </div>
          {result.phases && (
            <div className="mt-3 space-y-1">
              {result.phases.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-slate-700 min-w-[200px]">{p.phase}</span>
                  <span className="text-slate-400">({(p.durationMs / 1000).toFixed(1)}s)</span>
                  <span className="text-slate-500 truncate">{p.detail?.substring(0, 80)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Cycles</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalCycles || 0}</p><p className="text-[10px] text-slate-400">{s?.failedCycles || 0} failed</p></div>
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Commits</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalCommits || 0}</p></div>
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">ADRs</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalAdrs || 0}</p></div>
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">RCAs</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.totalRcas || 0}</p><p className="text-[10px] text-slate-400">{s?.totalFiles || 0} files</p></div>
        <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Agents</p><p className="text-2xl font-bold text-slate-900 mt-1">{s?.agents || 0}</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {['cycles', 'commits', 'adrs', 'rcas', 'agents', 'improvement'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'cycles' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.cycles?.length ? status.cycles.map((c: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : c.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{c.status}</span>
              <span className="text-[10px] text-slate-400 w-12">{c.mode}</span>
              <span className="text-xs text-slate-700 flex-1 truncate">{c.objective?.substring(0, 80)}</span>
              <span className="text-[10px] text-slate-400">{c.commit_count} commits</span>
              <span className="text-[10px] text-slate-400">{c.duration_ms ? `${(c.duration_ms / 1000).toFixed(0)}s` : ''}</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No cycles yet. Run one above.</p>}
        </div>
      )}

      {tab === 'commits' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.commits?.length ? status.commits.map((c: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-400 w-24">{c.hash?.substring(0, 8) || '---'}</span>
              <span className="text-xs text-slate-700 flex-1 truncate">{c.message?.substring(0, 80)}</span>
              <span className="text-[10px] text-slate-400">{c.files_changed?.length || 0} files</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No commits yet</p>}
        </div>
      )}

      {tab === 'adrs' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.adrs?.length ? status.adrs.map((a: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
              <span className="text-xs text-slate-700 flex-1 truncate">{a.title?.substring(0, 80)}</span>
              <span className="text-[10px] text-slate-400">{a.tags?.join(', ')}</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No ADRs recorded</p>}
        </div>
      )}

      {tab === 'rcas' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.rcas?.length ? status.rcas.map((r: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.severity === 'critical' ? 'bg-red-100 text-red-700' : r.severity === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{r.severity}</span>
              <span className="text-[10px] text-slate-400 w-16">{r.category}</span>
              <span className="text-xs text-slate-700 flex-1 truncate">{r.symptom?.substring(0, 80)}</span>
              <span className="text-[10px] text-slate-400">{r.fix_status}</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No RCAs logged</p>}
        </div>
      )}

      {tab === 'agents' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.agents?.length ? status.agents.map((a: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{a.role}</span>
              <span className="text-xs text-slate-700 flex-1">{a.specialization}</span>
              <span className={`text-[10px] ${a.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{a.isActive ? 'Active' : 'Inactive'}</span>
              <span className="text-[10px] text-slate-400">{a.performance?.tasksCompleted || 0} tasks</span>
              <span className="text-[10px] text-slate-400">{Math.round(a.performance?.successRate || 0)}% success</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No swarm agents</p>}
        </div>
      )}

      {tab === 'improvement' && status?.selfImprovement && (
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-sm font-semibold mb-3">Self-Improvement Status</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-50 rounded p-3"><p className="text-[10px] text-slate-500">Total Cycles</p><p className="text-lg font-bold">{status.selfImprovement.totalCycles}</p></div>
            <div className="bg-slate-50 rounded p-3"><p className="text-[10px] text-slate-500">Failed</p><p className="text-lg font-bold text-red-600">{status.selfImprovement.failedCycles}</p></div>
            <div className="bg-slate-50 rounded p-3"><p className="text-[10px] text-slate-500">RCAs</p><p className="text-lg font-bold">{status.selfImprovement.totalRcas}</p></div>
          </div>
          {status.selfImprovement.topErrors?.length > 0 && (
            <div><p className="text-xs font-medium text-slate-700 mb-2">Top Error Categories</p>
              {status.selfImprovement.topErrors.map((e: string, i: number) => (
                <p key={i} className="text-xs text-slate-600 mb-1">• {e}</p>
              ))}
            </div>
          )}
          {status.selfImprovement.improvements?.length > 0 && (
            <div className="mt-3"><p className="text-xs font-medium text-slate-700 mb-2">Applied Improvements</p>
              {status.selfImprovement.improvements.map((imp: string, i: number) => (
                <p key={i} className="text-xs text-slate-600 mb-1">✓ {imp}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
