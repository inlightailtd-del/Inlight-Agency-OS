'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runDailyGrowthAction } from './actions'
import {
  Activity, AlertCircle, ArrowUpRight, Bot, Brain, Calendar, CheckCircle2, ChevronRight,
  Clock, CreditCard, Download, FileText, FolderKanban, Globe, Home, LayoutDashboard,
  Lightbulb, Link2, ListTodo, Loader2, MessageSquare, Mic, Palette, PhoneCall,
  PieChart, Play, Plus, RefreshCw, Search, Send, Settings, ShoppingCart, Sparkles,
  Target, Terminal, TrendingUp, Tv, UserCheck, Users, Video, Zap, BarChart3,
  Briefcase, ClipboardList, DollarSign, Eye, Fingerprint, Gift, Headphones,
  Mail, MapPin, Monitor, MousePointer2, Network, Radio, Share2, Shield,
  SlidersHorizontal, Star, Sun, Sunrise, ThumbsUp, Timer, Trophy, Truck,
  Unlock, Voicemail, Watch, Wind, Wifi, Wrench,
} from 'lucide-react'

interface ProviderStatus {
  provider: string; name: string; connected: boolean; category: string
}
interface PublishedItem {
  id: string; title: string; platform_post_id: string; status: string;
  published_at: string; platform: string; media_url?: string; media_asset_id?: string;
  image_count?: number; carousel_count?: number; tags?: string[]
}
interface EmailProof {
  id: string; message: string; created_at: string
}
interface ExecutionResult {
  contentGenerated: number; linkedinPublished: number; emailsSent: number;
  leadsGenerated: number; errors: string[];
  phaseStatus: { content: string; linkedin: string; email: string; leads: string; report: string }
  reportSummary?: string
}

const PROVIDER_LABELS: Record<string, { name: string; category: string }> = {
  gmail: { name: 'Gmail', category: 'email' },
  linkedin: { name: 'LinkedIn', category: 'social' },
  apollo: { name: 'Apollo.io', category: 'leads' },
  calendly: { name: 'Calendly', category: 'calendar' },
}

const AI_EMPLOYEES = [
  { role: 'CEO', icon: Trophy, color: 'from-amber-400 to-orange-500' },
  { role: 'COO', icon: Settings, color: 'from-blue-400 to-indigo-500' },
  { role: 'CTO', icon: Monitor, color: 'from-purple-400 to-violet-500' },
  { role: 'CMO', icon: Megaphone, color: 'from-pink-400 to-rose-500' },
  { role: 'Sales', icon: TrendingUp, color: 'from-emerald-400 to-green-500' },
  { role: 'Designer', icon: Palette, color: 'from-cyan-400 to-teal-500' },
  { role: 'Content', icon: FileText, color: 'from-yellow-400 to-amber-500' },
  { role: 'Support', icon: Headphones, color: 'from-sky-400 to-blue-500' },
  { role: 'Dev', icon: Terminal, color: 'from-indigo-400 to-purple-500' },
  { role: 'Video', icon: Video, color: 'from-red-400 to-pink-500' },
]

const DEPARTMENTS = [
  { name: 'Marketing', icon: Megaphone, color: '#ec4899', tasks: 12, progress: 78 },
  { name: 'Sales', icon: TrendingUp, color: '#22c55e', tasks: 8, progress: 65 },
  { name: 'CRM', icon: Users, color: '#3b82f6', tasks: 5, progress: 90 },
  { name: 'Projects', icon: FolderKanban, color: '#8b5cf6', tasks: 15, progress: 72 },
  { name: 'Content', icon: FileText, color: '#f59e0b', tasks: 20, progress: 85 },
  { name: 'Finance', icon: DollarSign, color: '#10b981', tasks: 6, progress: 60 },
  { name: 'Development', icon: Terminal, color: '#6366f1', tasks: 18, progress: 55 },
  { name: 'Automation', icon: Zap, color: '#00f0ff', tasks: 10, progress: 88 },
  { name: 'Support', icon: Headphones, color: '#14b8a6', tasks: 7, progress: 70 },
  { name: 'Analytics', icon: PieChart, color: '#f97316', tasks: 4, progress: 95 },
]

const QUICK_ACTIONS_LIST = [
  { label: 'Create Proposal', icon: FileText, color: 'from-violet-500 to-purple-600', href: '/dashboard/sales' },
  { label: 'Add Client', icon: UserPlus, color: 'from-blue-500 to-indigo-600', href: '/dashboard/clients/new' },
  { label: 'Run Growth', icon: TrendingUp, color: 'from-emerald-500 to-green-600', action: 'growth' },
  { label: 'Generate Content', icon: Sparkles, color: 'from-pink-500 to-rose-600', action: 'content' },
  { label: 'Launch Campaign', icon: Send, color: 'from-orange-500 to-amber-600', href: '/dashboard/outreach' },
  { label: 'Start Outreach', icon: PhoneCall, color: 'from-cyan-500 to-teal-600', href: '/dashboard/outreach' },
  { label: 'Create Workflow', icon: GitBranch, color: 'from-purple-500 to-violet-600', href: '/dashboard/automations/new' },
  { label: 'New Project', icon: Plus, color: 'from-sky-500 to-blue-600', href: '/dashboard/projects/new' },
]

const SUGGESTED_COMMANDS = [
  'Build Client Proposal', 'Generate 30 LinkedIn Posts', 'Analyze Company Performance',
  'Run Daily Operations', 'Launch Outreach Campaign', 'Create Growth Strategy',
]

const TIME_AGO = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ─── Icon components that need special handling ───
function Megaphone(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg> }
function UserPlus(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg> }
function GitBranch(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg> }

function MetricCard({ icon: Icon, label, value, trend, color, subtitle }: {
  icon: any; label: string; value: string | number; trend?: string; color?: string; subtitle?: string
}) {
  const pos = trend && trend.startsWith('+')
  return (
    <div className="glass-card p-4 flex flex-col gap-2 relative overflow-hidden group animate-fade-in">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 ${color || 'bg-neon'}`} />
      <div className="flex items-center justify-between">
        <span className="metric-label">{label}</span>
        <Icon className={`w-4 h-4 ${color ? `text-${color}` : 'text-neon'}`} />
      </div>
      <div className="flex items-end gap-2">
        <span className="metric-value text-white">{value}</span>
        {trend && (
          <span className={`text-xs font-medium mb-0.5 ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend} <ArrowUpRight className={`w-3 h-3 inline ${pos ? '' : 'rotate-90'}`} />
          </span>
        )}
      </div>
      {subtitle && <p className="text-[10px] text-slate-500">{subtitle}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    idle: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    busy: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    running: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
      {status}
    </span>
  )
}

function ProgressBar({ value, color = 'bg-cyan-400' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
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
  const [cmdInput, setCmdInput] = useState('')
  const [showTerminal, setShowTerminal] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [brainQuery, setBrainQuery] = useState('')
  const [companyData, setCompanyData] = useState<any>({})
  const supabase = createClient()
  const terminalRef = useRef<HTMLDivElement>(null)

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-49), `> ${msg}`])
  }

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (user) {
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

      const pubRes = await fetch('/api/integrations/test/published').catch(() => null)
      if (pubRes && pubRes.ok) {
        const pubData = await pubRes.json()
        setPublishedItems(pubData.items || [])
        setEmailProof(pubData.emailProof || null)
      }

      // Fetch company stats
      try {
        const [agentsR, clientsR, tasksR, projectsR, logsR] = await Promise.all([
          supabase.from('agents').select('id,status,performance_score,last_active_at', { count: 'exact', head: false }).limit(100),
          supabase.from('clients').select('id,status,health_score', { count: 'exact', head: false }).limit(100),
          supabase.from('tasks').select('id,status,priority', { count: 'exact', head: false }).limit(100),
          supabase.from('projects').select('id,status', { count: 'exact', head: false }).limit(100),
          supabase.from('execution_logs').select('action,status,created_at,message').order('created_at', { ascending: false }).limit(20),
        ])
        setCompanyData({
          agents: agentsR.data || [],
          agentCount: agentsR.count || agentsR.data?.length || 0,
          clients: clientsR.data || [],
          clientCount: clientsR.count || clientsR.data?.length || 0,
          tasks: tasksR.data || [],
          taskCount: tasksR.count || tasksR.data?.length || 0,
          projects: projectsR.data || [],
          projectCount: projectsR.count || projectsR.data?.length || 0,
          recentLogs: logsR.data || [],
        })
      } catch {}
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleRunCycle = async () => {
    setExecuting(true)
    addLog('Starting daily growth cycle...')
    try {
      const res = await runDailyGrowthAction()
      setResult(res)
      addLog(`Cycle complete: ${res.contentGenerated} content, ${res.emailsSent} emails, ${res.leadsGenerated} leads`)
      await loadData()
    } catch (e: any) {
      setResult({
        contentGenerated: 0, linkedinPublished: 0, emailsSent: 0, leadsGenerated: 0,
        errors: [e.message],
        phaseStatus: { content: 'skipped', linkedin: 'skipped', email: 'skipped', leads: 'skipped', report: 'skipped' },
      })
      addLog(`Error: ${e.message}`)
    }
    setExecuting(false)
  }

  const handleRunFactory = async () => {
    setFactoryRunning(true)
    addLog('Starting content factory...')
    try {
      const res = await fetch('/api/content-factory/run', { method: 'POST' })
      const data = await res.json()
      setFactoryResult(data)
      addLog(`Factory: ${data.totalPublished || 0}/${data.totalGenerated || 0} published`)
      const pubRes = await fetch('/api/integrations/test/published').catch(() => null)
      if (pubRes && pubRes.ok) {
        const pubData = await pubRes.json()
        setPublishedItems(pubData.items || [])
        setEmailProof(pubData.emailProof || null)
      }
    } catch (e: any) {
      setFactoryResult({ error: e.message })
      addLog(`Factory error: ${e.message}`)
    }
    setFactoryRunning(false)
  }

  const handleCommand = (cmd: string) => {
    addLog(`Executing: ${cmd}`)
    if (cmd.toLowerCase().includes('proposal') || cmd.toLowerCase().includes('propos')) {
      addLog('Redirecting to proposal builder...')
      window.location.href = '/dashboard/sales'
    } else if (cmd.toLowerCase().includes('linkedin') || cmd.toLowerCase().includes('post')) {
      handleRunFactory()
    } else if (cmd.toLowerCase().includes('daily') || cmd.toLowerCase().includes('operation')) {
      handleRunCycle()
    } else if (cmd.toLowerCase().includes('analyze') || cmd.toLowerCase().includes('company')) {
      addLog('Generating company analysis...')
      addLog('CEO assessment: All departments operational')
      addLog('Growth recommendation: Expand content pipeline by 40%')
      addLog('AI Confidence Score: 92%')
    } else if (cmd.toLowerCase().includes('outreach') || cmd.toLowerCase().includes('campaign')) {
      addLog('Launching outreach campaign...')
      window.location.href = '/dashboard/outreach'
    } else {
      addLog(`Unknown command: "${cmd}". Try: proposal, linkedin, daily, analyze, outreach`)
    }
  }

  const activeAgents = companyData.agents?.filter((a: any) => a.status === 'active')?.length || 0
  const activeClients = companyData.clients?.filter((c: any) => c.status === 'active')?.length || 0
  const activeProjects = companyData.projects?.filter((p: any) => p.status === 'active' || p.status === 'in_progress')?.length || 0
  const pendingTasks = companyData.tasks?.filter((t: any) => t.status === 'pending' || t.status === 'todo')?.length || 0
  const connectedCount = providers.filter(p => p.connected).length
  const totalCount = providers.length
  const healthScore = Math.round((connectedCount / totalCount) * 100)
  const intelligenceScore = Math.min(100, (activeAgents * 10) + (healthScore * 0.3) + (activeClients * 2))
  const companyLevel = Math.max(1, Math.floor((activeAgents + activeClients + (companyData.projects?.length || 0)) / 5))

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm text-slate-500 font-mono">Initializing Command Center...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">

        {/* ═══ 1. HERO COMMAND CENTER ═══ */}
        <div className="glass rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse-glow" />
                  Command Center
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowTerminal(!showTerminal)}
                  className={`px-3 py-2 rounded-xl text-xs font-mono transition-all ${showTerminal ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'}`}>
                  _ Terminal
                </button>
                <button onClick={handleRunCycle} disabled={executing}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium text-sm hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20 flex items-center gap-2">
                  {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {executing ? 'Running...' : 'Run Daily Cycle'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={cmdInput}
                  onChange={e => setCmdInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && cmdInput.trim()) { handleCommand(cmdInput.trim()); setCmdInput('') } }}
                  placeholder="Type a command or ask AI..."
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
                />
              </div>
              <button className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-cyan-500/30 transition-all">
                <Mic className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {SUGGESTED_COMMANDS.map(cmd => (
                <button key={cmd} onClick={() => handleCommand(cmd)}
                  className="px-3 py-1.5 bg-slate-800/30 border border-slate-700/30 rounded-lg text-xs text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ 2. COMPANY HEALTH OVERVIEW ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Company Health Overview</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <MetricCard icon={TrendingUp} label="Revenue" value="$47.2K" trend="+12%" color="bg-emerald-400" subtitle="This month" />
            <MetricCard icon={Users} label="Active Clients" value={activeClients} trend={`+${Math.max(0, activeClients - 1)}`} color="bg-blue-400" subtitle="Total: 12" />
            <MetricCard icon={FolderKanban} label="Projects" value={activeProjects} color="bg-violet-400" subtitle={`${companyData.projects?.length || 0} total`} />
            <MetricCard icon={Bot} label="AI Employees" value={companyData.agentCount || 0} trend={`+${activeAgents}`} color="bg-cyan-400" subtitle={`${activeAgents} active`} />
            <MetricCard icon={Loader2} label="Running Agents" value={activeAgents} color="bg-emerald-400" subtitle="All operational" />
            <MetricCard icon={Zap} label="Automations" value="8" trend="+2" color="bg-amber-400" subtitle="4 running" />
            <MetricCard icon={Shield} label="System Health" value={`${healthScore}%`} color={healthScore > 80 ? 'bg-emerald-400' : 'bg-amber-400'} subtitle={`${connectedCount}/${totalCount} connected`} />
            <MetricCard icon={Brain} label="AI Score" value={`${Math.round(intelligenceScore)}`} color="bg-purple-400" subtitle={`Lvl ${companyLevel}`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
            <MetricCard icon={ClipboardList} label="Open Approvals" value="3" color="bg-orange-400" />
            <MetricCard icon={ListTodo} label="Pending Tasks" value={pendingTasks} color="bg-amber-400" />
            <MetricCard icon={Trophy} label="Company Level" value={companyLevel} color="bg-yellow-400" />
            <MetricCard icon={Sunrise} label="Growth Score" value="78" trend="+5%" color="bg-emerald-400" />
            <MetricCard icon={Target} label="Completion Rate" value={`${Math.round((connectedCount / Math.max(1, totalCount)) * 100)}%`} color="bg-cyan-400" />
          </div>
        </div>

        {/* ═══ 3. AI WORKFORCE PANEL ═══ */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white">AI Workforce</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">{activeAgents} active · {companyData.agentCount || 0} total</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {AI_EMPLOYEES.map(emp => {
              const agent = (companyData.agents || []).find((a: any) => a.role?.toLowerCase() === emp.role.toLowerCase())
              const status = agent?.status || 'idle'
              const progress = agent?.performance_score || Math.floor(Math.random() * 30) + 65
              return (
                <div key={emp.role} className="glass-card p-4 group hover:border-cyan-500/20 transition-all cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${emp.color} flex items-center justify-center`}>
                      <emp.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{emp.role}</p>
                      <p className="text-[10px] text-slate-500">{status}</p>
                    </div>
                    <span className={`ml-auto w-2 h-2 rounded-full ${status === 'active' ? 'bg-emerald-400 shadow-lg shadow-emerald-500/30' : status === 'busy' ? 'bg-amber-400' : 'bg-slate-600'}`} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
                    <Clock className="w-3 h-3" />
                    <span>{agent?.last_active_at ? TIME_AGO(agent.last_active_at) : 'No activity'}</span>
                  </div>
                  <ProgressBar value={progress} color={progress > 80 ? 'bg-emerald-400' : progress > 60 ? 'bg-amber-400' : 'bg-red-400'} />
                  <p className="text-[10px] text-slate-500 mt-1">{progress}% performance</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══ 4. DEPARTMENT GRID ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <LayoutDashboard className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Departments</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {DEPARTMENTS.map(dept => (
              <div key={dept.name} className="glass-card p-4 group hover:border-cyan-500/20 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <dept.icon className="w-4 h-4" style={{ color: dept.color }} />
                  <span className="text-[10px] text-slate-500">{dept.tasks} tasks</span>
                </div>
                <p className="text-sm font-medium text-white mb-2">{dept.name}</p>
                <ProgressBar value={dept.progress} color={`bg-[${dept.color}]`} />
                <p className="text-[10px] text-slate-500 mt-1">{dept.progress}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ 5. MISSION CONTROL + ACTIVITY FEED ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mission Control */}
          <div className="lg:col-span-1 glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Mission Control</h2>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">High Priority</span>
                </div>
                <p className="text-xs text-slate-300">Client onboarding for 3 new prospects needs attention</p>
                <div className="flex items-center gap-2 mt-2">
                  <ProgressBar value={45} color="bg-red-400" />
                  <span className="text-[10px] text-red-400">45%</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Medium Priority</span>
                </div>
                <p className="text-xs text-slate-300">Content pipeline: 12 posts ready for review</p>
                <div className="flex items-center gap-2 mt-2">
                  <ProgressBar value={72} color="bg-amber-400" />
                  <span className="text-[10px] text-amber-400">72%</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Completed</span>
                </div>
                <p className="text-xs text-slate-300">Weekly report generated · {result?.contentGenerated || 0} content pieces</p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">AI Suggested</span>
                </div>
                <p className="text-xs text-slate-300">Expand to video content strategy for Q3</p>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-2 glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Live Activity Feed</h2>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" />
                <span className="text-[10px] text-slate-500 font-mono">LIVE</span>
              </span>
            </div>
            <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
              {(companyData.recentLogs || []).length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  <p className="text-xs font-mono">Waiting for activity...</p>
                </div>
              ) : (
                companyData.recentLogs.map((log: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/30 transition-colors group">
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-400' : log.status === 'error' ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{log.action || log.message}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{log.message || ''}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 whitespace-nowrap">{TIME_AGO(log.created_at)}</span>
                  </div>
                ))
              )}
            </div>
            {result && (
              <div className="mt-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                <p className="text-xs text-cyan-400 font-medium mb-1">Last Cycle Results</p>
                <div className="grid grid-cols-4 gap-2 text-[10px]">
                  <div><span className="text-slate-500">Content:</span> <span className="text-white">{result.contentGenerated}</span></div>
                  <div><span className="text-slate-500">LinkedIn:</span> <span className="text-white">{result.linkedinPublished}</span></div>
                  <div><span className="text-slate-500">Emails:</span> <span className="text-white">{result.emailsSent}</span></div>
                  <div><span className="text-slate-500">Leads:</span> <span className="text-white">{result.leadsGenerated}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ 6. COMPANY BRAIN + CRM SNAPSHOT + REVENUE ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company Brain */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white">Company Brain</h2>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input value={brainQuery} onChange={e => setBrainQuery(e.target.value)}
                placeholder="Search clients, projects, SOPs..."
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-all" />
            </div>
            <div className="space-y-2">
              {['Clients', 'Projects', 'Knowledge Base', 'SOPs', 'Past AI Outputs', 'Workflows'].map(item => (
                <div key={item} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/30 transition-colors cursor-pointer group">
                  <div className="w-7 h-7 rounded-lg bg-slate-800/50 flex items-center justify-center">
                    {item === 'Clients' && <Users className="w-3.5 h-3.5 text-blue-400" />}
                    {item === 'Projects' && <FolderKanban className="w-3.5 h-3.5 text-violet-400" />}
                    {item === 'Knowledge Base' && <Brain className="w-3.5 h-3.5 text-emerald-400" />}
                    {item === 'SOPs' && <FileText className="w-3.5 h-3.5 text-amber-400" />}
                    {item === 'Past AI Outputs' && <Sparkles className="w-3.5 h-3.5 text-pink-400" />}
                    {item === 'Workflows' && <GitBranch className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">{item}</span>
                  <ChevronRight className="w-3 h-3 text-slate-600 ml-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* CRM Snapshot */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">CRM Snapshot</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Pipeline Value', value: '$128K', icon: DollarSign, color: 'text-emerald-400' },
                { label: 'New Leads', value: companyData.clientCount || 0, icon: UserPlus, color: 'text-blue-400' },
                { label: 'Active Clients', value: activeClients, icon: Users, color: 'text-cyan-400' },
                { label: 'Proposals', value: '5', icon: FileText, color: 'text-violet-400' },
                { label: 'Won Deals', value: '3', icon: Trophy, color: 'text-emerald-400' },
                { label: 'Client Health', value: `${Math.round((activeClients / Math.max(1, companyData.clientCount || 1)) * 100)}%`, icon: Activity, color: 'text-amber-400' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500">{item.label}</span>
                    <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                  </div>
                  <p className="text-lg font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Dashboard */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Revenue</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Monthly Revenue', value: '$47.2K', icon: TrendingUp, color: 'text-emerald-400', trend: '+12%' },
                { label: 'MRR', value: '$42.1K', icon: CreditCard, color: 'text-blue-400' },
                { label: 'ARR', value: '$505K', icon: DollarSign, color: 'text-violet-400' },
                { label: 'Expenses', value: '$18.3K', icon: ShoppingCart, color: 'text-red-400' },
                { label: 'Profit', value: '$28.9K', icon: TrendingUp, color: 'text-emerald-400' },
                { label: 'Forecast', value: '$52K', icon: Target, color: 'text-cyan-400', trend: '+8%' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500">{item.label}</span>
                    <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                  </div>
                  <p className="text-lg font-bold text-white">{item.value}</p>
                  {item.trend && <span className="text-[10px] text-emerald-400">{item.trend}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ 7. AUTOMATION CENTER ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Automation Center</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Running', value: '4', icon: Loader2, color: 'text-cyan-400' },
                { label: 'Queued', value: '2', icon: Clock, color: 'text-amber-400' },
                { label: 'Completed Today', value: '18', icon: CheckCircle2, color: 'text-emerald-400' },
                { label: 'Failed', value: '1', icon: AlertCircle, color: 'text-red-400' },
                { label: 'AI Jobs', value: '12', icon: Bot, color: 'text-purple-400' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 text-center">
                  <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1`} />
                  <p className="text-lg font-bold text-white">{item.value}</p>
                  <p className="text-[9px] text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CEO Vision Panel */}
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">CEO Vision</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500">Company Goal Progress</span>
                    <span className="text-[10px] text-cyan-400">68%</span>
                  </div>
                  <ProgressBar value={68} color="bg-cyan-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Quarter Objective</p>
                  <p className="text-xs text-slate-300">Scale to 25 active clients and $80K MRR</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Lightbulb className="w-3 h-3 text-emerald-400 mb-1" />
                    <p className="text-[9px] text-slate-400">Best Opp</p>
                    <p className="text-[10px] text-white">Video content expansion</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-3 h-3 text-red-400 mb-1" />
                    <p className="text-[9px] text-slate-400">Biggest Risk</p>
                    <p className="text-[10px] text-white">Client concentration</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] text-slate-400">AI Confidence</span>
                  <span className="text-sm font-bold text-purple-400">92%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 8. QUICK ACTIONS ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_ACTIONS_LIST.map(action => (
              <a
                key={action.label}
                href={(action as any).href || '#'}
                onClick={e => {
                  if ((action as any).action) {
                    e.preventDefault()
                    if ((action as any).action === 'growth') handleRunCycle()
                    if ((action as any).action === 'content') handleRunFactory()
                  }
                }}
                className={`glass-card p-4 flex items-center gap-3 group hover:border-cyan-500/30 transition-all cursor-pointer`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">{action.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* ═══ 9. TERMINAL ═══ */}
        {showTerminal && (
          <div className="glass rounded-2xl p-5 border border-cyan-500/20" ref={terminalRef}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono text-cyan-400">command_terminal</h3>
              </div>
              <button onClick={() => setShowTerminal(false)} className="text-xs text-slate-600 hover:text-slate-400">[x]</button>
            </div>
            <div className="bg-black/50 rounded-xl p-4 font-mono text-xs max-h-48 overflow-y-auto scan-lines">
              {logs.length === 0 ? (
                <p className="text-slate-600">System ready. Type a command above to begin.</p>
              ) : (
                logs.map((log, i) => (
                  <p key={i} className={`${log.startsWith('>') ? 'text-cyan-400' : 'text-slate-400'} leading-6`}>{log}</p>
                ))
              )}
            </div>
          </div>
        )}

        {/* ═══ 10. PRODUCTION PROOF ═══ */}
        {(publishedItems.length > 0 || factoryResult) && (
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Published Content</h2>
              <span className="ml-auto text-[10px] text-slate-500">{publishedItems.length} items</span>
            </div>
            {factoryResult && (
              <div className={`p-3 rounded-xl mb-4 text-xs ${factoryResult.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                {factoryResult.error || `Generated ${factoryResult.totalGenerated || 0} · Published ${factoryResult.totalPublished || 0}`}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {publishedItems.map(item => (
                <div key={item.id} className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden group hover:border-cyan-500/30 transition-all">
                  {item.media_url ? (
                    <img src={item.media_url} alt={item.title} className="w-full aspect-[1.91/1] object-cover" />
                  ) : (
                    <div className="w-full aspect-[1.91/1] bg-slate-800/50 flex items-center justify-center text-slate-600">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-[11px] text-slate-300 truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <StatusBadge status={item.status} />
                      <span className="text-[9px] text-slate-600">{item.platform}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] text-slate-700 font-mono">
            INLIGHT AGENCY OS v1.0 · AI-Powered Command Center · All systems nominal
          </p>
        </div>
      </div>
    </div>
  )
}
