'use client'

import { useEffect, useState, useCallback } from 'react'

export default function CreativeFactoryPage() {
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const load = useCallback(async () => {
    const res = await fetch('/api/creative-factory/status')
    if (res?.ok) setStatus(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    setRunning(true); setResult(null)
    try {
      const res = await fetch('/api/creative-factory/run', { method: 'POST' })
      const data = await res.json()
      setResult(data)
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
          <h1 className="text-3xl font-bold text-slate-900">Creative Factory</h1>
          <p className="text-sm text-slate-500 mt-1">Thumbnails → Covers → Carousels → B-Roll → Generation Queue</p>
        </div>
        <button onClick={handleRun} disabled={running}
          className="px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 text-white rounded-lg hover:from-pink-700 hover:to-rose-600 font-medium text-sm transition-colors disabled:opacity-50 shadow-sm">
          {running ? 'Processing...' : 'Process Reel Packages'}
        </button>
      </div>

      {result && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 mb-6">
          <p className="text-sm font-semibold text-slate-900 mb-2">Processing Results</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><p className="text-[10px] text-slate-500 uppercase">Packages</p><p className="text-lg font-bold text-slate-900">{result.results?.length || 0}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Assets</p><p className="text-lg font-bold text-slate-900">{result.totalAssets || 0}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Queued</p><p className="text-lg font-bold text-slate-900">{result.totalQueued || 0}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Errors</p><p className="text-lg font-bold text-rose-600">{result.errors?.length || 0}</p></div>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {['overview', 'assets', 'prompts', 'queue'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && s && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Total Assets</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.totalAssets}</p></div>
          <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Thumbnails</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.thumbnails}</p></div>
          <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Covers</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.covers}</p></div>
          <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">B-Rolls</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.bRolls}</p></div>
        </div>
      )}

      {tab === 'assets' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.assets?.items?.length ? status.assets.items.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700">{a.asset_type}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : a.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
              <span className="text-xs text-slate-700 flex-1 truncate">{a.prompt?.substring(0, 80)}</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">Run Creative Factory to generate assets</p>}
        </div>
      )}

      {tab === 'prompts' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.prompts?.items?.length ? status.prompts.items.map((p: any, i: number) => (
            <div key={i} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{p.prompt_type}</span>
                {p.performance_score != null && <span className="text-[10px] font-mono text-slate-400">Score: {p.performance_score}</span>}
              </div>
              <p className="text-xs text-slate-700">{p.prompt_text?.substring(0, 120)}</p>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No prompts yet</p>}
        </div>
      )}

      {tab === 'queue' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.queue?.items?.length ? status.queue.items.map((q: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{q.status}</span>
              <span className="text-[10px] text-slate-400">{q.model}</span>
              <span className="text-xs text-slate-700 flex-1 truncate">{q.prompt?.substring(0, 60)}</span>
              <span className="text-[9px] text-slate-400">P{q.priority}</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No queued jobs</p>}
        </div>
      )}
    </div>
  )
}
