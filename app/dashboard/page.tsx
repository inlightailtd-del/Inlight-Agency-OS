'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runDailyGrowthAction } from './actions'
import ConnectButton from '@/components/integrations/ConnectButton'

interface ProviderStatus {
  provider: string
  name: string
  connected: boolean
  category: string
}

interface PublishedItem {
  id: string
  title: string
  platform_post_id: string
  status: string
  published_at: string
  platform: string
  media_url?: string
  media_asset_id?: string
  image_count?: number
  carousel_count?: number
  tags?: string[]
}

interface EmailProof {
  id: string
  message: string
  created_at: string
}

interface ExecutionResult {
  contentGenerated: number
  linkedinPublished: number
  emailsSent: number
  leadsGenerated: number
  errors: string[]
  phaseStatus: {
    content: string
    linkedin: string
    email: string
    leads: string
    report: string
  }
  reportSummary?: string
}

const PROVIDER_LABELS: Record<string, { name: string; category: string }> = {
  gmail: { name: 'Gmail', category: 'email' },
  linkedin: { name: 'LinkedIn', category: 'social' },
  apollo: { name: 'Apollo.io', category: 'leads' },
  calendly: { name: 'Calendly', category: 'calendar' },
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [factoryRunning, setFactoryRunning] = useState(false)
  const [factoryResult, setFactoryResult] = useState<any>(null)
  const [publishedItems, setPublishedItems] = useState<PublishedItem[]>([])
  const [emailProof, setEmailProof] = useState<EmailProof | null>(null)
  const supabase = createClient()

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (user) {
      // Check provider connections
      const statuses: ProviderStatus[] = []
      for (const [key, info] of Object.entries(PROVIDER_LABELS)) {
        const res = await fetch(`/api/integrations/test/${key}`).catch(() => null)
        let connected = false
        if (res && res.ok) {
          const data = await res.json()
          connected = data.connected || false
        }
        statuses.push({ provider: key, ...info, connected })
      }
      setProviders(statuses)

      // Fetch published content
      const pubRes = await fetch('/api/integrations/test/published').catch(() => null)
      if (pubRes && pubRes.ok) {
        const pubData = await pubRes.json()
        setPublishedItems(pubData.items || [])
        setEmailProof(pubData.emailProof || null)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [supabase])

  const handleRunCycle = async () => {
    setExecuting(true)
    setResult(null)
    try {
      const res = await runDailyGrowthAction()
      setResult(res)
      // Refresh provider statuses
      await loadData()
    } catch (e: any) {
      setResult({
        contentGenerated: 0,
        linkedinPublished: 0,
        emailsSent: 0,
        leadsGenerated: 0,
        errors: [e.message],
        phaseStatus: { content: 'skipped', linkedin: 'skipped', email: 'skipped', leads: 'skipped', report: 'skipped' },
      })
    }
    setExecuting(false)
  }

  const handleRunFactory = async () => {
    setFactoryRunning(true)
    setFactoryResult(null)
    try {
      const res = await fetch('/api/content-factory/run', { method: 'POST' })
      const data = await res.json()
      setFactoryResult(data)
      // Refresh published items
      const pubRes = await fetch('/api/integrations/test/published').catch(() => null)
      if (pubRes && pubRes.ok) {
        const pubData = await pubRes.json()
        setPublishedItems(pubData.items || [])
        setEmailProof(pubData.emailProof || null)
      }
    } catch (e: any) {
      setFactoryResult({ error: e.message })
    }
    setFactoryRunning(false)
  }

  const connectedCount = providers.filter(p => p.connected).length
  const totalCount = providers.length

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>

  return (
    <div>
      {/* Header + Run Button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}</h1>
          <p className="text-sm text-slate-500 mt-1">Inlight Agency OS — Production Dashboard</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRunCycle}
            disabled={executing}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {executing ? 'Running Daily Cycle...' : 'Run Daily Growth Cycle'}
          </button>
          <button
            onClick={handleRunFactory}
            disabled={factoryRunning}
            className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {factoryRunning ? 'Generating Posts...' : 'Run Content Factory'}
          </button>
        </div>
      </div>

      {/* Execution Result */}
      {result && (
        <div className={`rounded-lg border p-4 mb-6 ${result.errors.filter(e => !e.includes('skipped')).length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-900">Daily Cycle Results</p>
            <span className={`text-xs font-medium ${result.errors.filter(e => !e.includes('skipped')).length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {result.errors.filter(e => !e.includes('skipped')).length > 0 ? 'Completed with warnings' : 'Completed successfully'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-2">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Content</p>
              <p className="text-sm font-bold text-slate-900">{result.contentGenerated} posts</p>
              <p className="text-[9px] text-slate-400">{result.phaseStatus.content === 'ran' ? '✓ Ran' : '— Skipped'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">LinkedIn</p>
              <p className="text-sm font-bold text-slate-900">{result.linkedinPublished} published</p>
              <p className="text-[9px] text-slate-400">{result.phaseStatus.linkedin === 'ran' ? '✓ Published' : '⏸ Not connected'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Email</p>
              <p className="text-sm font-bold text-slate-900">{result.emailsSent} sent</p>
              <p className="text-[9px] text-slate-400">{result.phaseStatus.email === 'ran' ? '✓ Sent' : '⏸ Not connected'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Leads</p>
              <p className="text-sm font-bold text-slate-900">{result.leadsGenerated}</p>
              <p className="text-[9px] text-slate-400">{result.phaseStatus.leads === 'ran' ? '✓ Generated' : '—'}</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="text-xs text-slate-500 mt-2 border-t border-slate-200 pt-2">
              {result.errors.map((e, i) => <p key={i} className="text-amber-700">{e}</p>)}
            </div>
          )}
          {result.reportSummary && (
            <div className="mt-2 text-xs text-slate-600 border-t border-slate-200 pt-2">
              <p className="font-medium text-slate-700 mb-1">CEO Brief:</p>
              <p>{result.reportSummary.substring(0, 300)}</p>
            </div>
          )}
        </div>
      )}

      {/* Content Factory Result */}
      {factoryResult && (
        <div className={`rounded-lg border p-4 mb-6 ${factoryResult.error || factoryResult.totalFailed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-purple-50 border-purple-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-900">Content Factory Results</p>
            <span className={`text-xs font-medium ${factoryResult.error ? 'text-red-600' : 'text-purple-600'}`}>
              {factoryResult.error ? 'Failed' : `${factoryResult.totalPublished}/${factoryResult.totalGenerated} published`}
            </span>
          </div>
          {factoryResult.error ? (
            <p className="text-xs text-red-600">{factoryResult.error}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {factoryResult.posts?.map((post: any, i: number) => (
                <div key={i} className={`p-3 rounded border ${post.status === 'published' ? 'bg-white border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  {post.imageUrl && (
                    <img src={post.imageUrl} alt={post.title} className="w-full aspect-[1.91/1] object-cover rounded mb-2" />
                  )}
                  <p className="text-xs font-medium text-slate-900 line-clamp-1">{post.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${post.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {post.status}
                    </span>
                    <span className="text-[9px] text-slate-400">{post.platform}</span>
                  </div>
                  {post.error && <p className="text-[9px] text-red-500 mt-1">{post.error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Production Readiness + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Production Readiness */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Production Readiness</h2>
          <div className="space-y-3">
            {providers.map(p => (
              <div key={p.provider} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-700">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium ${p.connected ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {p.connected ? 'Connected' : 'Not connected'}
                  </span>
                  {!p.connected && (
                    <a
                      href={`/api/integrations/oauth/authorize?provider=${p.provider}`}
                      className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                    >
                      Connect
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Readiness Score</span>
              <span className={`text-sm font-bold ${connectedCount === totalCount ? 'text-emerald-600' : connectedCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {connectedCount}/{totalCount}
              </span>
            </div>
            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${connectedCount === totalCount ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${(connectedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sm">🤖</span>
                <span className="text-xs text-slate-700">AI Content Generation</span>
              </div>
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">READY</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sm">💼</span>
                <span className="text-xs text-slate-700">LinkedIn Publishing</span>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${providers.find(p => p.provider === 'linkedin')?.connected ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
                {providers.find(p => p.provider === 'linkedin')?.connected ? 'READY' : 'NEEDS OAUTH'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sm">✉️</span>
                <span className="text-xs text-slate-700">Gmail Outreach</span>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${providers.find(p => p.provider === 'gmail')?.connected ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
                {providers.find(p => p.provider === 'gmail')?.connected ? 'READY' : 'NEEDS OAUTH'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎯</span>
                <span className="text-xs text-slate-700">Lead Generation</span>
              </div>
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">READY (AI-powered)</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">📊</span>
                <span className="text-xs text-slate-700">KPI Tracking</span>
              </div>
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">READY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <a href="/dashboard/growth" className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
          <p className="text-sm font-semibold text-slate-900">Growth Engine</p>
          <p className="text-xs text-slate-500 mt-1">Content calendar, publishing queue, lead tracking</p>
        </a>
        <a href="/dashboard/integrations" className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
          <p className="text-sm font-semibold text-slate-900">Integrations</p>
          <p className="text-xs text-slate-500 mt-1">Connect Gmail, LinkedIn, Apollo, and more</p>
        </a>
        <a href="/dashboard/integrations?setup=true" className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
          <p className="text-sm font-semibold text-slate-900">Setup Wizard</p>
          <p className="text-xs text-slate-500 mt-1">Guided setup for Gmail + LinkedIn + Apollo</p>
        </a>
      </div>

      {/* Production Proof */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 mb-8">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Live Production Proof</h2>

        {/* Published Post Cards */}
        {publishedItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {publishedItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
                {item.media_url ? (
                  <img src={item.media_url} alt={item.title} className="w-full aspect-[1.91/1] object-cover bg-slate-100" />
                ) : (
                  <div className="w-full aspect-[1.91/1] bg-slate-100 flex items-center justify-center text-slate-300 text-2xl">📝</div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium text-slate-900 line-clamp-1">{item.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[9px] text-slate-400">{item.platform}</span>
                    <span className="text-[9px] text-slate-400">·</span>
                    <span className={`text-[9px] font-medium ${item.status === 'published' ? 'text-emerald-600' : 'text-slate-400'}`}>{item.status}</span>
                  </div>
                  {item.published_at && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(item.published_at).toLocaleDateString()}</p>}
                  {item.platform_post_id && (
                    <a
                      href={`https://www.linkedin.com/feed/update/${item.platform_post_id.split('/').pop()?.split('%3A').pop()}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-blue-600 hover:text-blue-800 underline mt-1 inline-block"
                    >
                      View on LinkedIn →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gmail Proof */}
        {emailProof && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">✉️</span>
              <span className="text-xs font-semibold text-slate-700">Gmail — Last Sent</span>
            </div>
            <div className="pl-6 py-2 px-3 bg-slate-50 rounded border border-slate-200 inline-block">
              <p className="text-xs text-slate-900">{emailProof.message}</p>
              <p className="text-[10px] text-slate-400 mt-1">Sent: {new Date(emailProof.created_at).toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-200">
          <p className="text-[10px] text-slate-400">All posts published via real API calls. Images generated server-side via sharp, uploaded to Supabase Storage, then published to platform media APIs.</p>
        </div>
      </div>
    </div>
  )
}
