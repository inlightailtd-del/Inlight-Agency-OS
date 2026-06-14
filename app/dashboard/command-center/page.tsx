'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { submitCommandAction } from './actions'
import { submitCommandBackgroundAction } from './actions'
import { Send, Zap, History, Activity, Brain, BarChart3, Loader2, ListOrdered } from 'lucide-react'

const suggestionCommands = [
  'Generate 30 social media posts',
  'Create SEO strategy',
  'Build client proposal',
  'Run lead generation',
  'Analyze project health',
  'Generate content calendar',
  'Send follow-up emails to all active clients',
  'Create financial report for this month',
  'Analyze overdue tasks',
  'Summarize recent agent activity',
]

export default function CommandCenterPage() {
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [recentCommands, setRecentCommands] = useState<any[]>([])
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [cmds, logs] = await Promise.all([
      supabase.from('commands').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('execution_logs').select('*').order('created_at', { ascending: false }).limit(10),
    ])
    setRecentCommands(cmds.data ?? [])
    setRecentLogs(logs.data ?? [])
    setStats({
      totalCommands: (cmds.data ?? []).length,
      activeAgents: 0,
      activeAutomations: 0,
      successRate: '—',
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!command.trim() || loading) return
    setLoading(true)
    setResult(null)

    const trimmed = command.trim()
    const cat = detectCategory(trimmed)

    try {
      const res = await submitCommandAction(trimmed, cat)
      setResult(res.response || 'No response generated.')
    } catch (err: any) {
      setResult(`Error: ${err.message}`)
    }

    setCommand('')
    setLoading(false)
    loadData()
    inputRef.current?.focus()
  }

  async function handleBackgroundSubmit() {
    if (!command.trim() || loading) return
    setLoading(true)
    setResult(null)

    const trimmed = command.trim()
    const cat = detectCategory(trimmed)

    try {
      const res = await submitCommandBackgroundAction(trimmed, cat)
      setResult(`⏳ ${res.message}\n\nJob ID: ${res.jobId}\n\nTrack progress in the Queue dashboard.`)
    } catch (err: any) {
      setResult(`Error: ${err.message}`)
    }

    setCommand('')
    setLoading(false)
    inputRef.current?.focus()
  }

  function detectCategory(cmd: string): string {
    const lower = cmd.toLowerCase()
    if (lower.includes('post') || lower.includes('content') || lower.includes('calendar') || lower.includes('caption')) return 'content'
    if (lower.includes('research') || lower.includes('analyze') || lower.includes('report')) return 'analysis'
    if (lower.includes('seo') || lower.includes('keyword') || lower.includes('rank')) return 'seo'
    if (lower.includes('sales') || lower.includes('proposal') || lower.includes('lead') || lower.includes('client')) return 'sales'
    if (lower.includes('operation') || lower.includes('task') || lower.includes('workflow')) return 'operations'
    return 'general'
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">Natural language command interface to control all AI systems across the agency.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/command-center/history"><Button variant="outline"><History className="w-4 h-4 mr-2" />History</Button></Link>
          <Link href="/dashboard/command-center/executions"><Button variant="outline"><Activity className="w-4 h-4 mr-2" />Logs</Button></Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Commands</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalCommands || '—'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Agents</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.activeAgents ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Automations</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.activeAutomations ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Success Rate</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.successRate ?? '—'}</p>
        </div>
      </div>

      {/* Command Input */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Type a command... e.g., Generate 30 social media posts"
                className="w-full pl-11 pr-4 py-4 text-lg rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition"
                disabled={loading}
              />
            </div>
            <Button type="submit" size="lg" disabled={loading || !command.trim()} className="px-6">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span className="ml-2 hidden sm:inline">Execute</span>
            </Button>
            <Button type="button" size="lg" variant="outline" disabled={loading || !command.trim()} onClick={handleBackgroundSubmit} className="px-4">
              <ListOrdered className="w-5 h-5" />
              <span className="ml-2 hidden sm:inline">Background</span>
            </Button>
          </div>
        </form>

        {/* Suggestions */}
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestionCommands.map((s) => (
              <button
                key={s}
                onClick={() => { setCommand(s); inputRef.current?.focus() }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-white transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm mb-6">
          <p className="text-sm font-medium text-emerald-800 mb-1">✓ Result</p>
          <pre className="text-sm text-emerald-700 whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Commands */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Commands</h2>
            <Link href="/dashboard/command-center/history" className="text-xs text-slate-500 hover:text-slate-700">View all</Link>
          </div>
          {recentCommands.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No commands executed yet.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentCommands.map((cmd: any) => (
                <div key={cmd.id} className={`rounded-lg border p-3 ${cmd.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : cmd.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900 text-sm">{cmd.command}</p>
                    <Badge variant={cmd.status === 'completed' ? 'success' : cmd.status === 'failed' ? 'destructive' : 'default'}>{cmd.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    {cmd.category && <span className="capitalize">{cmd.category}</span>}
                    <span>{formatDateTime(cmd.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Execution Logs */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Execution Logs</h2>
            <Link href="/dashboard/command-center/executions" className="text-xs text-slate-500 hover:text-slate-700">View all</Link>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No execution logs yet.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentLogs.map((log: any) => (
                <div key={log.id} className={`rounded-lg border p-3 ${log.status === 'success' ? 'border-emerald-200 bg-emerald-50/50' : log.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900 text-sm">{log.action}</p>
                    <Badge variant={log.status === 'success' ? 'success' : log.status === 'failed' ? 'destructive' : 'warning'}>{log.status}</Badge>
                  </div>
                  {log.message && <p className="text-xs text-slate-500 mt-1">{log.message}</p>}
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    {log.module && <span>{log.module}</span>}
                    <span>{formatDateTime(log.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
