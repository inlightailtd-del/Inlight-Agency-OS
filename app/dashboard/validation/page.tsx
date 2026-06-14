'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ValidationResult {
  id: string
  slug: string
  name: string
  category: string
  status: 'working' | 'warning' | 'broken' | 'skipped'
  status_code: number | null
  message: string
  details: Record<string, any>
  duration_ms: number
  checked_at: string
}

interface ValidationRun {
  id: string
  status: string
  total_checks: number
  passed_checks: number
  warning_checks: number
  failed_checks: number
  duration_ms: number
  started_at: string
  completed_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  working: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  broken: 'bg-red-100 text-red-800 border-red-200',
  skipped: 'bg-slate-100 text-slate-500 border-slate-200',
}

const STATUS_BG: Record<string, string> = {
  working: 'bg-emerald-500',
  warning: 'bg-amber-500',
  broken: 'bg-red-500',
  skipped: 'bg-slate-300',
}

const CATEGORY_COLORS: Record<string, string> = {
  integration: 'text-blue-600 bg-blue-50',
  content: 'text-purple-600 bg-purple-50',
  growth: 'text-teal-600 bg-teal-50',
  ai: 'text-indigo-600 bg-indigo-50',
  system: 'text-slate-600 bg-slate-50',
}

export default function ValidationPage() {
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<ValidationRun | null>(null)
  const [results, setResults] = useState<ValidationResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadLatest = useCallback(async () => {
    const res = await fetch('/api/validation/latest').catch(() => null)
    if (!res || !res.ok) return
    const data = await res.json()
    if (data.hasRun) {
      setRun(data.run)
      setResults(data.results || [])
    }
  }, [])

  useEffect(() => {
    loadLatest()
  }, [loadLatest])

  const handleRunAudit = async () => {
    setRunning(true)
    setError(null)
    setRun(null)
    setResults([])

    try {
      const res = await fetch('/api/validation/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Audit failed')
      } else {
        setRun({
          id: data.runId,
          status: data.status,
          total_checks: data.totalChecks,
          passed_checks: data.passedChecks,
          warning_checks: data.warningChecks,
          failed_checks: data.failedChecks,
          duration_ms: data.durationMs,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        setResults(data.results || [])
      }
    } catch (e: any) {
      setError(e.message)
    }
    setRunning(false)
  }

  const passed = results.filter(r => r.status === 'working').length
  const warnings = results.filter(r => r.status === 'warning').length
  const broken = results.filter(r => r.status === 'broken').length
  const skipped = results.filter(r => r.status === 'skipped').length

  const workingPct = results.length > 0 ? Math.round((passed / results.length) * 100) : 0
  const warningPct = results.length > 0 ? Math.round((warnings / results.length) * 100) : 0
  const brokenPct = results.length > 0 ? Math.round((broken / results.length) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Production Audit</h1>
          <p className="text-sm text-slate-500 mt-1">Internal QA — validates every system in Inlight Agency OS</p>
        </div>
        <button
          onClick={handleRunAudit}
          disabled={running}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
        >
          {running ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Running Audit...
            </>
          ) : 'Run Full Audit'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{results.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">checks</p>
          </div>
          <div className="bg-white rounded-lg border border-emerald-200 p-4">
            <p className="text-[10px] text-emerald-600 uppercase font-semibold">Working</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{passed}</p>
            <div className="mt-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${workingPct}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-amber-200 p-4">
            <p className="text-[10px] text-amber-600 uppercase font-semibold">Warning</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{warnings}</p>
            <div className="mt-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${warningPct}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-red-200 p-4">
            <p className="text-[10px] text-red-600 uppercase font-semibold">Broken</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{broken}</p>
            <div className="mt-1 h-1.5 bg-red-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${brokenPct}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Skipped</p>
            <p className="text-2xl font-bold text-slate-500 mt-1">{skipped}</p>
          </div>
        </div>
      )}

      {/* Run Info */}
      {run && (
        <div className="bg-white rounded-lg border border-slate-200 p-3 mb-6 text-xs text-slate-500 flex items-center gap-4">
          <span>Run ID: <code className="text-slate-700 font-mono">{run.id.substring(0, 8)}...</code></span>
          <span>Duration: <strong>{(run.duration_ms / 1000).toFixed(1)}s</strong></span>
          <span>Status: <strong className="text-emerald-600">{run.status}</strong></span>
          {run.completed_at && <span>Completed: {new Date(run.completed_at).toLocaleString()}</span>}
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {results.map((r) => (
              <details key={r.id} className="group">
                <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_BG[r.status]}`} />
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLORS[r.category] || 'text-slate-500 bg-slate-50'}`}>
                    {r.category}
                  </span>
                  <span className="text-sm font-medium text-slate-900 flex-1">{r.name}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status]}`}>
                    {r.status}
                  </span>
                  <span className="text-[10px] text-slate-400">{r.duration_ms}ms</span>
                  <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-5 pb-4 pt-1 border-t border-slate-100">
                  <p className="text-sm text-slate-700 mb-2">{r.message}</p>

                  {/* Status code */}
                  {r.status_code && (
                    <div className="mb-2">
                      <span className="text-[10px] text-slate-400 uppercase">Status Code</span>
                      <p className="text-xs font-mono text-slate-700">{r.status_code}</p>
                    </div>
                  )}

                  {/* Details JSON */}
                  {r.details && Object.keys(r.details).length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] text-slate-400 uppercase">Evidence</span>
                      <pre className="mt-1 text-[10px] font-mono bg-slate-50 rounded border border-slate-200 p-2 overflow-x-auto max-h-40 text-slate-700">
                        {JSON.stringify(r.details, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-[10px] text-slate-400 mt-2">
                    Checked at: {new Date(r.checked_at).toLocaleString()}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      ) : (
        !running && (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">No audit results yet.</p>
            <p className="text-slate-400 text-xs mt-1">Click <strong>Run Full Audit</strong> to validate every system.</p>
          </div>
        )
      )}
    </div>
  )
}
