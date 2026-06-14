'use client'

import { useState } from 'react'

interface SetupWizardProps {
  onComplete?: () => void
  isFirstRun?: boolean
}

const STEPS = [
  {
    id: 'gmail',
    title: 'Connect Gmail',
    description: 'Enable email sending for outreach campaigns',
    provider: 'gmail',
    authType: 'oauth' as const,
    icon: '✉️',
  },
  {
    id: 'linkedin',
    title: 'Connect LinkedIn',
    description: 'Enable content publishing to LinkedIn',
    provider: 'linkedin',
    authType: 'oauth' as const,
    icon: '💼',
  },
  {
    id: 'apollo',
    title: 'Add Apollo API Key',
    description: 'Enable real lead data import',
    provider: 'apollo',
    authType: 'api_key' as const,
    icon: '🎯',
  },
]

export default function SetupWizard({ onComplete, isFirstRun }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [connectedProviders, setConnectedProviders] = useState<string[]>([])
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const handleOAuthConnect = async (provider: string) => {
    window.location.href = `/api/integrations/oauth/authorize?provider=${provider}`
  }

  const handleApiKeyConnect = async (provider: string, key: string) => {
    setTesting(true)
    try {
      const res = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      })
      const data = await res.json()
      if (data.success) {
        setConnectedProviders([...connectedProviders, provider])
        setTestResults({
          ...testResults,
          [provider]: { success: true, message: 'Connected successfully' },
        })
      } else {
        setTestResults({
          ...testResults,
          [provider]: { success: false, message: data.error || 'Failed to connect' },
        })
      }
    } catch (e: any) {
      setTestResults({
        ...testResults,
        [provider]: { success: false, message: e.message },
      })
    }
    setTesting(false)
  }

  const step = STEPS[currentStep]
  if (!step) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🎉</div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Setup Complete!</h3>
        <p className="text-sm text-slate-600 mb-4">Your integrations are configured. You can now run growth cycles.</p>
        {onComplete && (
          <button onClick={onComplete} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            Go to Dashboard
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {isFirstRun && (
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Welcome to Inlight Agency OS</h2>
          <p className="text-sm text-slate-600">Let&apos;s connect your first services to get started.</p>
        </div>
      )}

      {/* Progress */}
      <div className="flex justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i === currentStep ? 'bg-blue-600 text-white' : i < currentStep ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {i < currentStep ? '✓' : i + 1}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="text-3xl mb-3">{step.icon}</div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">{step.title}</h3>
        <p className="text-sm text-slate-600 mb-4">{step.description}</p>

        {step.authType === 'oauth' ? (
          <button
            onClick={() => handleOAuthConnect(step.provider)}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Connect with {step.provider === 'gmail' ? 'Google' : step.provider === 'linkedin' ? 'LinkedIn' : step.provider}
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              placeholder={`Enter ${step.provider.charAt(0).toUpperCase() + step.provider.slice(1)} API Key`}
              value={apiKeys[step.provider] || ''}
              onChange={(e) => setApiKeys({ ...apiKeys, [step.provider]: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleApiKeyConnect(step.provider, apiKeys[step.provider] || '')}
              disabled={!apiKeys[step.provider] || testing}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {testing ? 'Connecting...' : 'Save & Connect'}
            </button>
          </div>
        )}

        {testResults[step.provider] && (
          <p className={`mt-3 text-xs ${testResults[step.provider].success ? 'text-green-600' : 'text-red-600'}`}>
            {testResults[step.provider].message}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={() => setCurrentStep(currentStep + 1)}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {currentStep < STEPS.length - 1 ? 'Skip' : 'Finish'}
        </button>
      </div>
    </div>
  )
}
