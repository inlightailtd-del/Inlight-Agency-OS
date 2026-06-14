'use client'

import { useState } from 'react'

interface ConnectButtonProps {
  provider: string
  providerName: string
  authType: 'oauth' | 'api_key'
  isConnected: boolean
  connectionId?: string | null
  onDisconnect?: (connectionId: string) => void
  onConnect?: () => void
}

export default function ConnectButton({ provider, providerName, authType, isConnected, connectionId, onDisconnect, onConnect }: ConnectButtonProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleConnect = async () => {
    if (authType === 'oauth') {
      window.location.href = `/api/integrations/oauth/authorize?provider=${provider}`
    } else {
      onConnect?.()
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/integrations/test/${provider}`)
      const data = await res.json()
      if (data.connected && data.testResult?.success) {
        setTestResult({ success: true, message: 'Connection working' })
      } else if (data.connected) {
        setTestResult({ success: true, message: `Connected (${(data.durationMs || 0).toFixed(0)}ms)` })
      } else {
        setTestResult({ success: false, message: data.error || 'Not connected' })
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message })
    }
    setTesting(false)
  }

  const handleDisconnect = () => {
    if (connectionId && onDisconnect) {
      onDisconnect(connectionId)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {!isConnected ? (
        <button
          onClick={handleConnect}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {authType === 'oauth' ? 'Connect OAuth' : 'Add API Key'}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-600 font-medium">Connected</span>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={handleDisconnect}
            className="px-2 py-1 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
      {testResult && (
        <span className={`text-xs ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
          {testResult.message}
        </span>
      )}
    </div>
  )
}
