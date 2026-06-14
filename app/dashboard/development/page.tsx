'use client'

import { useState, useEffect } from 'react'

type Mode = 'full' | 'goal' | 'repo-scan' | 'research' | 'debug' | 'product' | 'website' | 'improve'

const MODE_INFO: Record<Mode, { label: string; desc: string }> = {
  'full': { label: 'Full Cycle', desc: 'Plan → Build → Validate → Debug → Refactor → Learn → Improve' },
  'goal': { label: 'Goal Mode', desc: 'Research → Plan → Build → Debug → Improve (for product/website goals)' },
  'repo-scan': { label: 'Repo Scan', desc: 'Scan codebase architecture, dependencies, and module graph' },
  'research': { label: 'Research', desc: 'Technology research and recommendations' },
  'debug': { label: 'Debug', desc: 'Auto-fix build errors with Observe→Analyze→Fix→Retest loop' },
  'product': { label: 'Product Builder', desc: 'Build a complete product (spec + impl + files)' },
  'website': { label: 'Website Builder', desc: 'Build a complete website (structure + pages + copy)' },
  'improve': { label: 'Self-Improvement', desc: 'Analyze failures, successes, and improve future cycles' },
}

export default function DevelopmentPage() {
  const [goal, setGoal] = useState('Improve Inlight Agency OS')
  const [mode, setMode] = useState<Mode>('full')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [memory, setMemory] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'cycle' | 'memory'>('cycle')

  const loadMemory = async () => {
    const res = await fetch('/api/development/memory')
    if (res.ok) setMemory(await res.json())
  }

  useEffect(() => { if (tab === 'memory') loadMemory() }, [tab])

  const handleRun = async () => {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/development/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, mode, context: '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    }
    setRunning(false)
  }

  const modeBadge = (status: string) => {
    const colors: Record<string, string> = { working: 'bg-emerald-100 text-emerald-700', completed: 'bg-emerald-100 text-emerald-700', completed_with_errors: 'bg-amber-100 text-amber-700', failed: 'bg-red-100 text-red-700' }
    return <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-100 text-slate-500'}`}>{status}</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dev System</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous Software Engineer — 8 engines, one goal</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {(['cycle', 'memory'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'cycle' ? 'Run' : 'Memory'}
          </button>
        ))}
      </div>

      {tab === 'cycle' && (
        <>
          {/* Mode Selector */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(Object.entries(MODE_INFO) as [Mode, typeof MODE_INFO[Mode]][]).map(([key, info]) => (
              <button key={key} onClick={() => setMode(key)}
                className={`text-left p-3 rounded-lg border transition-all ${mode === key ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <p className="text-xs font-semibold text-slate-900">{info.label}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{info.desc}</p>
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              {mode === 'product' ? 'Product Request' : mode === 'website' ? 'Website Request' : mode === 'research' ? 'Research Topic' : 'Goal'}
            </label>
            <textarea value={goal} onChange={e => setGoal(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4" rows={3}
              placeholder={
                mode === 'product' ? 'Build a Real Estate SaaS...' :
                mode === 'website' ? 'Build website for an AI agency...' :
                mode === 'research' ? 'Evaluate vector databases for Next.js...' :
                'What should Inlight build or improve?'
              } />
            <button onClick={handleRun} disabled={running || !goal.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {running ? 'Running...' : `Run ${MODE_INFO[mode].label}`}
            </button>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6"><p className="text-sm text-red-700">{error}</p></div>}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className={`rounded-lg border p-4 ${result.errors?.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-900">{MODE_INFO[mode].label} Results</p>
                  {modeBadge(result.status)}
                </div>
                <div className="grid grid-cols-5 gap-3 text-center">
                  {result.totalFiles !== undefined && <div><p className="text-[10px] text-slate-500">Files</p><p className="text-sm font-bold text-slate-900">{result.totalFiles}</p></div>}
                  {result.totalDirs !== undefined && <div><p className="text-[10px] text-slate-500">Dirs</p><p className="text-sm font-bold text-slate-900">{result.totalDirs}</p></div>}
                  {result.recommendations?.length !== undefined && <div><p className="text-[10px] text-slate-500">Recs</p><p className="text-sm font-bold text-slate-900">{result.recommendations?.length || 0}</p></div>}
                  {result.patternsFound?.length !== undefined && <div><p className="text-[10px] text-slate-500">Patterns</p><p className="text-sm font-bold text-slate-900">{result.patternsFound?.length || 0}</p></div>}
                  {result.filesCreated !== undefined && <div><p className="text-[10px] text-slate-500">Created</p><p className="text-sm font-bold text-slate-900">{result.filesCreated}</p></div>}
                  {result.totalAttempts !== undefined && <div><p className="text-[10px] text-slate-500">Attempts</p><p className="text-sm font-bold text-slate-900">{result.totalAttempts}</p></div>}
                  {result.builds?.length !== undefined && <div><p className="text-[10px] text-slate-500">Builds</p><p className="text-sm font-bold text-slate-900">{(result.builds as any[])?.filter((b: any) => b.success).length}/{result.builds?.length}</p></div>}
                  {result.lessonsLearned !== undefined && <div><p className="text-[10px] text-slate-500">Lessons</p><p className="text-sm font-bold text-slate-900">{result.lessonsLearned}</p></div>}
                </div>
                {result.errors?.length > 0 && (
                  <div className="mt-3 text-xs text-red-600 border-t border-amber-200 pt-2">{result.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}</div>
                )}
              </div>

              {/* Summary */}
              {result.summary && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Summary</p>
                  <p className="text-xs text-slate-700">{result.summary}</p>
                </div>
              )}

              {/* Plan */}
              {result.plan && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Plan: {result.plan.title}</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    <p className="text-xs text-slate-600 mt-2">{result.plan.overview}</p>
                    {result.plan.components?.map((c: any, i: number) => (
                      <div key={i} className="text-xs text-slate-700 py-1 border-b border-slate-50 last:border-0">
                        <strong>{c.name}</strong> (p{c.priority}) — {c.description}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Debug Cycles */}
              {result.cycles?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Debug Cycles ({result.cycles.length})</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    {result.cycles.map((c: any, i: number) => (
                      <div key={i} className="py-2 border-b border-slate-50 last:border-0">
                        <p className="text-xs"><strong>Attempt {c.attempt}</strong>: {c.success ? '✓ Passed' : `Error: ${c.error?.substring(0, 100)}`}</p>
                        {c.fix && <p className="text-[10px] text-slate-500 mt-1">Fix: {c.fix}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Recommendations */}
              {result.recommendations?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Recommendations ({result.recommendations.length})</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    {result.recommendations.map((r: string, i: number) => (
                      <p key={i} className="text-xs text-slate-700 py-1">→ {r}</p>
                    ))}
                  </div>
                </details>
              )}

              {/* Patterns Found */}
              {result.patternsFound?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Patterns ({result.patternsFound.length})</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    {result.patternsFound.map((p: any, i: number) => (
                      <div key={i} className="py-2 border-b border-slate-50 last:border-0">
                        <p className="text-xs"><span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-600">{p.type}</span> {p.description}</p>
                        {p.action && <p className="text-[10px] text-purple-600 mt-0.5">→ {p.action}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Tasks */}
              {result.tasks?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Tasks ({result.tasks.length})</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    {result.tasks.map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : t.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
                        <span className="text-[10px] text-slate-400 w-16">{t.agentType}</span>
                        <span className="text-xs text-slate-700 flex-1">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'memory' && (
        <div className="space-y-6">
          {memory && (
            <>
              {memory.plans?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Plans & Architecture</h3>
                  {memory.plans.map((m: any, i: number) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{m.type}</span>
                        <p className="text-sm font-medium text-slate-900">{m.name}</p>
                      </div>
                      <p className="text-xs text-slate-500">{m.description}</p>
                      <p className="text-[9px] text-slate-400 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
              {memory.lessons?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Lessons & Patterns</h3>
                  {memory.lessons.map((m: any, i: number) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${m.type === 'success_pattern' ? 'bg-emerald-100 text-emerald-700' : m.type === 'failure' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{m.type}</span>
                        <p className="text-sm font-medium text-slate-900">{m.name}</p>
                      </div>
                      <p className="text-xs text-slate-500">{m.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {(!memory.plans?.length && !memory.lessons?.length) && <p className="text-sm text-slate-400">No development memory yet. Run a cycle.</p>}
            </>
          )}
          {!memory && <button onClick={loadMemory} className="text-sm text-purple-600 hover:text-purple-800">Load Memory</button>}
        </div>
      )}
    </div>
  )
}
