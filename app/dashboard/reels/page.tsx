'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_COLORS: Record<string, string> = {
  working: 'bg-emerald-500', warning: 'bg-amber-500', broken: 'bg-red-500',
  skipped: 'bg-slate-300', running: 'bg-blue-500',
}

interface FactoryStatus {
  trends: { count: number; items: any[] }
  hooks: { count: number; items: any[] }
  scripts: { count: number; items: any[] }
  videos: { count: number; items: any[] }
  analytics: { count: number; items: any[] }
  config: any
  summary: {
    totalTrends: number; totalHooks: number; totalScripts: number
    totalVideos: number; totalAnalytics: number
    totalViews: number; totalEngagement: number
    publishedVideos: number; readyVideos: number; renderingVideos: number
  }
}

export default function ReelsFactoryPage() {
  const [status, setStatus] = useState<FactoryStatus | null>(null)
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/reels/status').catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setStatus(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleRunCycle = async () => {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/reels/run', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      await loadStatus()
    } catch (e: any) {
      setError(e.message)
    }
    setRunning(false)
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>

  const s = status?.summary

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reels Factory</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous reel creation — trends → production → analytics → optimization</p>
        </div>
        <button
          onClick={handleRunCycle}
          disabled={running}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
        >
          {running ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Running...
            </>
          ) : 'Run Full Cycle'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6"><p className="text-sm text-red-700">{error}</p></div>}

      {/* Summary Cards */}
      {s && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Trends</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{s.totalTrends}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Scripts</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{s.totalScripts}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Videos</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{s.totalVideos}</p>
            <p className="text-[9px] text-slate-400">{s.publishedVideos} pub · {s.readyVideos} ready</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Analytics</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{s.totalViews}</p>
            <p className="text-[9px] text-slate-400">{s.totalEngagement} engagements</p>
          </div>
        </div>
      )}

      {/* Run Result */}
      {result && (
        <div className={`rounded-lg border p-4 mb-6 ${result.errors?.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-purple-50 border-purple-200'}`}>
          <p className="text-sm font-semibold text-slate-900 mb-2">Cycle Results</p>
          <div className="grid grid-cols-4 gap-3 mb-2">
            <div><p className="text-[10px] text-slate-500 uppercase">Trends</p><p className="text-sm font-bold text-slate-900">{result.trendsScanned || 0}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Hooks</p><p className="text-sm font-bold text-slate-900">{result.hooksGenerated || 0}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Scripts</p><p className="text-sm font-bold text-slate-900">{result.scriptsCreated || 0}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase">Published</p><p className="text-sm font-bold text-slate-900">{result.videosPublished || 0}</p></div>
          </div>
          {result.errors?.length > 0 && (
            <div className="text-xs text-red-600 mt-2 border-t border-amber-200 pt-2">{result.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}</div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {['overview', 'trends', 'hooks', 'scripts', 'videos', 'analytics'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && status?.config && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Factory Config</h3>
          <pre className="text-xs font-mono bg-slate-50 rounded p-3 text-slate-700 max-h-60 overflow-auto">{JSON.stringify(status.config, null, 2)}</pre>
        </div>
      )}

      {tab === 'trends' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {status?.trends?.items?.length ? status.trends.items.map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xs font-mono text-slate-400 w-6">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.keyword}</p>
                  <p className="text-[10px] text-slate-400">{t.source} · {t.momentum}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${t.score}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-8 text-right">{t.score}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${t.velocity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {t.velocity > 0 ? '+' : ''}{t.velocity?.toFixed(1)}
                </span>
              </div>
            )) : <p className="text-sm text-slate-400 p-5 text-center">No trends yet. Run a cycle.</p>}
          </div>
        </div>
      )}

      {tab === 'hooks' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {status?.hooks?.items?.length ? status.hooks.items.map((h: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${h.hook_type === 'curiosity' ? 'bg-blue-100 text-blue-700' : h.hook_type === 'authority' ? 'bg-purple-100 text-purple-700' : h.hook_type === 'problem' ? 'bg-amber-100 text-amber-700' : h.hook_type === 'story' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {h.hook_type}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-900">{h.hook_text}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-slate-400">Score: {h.score}</span>
                      {h.win_rate != null && <span className="text-[10px] text-slate-400">Win: {h.win_rate}%</span>}
                    </div>
                  </div>
                  <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden self-center">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${h.score}%` }} />
                  </div>
                </div>
              </div>
            )) : <p className="text-sm text-slate-400 p-5 text-center">No hooks yet. Run a cycle.</p>}
          </div>
        </div>
      )}

      {tab === 'scripts' && (
        <div className="grid gap-3">
          {status?.scripts?.items?.length ? status.scripts.items.map((s: any, i: number) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.title}</p>
                  <p className="text-[10px] text-slate-400">{s.topic} · {s.duration_seconds}s · {s.tone}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === 'published' ? 'bg-emerald-100 text-emerald-700' : s.status === 'produced' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                  {s.status}
                </span>
              </div>
              {s.hook_score && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${s.hook_score}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Score: {s.hook_score}</span>
                </div>
              )}
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No scripts yet. Run a cycle.</p>}
        </div>
      )}

      {tab === 'videos' && (
        <div className="grid gap-3">
          {status?.videos?.items?.length ? status.videos.items.map((v: any, i: number) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{v.title}</p>
                  <p className="text-[10px] text-slate-400">{v.duration_seconds}s · {new Date(v.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.status === 'published' ? 'bg-emerald-100 text-emerald-700' : v.status === 'ready' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {v.status}
                </span>
              </div>
              {v.platform_status && Object.keys(v.platform_status).length > 0 && (
                <div className="flex gap-2 mt-2">
                  {Object.entries(v.platform_status as Record<string, string>).map(([platform, ps]) => (
                    <span key={platform} className={`text-[9px] px-1.5 py-0.5 rounded ${ps === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                      {platform}: {ps}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )) : <p className="text-sm text-slate-400 p-5 text-center">No videos yet. Run a cycle.</p>}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {status?.analytics?.items?.length ? status.analytics.items.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-xs font-medium text-slate-900">{a.platform}</p>
                  <p className="text-[9px] text-slate-400">{a.snapshot_date}</p>
                </div>
                <div className="flex gap-4">
                  <span className="text-xs text-slate-600"><strong>{a.views}</strong> views</span>
                  <span className="text-xs text-slate-600"><strong>{a.likes}</strong> ❤️</span>
                  <span className="text-xs text-slate-600"><strong>{a.comments}</strong> 💬</span>
                  <span className="text-xs text-slate-600"><strong>{a.shares}</strong> 🔄</span>
                  {a.engagement_rate != null && <span className="text-xs text-slate-600">{a.engagement_rate}% ER</span>}
                </div>
              </div>
            )) : <p className="text-sm text-slate-400 p-5 text-center">No analytics yet. Publish a video first.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
