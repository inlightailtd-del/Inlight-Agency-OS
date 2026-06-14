import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { IntegrationSDK } from '@/lib/integrations/sdk'
import IntegrationClient from '@/components/integrations/IntegrationClient'
import SetupWizard from '@/components/integrations/SetupWizard'
import FacebookPageSelector from '@/components/integrations/FacebookPageSelector'

const PROVIDER_CATEGORIES: Record<string, { name: string; color: string }> = {
  email: { name: 'Email', color: 'bg-blue-100 text-blue-800' },
  social: { name: 'Social', color: 'bg-purple-100 text-purple-800' },
  crm: { name: 'CRM', color: 'bg-emerald-100 text-emerald-800' },
  calendar: { name: 'Calendar', color: 'bg-amber-100 text-amber-800' },
  payment: { name: 'Payment', color: 'bg-cyan-100 text-cyan-800' },
  voice: { name: 'Voice', color: 'bg-rose-100 text-rose-800' },
  data: { name: 'Data', color: 'bg-indigo-100 text-indigo-800' },
  ai: { name: 'AI', color: 'bg-violet-100 text-violet-800' },
  video: { name: 'Video', color: 'bg-red-100 text-red-800' },
}

const PROVIDER_INFO: Record<string, { name: string; category: string; authType: string }> = {
  gmail: { name: 'Gmail', category: 'email', authType: 'OAuth 2.0' },
  outlook: { name: 'Outlook', category: 'email', authType: 'OAuth 2.0' },
  linkedin: { name: 'LinkedIn', category: 'social', authType: 'OAuth 2.0' },
  apollo: { name: 'Apollo.io', category: 'data', authType: 'API Key' },
  clay: { name: 'Clay', category: 'data', authType: 'API Key' },
  instantly: { name: 'Instantly', category: 'email', authType: 'API Key' },
  smartlead: { name: 'Smartlead', category: 'email', authType: 'API Key' },
  calendly: { name: 'Calendly', category: 'calendar', authType: 'OAuth 2.0' },
  hubspot: { name: 'HubSpot', category: 'crm', authType: 'OAuth 2.0' },
  stripe: { name: 'Stripe', category: 'payment', authType: 'API Key' },
  twilio: { name: 'Twilio', category: 'voice', authType: 'API Key' },
  vapi: { name: 'Vapi', category: 'voice', authType: 'API Key' },
  bland_ai: { name: 'Bland AI', category: 'voice', authType: 'API Key' },
  retell_ai: { name: 'Retell AI', category: 'voice', authType: 'API Key' },
  elevenlabs: { name: 'ElevenLabs', category: 'ai', authType: 'API Key' },
  openai_realtime: { name: 'OpenAI Realtime', category: 'ai', authType: 'API Key' },
  facebook: { name: 'Facebook', category: 'social', authType: 'OAuth 2.0' },
  instagram: { name: 'Instagram', category: 'social', authType: 'OAuth 2.0' },
  x: { name: 'X / Twitter', category: 'social', authType: 'OAuth 2.0' },
  youtube: { name: 'YouTube', category: 'video', authType: 'OAuth 2.0' },
}

const ALL_PROVIDERS = Object.entries(PROVIDER_INFO)

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { setup?: string; connected?: string; error?: string; connect?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return <div>Not authenticated</div>

  // Check if setup wizard was requested or this is first run (no connections)
  const sdk = new IntegrationSDK(supabase, user.id)
  const [connections, healthLogs] = await Promise.all([
    sdk.getConnections().catch(() => []),
    sdk.getHealthLogs(20).catch(() => []),
  ])

  const isFirstRun = searchParams.setup === 'true' || (connections.length === 0 && !searchParams.error && !searchParams.connected)
  const connectedProvider = searchParams.connected || null
  const errorMsg = searchParams.error || null
  const connectApiKey = searchParams.connect || null

  // Stats
  const totalConnected = connections.length
  const totalErrors = healthLogs.filter((l: any) => l.status === 'error').length
  const totalOk = healthLogs.filter((l: any) => l.status === 'success').length

  // If this is first run and no connections, show setup wizard
  if (isFirstRun && connections.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <SetupWizard isFirstRun={true} onComplete={() => {}} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500 mt-1">Real-world execution layer — connect services to enable production execution.</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/dashboard/integrations?setup=true"
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Setup Wizard
          </a>
        </div>
      </div>

      {/* Status messages */}
      {connectedProvider && (
        <div className="mb-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-700">
          Successfully connected to {PROVIDER_INFO[connectedProvider]?.name || connectedProvider}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Connection error: {errorMsg}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Connected" value={totalConnected} color="text-emerald-600" />
        <StatCard title="Available" value={ALL_PROVIDERS.length} />
        <StatCard title="Successful Ops" value={totalOk} color="text-indigo-600" />
        <StatCard title="Failed Ops" value={totalErrors} color={totalErrors > 0 ? 'text-red-600' : 'text-slate-500'} />
      </div>

      {/* Interactive Provider Grid */}
      <IntegrationClient
        initialConnections={connections}
        initialHealthLogs={healthLogs}
        providerInfo={PROVIDER_INFO}
        providerCategories={PROVIDER_CATEGORIES}
        allProviders={ALL_PROVIDERS}
      />

      {/* Facebook Page Management */}
      {(() => {
        const fbConn = connections.find((c: any) => c.provider === 'facebook')
        return fbConn ? (
          <div className="mb-6">
            <FacebookPageSelector connection={fbConn} />
          </div>
        ) : null
      })()}

      {/* Active Connections */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Active Connections</h2>
        </div>
        {connections.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">No connections configured yet. Use the Setup Wizard or connect above.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {connections.map((conn: any) => {
              const info = PROVIDER_INFO[conn.provider] || { name: conn.provider, category: 'other', authType: '—' }
              return (
                <div key={conn.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{info.name}</p>
                    <p className="text-xs text-slate-400">Status: {conn.status} · Requests: {conn.total_requests || 0} · Success: {conn.successful_requests || 0} · Failed: {conn.failed_requests || 0}</p>
                  </div>
                  <Badge className={`text-[9px] ${conn.status === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{conn.status}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Health Logs */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Provider</th>
                <th className="text-left px-3 py-2">Event</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Duration</th>
                <th className="text-left px-3 py-2">Message</th>
                <th className="text-left px-3 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {healthLogs.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-xs">No activity yet.</td></tr>
              ) : healthLogs.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs font-medium text-slate-900">{log.provider}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{log.event}</td>
                  <td className="px-3 py-2"><Badge className={`text-[8px] ${log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : log.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>{log.status}</Badge></td>
                  <td className="px-3 py-2 text-xs text-slate-500">{log.duration_ms}ms</td>
                  <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px] truncate">{log.message || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
