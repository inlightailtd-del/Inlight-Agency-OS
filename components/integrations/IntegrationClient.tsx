'use client'

import { useState, useCallback } from 'react'
import ConnectButton from './ConnectButton'

interface IntegrationClientProps {
  initialConnections: any[]
  initialHealthLogs: any[]
  providerInfo: Record<string, { name: string; category: string; authType: string }>
  providerCategories: Record<string, { name: string; color: string }>
  allProviders: [string, { name: string; category: string; authType: string }][]
}

export default function IntegrationClient({ initialConnections, initialHealthLogs, providerInfo, providerCategories, allProviders }: IntegrationClientProps) {
  const [connections, setConnections] = useState(initialConnections)
  const [healthLogs, setHealthLogs] = useState(initialHealthLogs)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const connectedProviders = new Set(connections.map((c: any) => c.provider))

  const handleDisconnect = useCallback(async (connectionId: string, provider: string) => {
    try {
      const res = await fetch(`/api/integrations/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (res.ok) {
        setConnections(prev => prev.filter((c: any) => c.id !== connectionId))
        setStatusMsg(`Disconnected ${provider}`)
        setTimeout(() => setStatusMsg(null), 3000)
      }
    } catch {}
  }, [])

  const refreshTest = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/refresh/connections')
      if (res.ok) {
        const data = await res.json()
        setConnections(data.connections || [])
        setHealthLogs(data.healthLogs || [])
      }
    } catch {}
  }, [])

  return (
    <div>
      {statusMsg && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          {statusMsg}
        </div>
      )}

      {/* Provider Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {allProviders.map(([key, info]) => {
          const connected = connectedProviders.has(key)
          const conn = connections.find((c: any) => c.provider === key)
          const catInfo = providerCategories[info.category] || { name: info.category, color: 'bg-slate-100 text-slate-800' }
          const stats = conn
            ? { total: conn.total_requests || 0, success: conn.successful_requests || 0, failed: conn.failed_requests || 0 }
            : { total: 0, success: 0, failed: 0 }

          return (
            <div key={key} className={`rounded-lg border p-4 shadow-sm ${connected ? 'bg-white border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catInfo.color}`}>{catInfo.name}</span>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </div>
              <p className="font-semibold text-sm text-slate-900">{info.name}</p>
              <p className="text-[10px] text-slate-400 mt-1">{info.authType}</p>
              {connected && stats.total > 0 && (
                <p className="text-[9px] text-slate-400 mt-1">OK: {stats.success} · Fail: {stats.failed}</p>
              )}
              <div className="mt-2">
                <ConnectButton
                  provider={key}
                  providerName={info.name}
                  authType={info.authType === 'OAuth 2.0' ? 'oauth' : 'api_key'}
                  isConnected={connected}
                  connectionId={conn?.id || null}
                  onDisconnect={(cid) => handleDisconnect(cid, info.name)}
                  onConnect={() => {
                    if (info.authType !== 'OAuth 2.0') {
                      window.location.href = `/dashboard/integrations?connect=${key}`
                    }
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
