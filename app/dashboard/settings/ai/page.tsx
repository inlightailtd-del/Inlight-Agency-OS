import Link from 'next/link'; import { redirect } from 'next/navigation'; import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input'; import { Select } from '@/components/ui/select'

const providers = [
  { value: 'ollama', label: 'Ollama (Local)', defaultUrl: 'http://localhost:11434', defaultModel: 'llama3.1' },
  { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'anthropic', label: 'Anthropic', defaultUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514' },
  { value: 'groq', label: 'Groq', defaultUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama3-70b-8192' },
]

async function saveConfig(fd: FormData) {
  'use server'
  const raw = Object.fromEntries(Array.from(fd.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const s = await createClient(); const { data: { user } } = await s.auth.getUser(); if (!user?.id) throw new Error('Not authenticated')
  await s.from('ai_provider_configs').delete().eq('user_id', user.id).eq('is_active', true)
  const { error } = await s.from('ai_provider_configs').insert([{ user_id: user.id, provider: raw.provider, model: raw.model, api_url: raw.api_url, api_key: raw.api_key || null, is_active: true }])
  if (error) throw error
  revalidatePath('/dashboard/settings/ai'); redirect('/dashboard/settings/ai')
}

export default async function AISettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let config: any = null
  if (user?.id) { const { data } = await supabase.from('ai_provider_configs').select('*').eq('user_id', user.id).eq('is_active', true).limit(1).single(); config = data }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">AI Provider Settings</h1><p className="text-sm text-slate-500 mt-1">Configure your AI model provider for agents, content generation, and analysis.</p></div>
        <Link href="/dashboard" className="text-slate-700 hover:text-slate-900">Back</Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={saveConfig} className="grid gap-6">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="provider">Provider</label>
            <Select id="provider" name="provider" defaultValue={config?.provider || 'ollama'}>{providers.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}</Select>
            <p className="text-xs text-slate-400 mt-1">Ollama runs locally. OpenAI, Anthropic, and Groq require API keys.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="model">Model</label>
            <Input id="model" name="model" defaultValue={config?.model || 'llama3.1'} placeholder="llama3.1 / gpt-4o / claude-sonnet-4-20250514" />
            <p className="text-xs text-slate-400 mt-1">Model name must be compatible with the selected provider.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="api_url">API URL</label>
            <Input id="api_url" name="api_url" defaultValue={config?.api_url || 'http://localhost:11434'} placeholder="http://localhost:11434" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="api_key">API Key</label>
            <Input id="api_key" name="api_key" type="password" defaultValue={config?.api_key || ''} placeholder="Required for OpenAI, Anthropic, Groq. Not needed for Ollama." />
          </div>
          <div className="flex justify-end pt-2"><Button type="submit">Save Configuration</Button></div>
        </form>
      </div>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent AI Executions</h2>
        <RecentExecutions userId={user?.id} />
      </div>
    </div>
  )
}

async function RecentExecutions({ userId }: { userId?: string }) {
  if (!userId) return <p className="text-sm text-slate-500">No executions yet.</p>
  const supabase = await createClient()
  const { data } = await supabase.from('agent_executions').select('id, model, provider, status, tokens_used, duration_ms, created_at').order('created_at', { ascending: false }).limit(10)
  if (!data || data.length === 0) return <p className="text-sm text-slate-500">No executions yet.</p>
  return (
    <div className="space-y-2">
      {data.map((e) => (
        <div key={e.id} className={`flex items-center justify-between rounded-lg border p-3 text-sm ${e.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : e.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-600">{e.provider}/{e.model}</span>
            <span className={`text-xs font-medium ${e.status === 'completed' ? 'text-emerald-600' : e.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{e.status}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {e.tokens_used > 0 && <span>{e.tokens_used} tokens</span>}
            {e.duration_ms > 0 && <span>{e.duration_ms}ms</span>}
          </div>
        </div>
      ))}
    </div>
  )
}