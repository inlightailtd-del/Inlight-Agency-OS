'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface HealthData {
  status: 'healthy' | 'degraded' | 'down'
  timestamp: string
  version: string
  checks: {
    database?: { ok: boolean; error?: string | null }
    environment?: Record<string, boolean>
    apis?: Record<string, boolean>
    durationMs?: number
    [key: string]: any
  }
}

export function HealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((d: HealthData) => {
        setData(d)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        toast.error('Health check failed: ' + e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Running health checks...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <p className="text-sm font-medium text-red-800">System Down</p>
        </div>
        <p className="mt-1 text-xs text-red-600">{error || 'No data returned'}</p>
      </div>
    )
  }

  const envKeys = data.checks.environment ?? {}
  const envPresent = Object.values(envKeys).filter(Boolean).length
  const envTotal = Object.keys(envKeys).length

  const apiKeys = data.checks.apis ?? {}
  const apiPresent = Object.values(apiKeys).filter(Boolean).length
  const apiTotal = Object.keys(apiKeys).length

  const statusVariant = data.status === 'healthy' ? 'success' : data.status === 'degraded' ? 'warning' : 'destructive'
  const statusColor = data.status === 'healthy' ? 'bg-emerald-500' : data.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={cn('h-3 w-3 rounded-full', statusColor)} />
            <div>
              <p className="text-lg font-semibold text-slate-900 capitalize">{data.status}</p>
              <p className="text-xs text-slate-500">
                {new Date(data.timestamp).toLocaleString()} &middot; v{data.version}
              </p>
            </div>
          </div>
          <Badge variant={statusVariant}>{data.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Database */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Database</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                data.checks.database?.ok ? 'bg-emerald-500' : 'bg-red-500'
              )}
            />
            <p className="text-sm font-medium text-slate-900">
              {data.checks.database?.ok ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          {data.checks.database?.error && (
            <p className="mt-1 text-xs text-red-600">{data.checks.database.error}</p>
          )}
        </div>

        {/* Environment Variables */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Environment</p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {envPresent} / {envTotal} present
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                envPresent === envTotal ? 'bg-emerald-500' : 'bg-amber-500'
              )}
              style={{ width: `${(envPresent / envTotal) * 100}%` }}
            />
          </div>
        </div>

        {/* Connected APIs */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Connected APIs</p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {apiPresent} / {apiTotal} connected
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                apiPresent > 0 ? 'bg-emerald-500' : 'bg-slate-300'
              )}
              style={{ width: `${(apiPresent / apiTotal) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Response Time */}
      {data.checks.durationMs != null && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Response Time</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{data.checks.durationMs}ms</p>
        </div>
      )}
    </div>
  )
}
