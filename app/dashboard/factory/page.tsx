'use client'

import { useEffect, useState, useCallback } from 'react'

export default function ContentFactoryPage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/content-factory/status')
    if (res?.ok) setStatus(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleRun = async () => {
    setRunning(true); setResult(null)
    try {
      const res = await fetch('/api/content-factory/run', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      await loadStatus()
    } catch {}
    setRunning(false)
  }

  const s = status?.summary
  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Content Factory</h1>
          <p className="text-sm text-slate-500 mt-1">Trends → Ideas → Posts → Carousels → Reels → Publish → Analyze → Learn</p>
        </div>
        <button onClick={handleRun} disabled={running}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg hover:from-purple-700 hover:to-pink-600 font-medium text-sm transition-colors disabled:opacity-50 shadow-sm">
          {running ? 'Running...' : 'Run Content Factory'}
        </button>
      </div>

      {result && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 mb-6">
          <p className="text-sm font-semibold text-slate-900 mb-2">Factory Results</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><p className="text-[10px] text-slate-500 uppercase">Ideas</p><p className="text-lg font-bold text-slate-900">{result.ideasGenerated}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Posts</p><p className="text-lg font-bold text-slate-900">{result.postsCreated}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Carousels</p><p className="text-lg font-bold text-slate-900">{result.carouselsCreated}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Reels</p><p className="text-lg font-bold text-slate-900">{result.reelsCreated}</p></div>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {['overview', 'ideas', 'calendar', 'analytics'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && s && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Ideas</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.totalIdeas}</p><p className="text-[9px] text-slate-400">{s.publishedIdeas} published</p></div>
          <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Schedule</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.scheduledPosts || 0}</p><p className="text-[9px] text-slate-400">upcoming posts</p></div>
          <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Views</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.totalViews}</p></div>
          <div className="bg-white rounded-lg border p-4"><p className="text-[10px] text-slate-500 uppercase">Engagement</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.totalEngagement}</p></div>
        </div>
      )}

      {tab === 'ideas' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.ideas?.items?.length ? status.ideas.items.map((idea: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${idea.status === 'published' ? 'bg-emerald-100 text-emerald-700' : idea.status === 'draft' ? 'bg-slate-100 text-slate-500' : 'bg-purple-100 text-purple-700'}`}>{idea.status}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded ${idea.content_type === 'post' ? 'bg-blue-50 text-blue-600' : idea.content_type === 'carousel' ? 'bg-purple-50 text-purple-600' : 'bg-pink-50 text-pink-600'}`}>{idea.content_type}</span>
              <span className="text-xs text-slate-700 flex-1 truncate">{idea.title}</span>
              <span className="text-[9px] text-slate-400">{idea.platform}</span>
              {idea.score && <span className="text-[10px] font-mono text-slate-400">{idea.score}</span>}
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">Run the factory to generate ideas</p>}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.calendar?.items?.length ? status.calendar.items.map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{c.status}</span>
              <span className="text-[10px] text-slate-400">{c.week_start}</span>
              <span className="text-[10px] text-slate-400">Day {c.day_of_week}</span>
              <span className="text-xs text-slate-700 flex-1 truncate">{c.title || c.platform + ' ' + c.content_type}</span>
              <span className="text-[9px] text-slate-400">{c.platform} · {c.content_type}</span>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No calendar entries yet</p>}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="divide-y divide-slate-100 bg-white rounded-lg border">
          {status?.analytics?.items?.length ? status.analytics.items.map((a: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-xs font-medium text-slate-900">{a.platform}</p>
                <p className="text-[9px] text-slate-400">{a.snapshot_date}</p>
              </div>
              <div className="flex gap-4 text-xs text-slate-600">
                <span><strong>{a.views}</strong> views</span>
                <span><strong>{a.likes}</strong> ❤️</span>
                {a.engagement_rate != null && <span><strong>{a.engagement_rate}%</strong> ER</span>}
              </div>
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No analytics yet</p>}
        </div>
      )}
    </div>
  )
}
