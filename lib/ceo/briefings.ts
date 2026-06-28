import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory, getMemoryContext } from '@/lib/ai/memory'
import { enqueueJob, fetchJobs } from '@/lib/queue/queue'

export interface CeoBriefing {
  type: 'morning' | 'evening'
  date: string
  summary: string
  sections: BriefingSection[]
  metrics: BriefingMetrics
  actionItems: BriefingAction[]
}

export interface BriefingSection {
  title: string
  content: string
  priority: 'high' | 'medium' | 'low'
}

export interface BriefingMetrics {
  activeProjects: number
  overdueTasks: number
  pendingInvoices: number
  overdueInvoices: number
  totalRevenue: number
  totalExpenses: number
  openLeads: number
  queueBacklog: number
  agentSuccessRate: number
  cashBalance: number
}

export interface BriefingAction {
  description: string
  priority: 'high' | 'medium' | 'low'
  category: string
}

export interface PnLReport {
  period: string
  startDate: string
  endDate: string
  revenue: PnLBreakdown
  expenses: PnLBreakdown
  grossProfit: number
  netProfit: number
  profitMargin: number
  breakdowns: PnLCategory[]
  insights: string[]
  generatedAt: string
}

export interface PnLBreakdown {
  total: number
  count: number
}

export interface PnLCategory {
  category: string
  amount: number
  percentage: number
  trend: 'up' | 'down' | 'stable'
}

export interface CashflowPrediction {
  currentBalance: number
  projectedInflows: CashflowEntry[]
  projectedOutflows: CashflowEntry[]
  netProjection: CashflowEntry[]
  riskLevel: 'low' | 'medium' | 'high'
  insights: string[]
  recommendations: string[]
  generatedAt: string
}

export interface CashflowEntry {
  month: string
  amount: number
  confidence: number
}

export interface BudgetSuggestion {
  category: string
  currentSpend: number
  suggestedBudget: number
  reasoning: string
  expectedImpact: string
  priority: 'high' | 'medium' | 'low'
}

async function logCeoAction(supabase: SupabaseClient, userId: string, action: string, detail: string) {
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[CEO] ${action}`,
    module: 'agents', status: 'success',
    message: detail, entity_type: 'ceo_briefing',
  }])
}

async function gatherBriefingMetrics(supabase: SupabaseClient, userId: string): Promise<BriefingMetrics> {
  const [
    { data: projects },
    { data: tasks },
    { data: invoices },
    { data: expenses },
    { data: leads },
    jobs,
    { data: agents },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', userId),
    supabase.from('tasks').select('*').in('status', ['todo', 'in_progress', 'review']),
    supabase.from('invoices').select('*').eq('user_id', userId),
    supabase.from('expenses').select('*').eq('user_id', userId),
    supabase.from('leads').select('*').eq('user_id', userId),
    fetchJobs(supabase, userId, undefined, undefined, 100),
    supabase.from('agents').select('success_rate').eq('user_id', userId),
  ])

  const allTasks = (tasks ?? []) as any[]
  const allInvoices = (invoices ?? []) as any[]
  const allExpenses = (expenses ?? []) as any[]
  const allLeads = (leads ?? []) as any[]
  const allAgents = (agents ?? []) as any[]

  const totalRevenue = allInvoices
    .filter((i: any) => i.status === 'paid')
    .reduce((s: number, i: any) => s + Number(i.total || 0), 0)

  const totalExpenses = allExpenses
    .reduce((s: number, e: any) => s + Number(e.amount || 0), 0)

  const avgSuccess = allAgents.length > 0
    ? Math.round(allAgents.reduce((s: number, a: any) => s + (a.success_rate || 0), 0) / allAgents.length)
    : 0

  return {
    activeProjects: (projects ?? []).filter((p: any) => p.status === 'active').length,
    overdueTasks: allTasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length,
    pendingInvoices: allInvoices.filter((i: any) => i.status === 'draft' || i.status === 'sent').length,
    overdueInvoices: allInvoices.filter((i: any) => i.status === 'overdue').length,
    totalRevenue,
    totalExpenses,
    openLeads: allLeads.filter((l: any) => l.status !== 'converted' && l.status !== 'lost').length,
    queueBacklog: jobs.filter((j) => j.status === 'pending').length,
    agentSuccessRate: avgSuccess,
    cashBalance: totalRevenue - totalExpenses,
  }
}

export async function runMorningBriefing(supabase: SupabaseClient, userId: string): Promise<CeoBriefing> {
  const metrics = await gatherBriefingMetrics(supabase, userId)
  const recentMemories = await getMemoryContext(supabase, userId, 5)

  const systemPrompt = `You are the CEO Agent preparing a MORNING BRIEFING for an AI-powered digital agency.

Today's date: ${new Date().toLocaleDateString()}
Day of week: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}

Provide a comprehensive morning briefing as JSON only:
{
  "summary": "One paragraph executive overview of today's focus",
  "sections": [
    {
      "title": "section title (e.g. Revenue Health, Project Status, Team Performance, etc.)",
      "content": "detailed analysis of this area",
      "priority": "high|medium|low"
    }
  ],
  "actionItems": [
    {
      "description": "specific action to take today",
      "priority": "high|medium|low",
      "category": "urgent|important|routine"
    }
  ]
}

Include 2-4 sections covering: financial health, project delivery, pipeline/leads, and operational efficiency.`

  const stateText = [
    `=== AGENCY MORNING BRIEFING ===`,
    `\nMETRICS:`,
    `Active Projects: ${metrics.activeProjects}`,
    `Overdue Tasks: ${metrics.overdueTasks}`,
    `Pending Invoices: ${metrics.pendingInvoices}`,
    `Overdue Invoices: ${metrics.overdueInvoices}`,
    `Total Revenue: PKR ${metrics.totalRevenue.toLocaleString()}`,
    `Total Expenses: PKR ${metrics.totalExpenses.toLocaleString()}`,
    `Cash Balance: PKR ${metrics.cashBalance.toLocaleString()}`,
    `Open Leads: ${metrics.openLeads}`,
    `Queue Backlog: ${metrics.queueBacklog}`,
    `Agent Success Rate: ${metrics.agentSuccessRate}%`,
    `\nRecent Activity:`,
    ...recentMemories.map((m) => `[${m.category}] ${JSON.stringify(m.content).slice(0, 100)}`),
  ].join('\n')

  const result = await executeAgentTask(supabase, userId, null, stateText, { systemPrompt })

  let parsed: any = { summary: '', sections: [], actionItems: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response || 'Morning briefing completed' }

  const briefing: CeoBriefing = {
    type: 'morning',
    date: new Date().toISOString(),
    summary: parsed.summary || 'No summary generated',
    sections: (parsed.sections || []).map((s: any) => ({
      title: s.title,
      content: s.content,
      priority: s.priority || 'medium',
    })),
    metrics,
    actionItems: (parsed.actionItems || []).map((a: any) => ({
      description: a.description,
      priority: a.priority || 'medium',
      category: a.category || 'routine',
    })),
  }

  await storeMemory(supabase, userId, {
    category: 'ceo_morning_briefing',
    content: briefing,
    tags: ['ceo', 'morning_briefing', `date:${new Date().toISOString().slice(0, 10)}`],
  })

  for (const item of briefing.actionItems) {
    await supabase.from('orchestrator_tasks').insert([{
      user_id: userId,
      title: `Morning Briefing: ${item.description.slice(0, 100)}`,
      description: item.description,
      status: 'pending',
      priority: item.priority,
    }]).select('id')
  }

  await logCeoAction(supabase, userId, 'Morning Briefing completed',
    `${briefing.sections.length} sections, ${briefing.actionItems.length} action items`)

  return briefing
}

export async function runEveningBriefing(supabase: SupabaseClient, userId: string): Promise<CeoBriefing> {
  const metrics = await gatherBriefingMetrics(supabase, userId)
  const recentMemories = await getMemoryContext(supabase, userId, 5)

  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('*')
    .gte('updated_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .limit(50)

  const { data: todayExecutions } = await supabase
    .from('agent_executions')
    .select('*')
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .limit(50)

  const tasksToday = (todayTasks ?? []) as any[]
  const executionsToday = (todayExecutions ?? []) as any[]
  const completedToday = tasksToday.filter((t: any) => t.status === 'done').length
  const failedToday = executionsToday.filter((e: any) => e.status === 'failed').length

  const systemPrompt = `You are the CEO Agent preparing an EVENING BRIEFING for an AI-powered digital agency.

Date: ${new Date().toLocaleDateString()}

Summarize today's performance and prepare for tomorrow. Provide JSON only:
{
  "summary": "One paragraph wrap-up of today's results",
  "sections": [
    {
      "title": "section title",
      "content": "what happened today, what to watch for tomorrow",
      "priority": "high|medium|low"
    }
  ],
  "actionItems": [
    {
      "description": "specific action to take tomorrow",
      "priority": "high|medium|low",
      "category": "followup|review|prepare"
    }
  ]
}

Include: today's wins, any failures/issues, and a clear focus for tomorrow morning.`

  const stateText = [
    `=== AGENCY EVENING BRIEFING ===`,
    `\nTODAY'S SUMMARY:`,
    `Tasks Completed Today: ${completedToday}`,
    `Agent Executions Today: ${executionsToday.length} (${failedToday} failed)`,
    `\nCURRENT STATE:`,
    `Active Projects: ${metrics.activeProjects}`,
    `Overdue Tasks: ${metrics.overdueTasks}`,
    `Pending Invoices: ${metrics.pendingInvoices}`,
    `Overdue Invoices: ${metrics.overdueInvoices}`,
    `Cash Balance: PKR ${metrics.cashBalance.toLocaleString()}`,
    `Open Leads: ${metrics.openLeads}`,
    `Queue Backlog: ${metrics.queueBacklog}`,
    `Agent Success Rate: ${metrics.agentSuccessRate}%`,
    `\nRecent Activity:`,
    ...recentMemories.map((m) => `[${m.category}] ${JSON.stringify(m.content).slice(0, 100)}`),
  ].join('\n')

  const result = await executeAgentTask(supabase, userId, null, stateText, { systemPrompt })

  let parsed: any = { summary: '', sections: [], actionItems: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response || 'Evening briefing completed' }

  const briefing: CeoBriefing = {
    type: 'evening',
    date: new Date().toISOString(),
    summary: parsed.summary || 'No summary generated',
    sections: (parsed.sections || []).map((s: any) => ({
      title: s.title,
      content: s.content,
      priority: s.priority || 'medium',
    })),
    metrics,
    actionItems: (parsed.actionItems || []).map((a: any) => ({
      description: a.description,
      priority: a.priority || 'medium',
      category: a.category || 'followup',
    })),
  }

  await storeMemory(supabase, userId, {
    category: 'ceo_evening_briefing',
    content: briefing,
    tags: ['ceo', 'evening_briefing', `date:${new Date().toISOString().slice(0, 10)}`],
  })

  for (const item of briefing.actionItems) {
    await supabase.from('orchestrator_tasks').insert([{
      user_id: userId,
      title: `Evening Briefing: ${item.description.slice(0, 100)}`,
      description: item.description,
      status: 'pending',
      priority: item.priority,
    }]).select('id')
  }

  await logCeoAction(supabase, userId, 'Evening Briefing completed',
    `${briefing.sections.length} sections, ${briefing.actionItems.length} action items for tomorrow`)

  return briefing
}

export async function getLatestBriefing(supabase: SupabaseClient, userId: string, type: 'morning' | 'evening'): Promise<CeoBriefing | null> {
  const category = type === 'morning' ? 'ceo_morning_briefing' : 'ceo_evening_briefing'
  const { data } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(1)

  const rows = (data ?? []) as any[]
  if (!rows.length) return null
  return { ...rows[0].content, date: rows[0].created_at } as CeoBriefing
}

export async function getBriefingStats(supabase: SupabaseClient, userId: string): Promise<{
  totalMorning: number; totalEvening: number; lastMorning: string | null; lastEvening: string | null
}> {
  const [morningCount, eveningCount, morningLast, eveningLast] = await Promise.all([
    supabase.from('agent_memory').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('category', 'ceo_morning_briefing'),
    supabase.from('agent_memory').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('category', 'ceo_evening_briefing'),
    supabase.from('agent_memory').select('created_at').eq('user_id', userId).eq('category', 'ceo_morning_briefing').order('created_at', { ascending: false }).limit(1),
    supabase.from('agent_memory').select('created_at').eq('user_id', userId).eq('category', 'ceo_evening_briefing').order('created_at', { ascending: false }).limit(1),
  ])

  return {
    totalMorning: morningCount.count || 0,
    totalEvening: eveningCount.count || 0,
    lastMorning: ((morningLast.data ?? []) as any[])[0]?.created_at || null,
    lastEvening: ((eveningLast.data ?? []) as any[])[0]?.created_at || null,
  }
}

export async function runPnLAnalysis(supabase: SupabaseClient, userId: string, months = 3): Promise<PnLReport> {
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .limit(200)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .limit(200)

  const allInvoices = (invoices ?? []) as any[]
  const allExpenses = (expenses ?? []) as any[]

  const totalRevenue = allInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0)
  const totalExpenseAmount = allExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
  const paidRevenue = allInvoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total || 0), 0)

  const expenseCategories = [...new Set(allExpenses.map((e: any) => e.category || 'other'))]
  const expenseBreakdown: PnLCategory[] = expenseCategories.map((cat) => {
    const amount = allExpenses.filter((e: any) => (e.category || 'other') === cat).reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
    return {
      category: cat,
      amount,
      percentage: totalExpenseAmount > 0 ? Math.round((amount / totalExpenseAmount) * 100) : 0,
      trend: 'stable',
    }
  })

  const invoiceStatuses = ['paid', 'sent', 'overdue', 'draft']
  const revenueBreakdown: PnLCategory[] = invoiceStatuses.map((status) => {
    const amount = allInvoices.filter((i: any) => i.status === status).reduce((s: number, i: any) => s + Number(i.total || 0), 0)
    return {
      category: `invoices_${status}`,
      amount,
      percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
      trend: 'stable',
    }
  })

  const grossProfit = totalRevenue - totalExpenseAmount
  const profitMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100 * 100) / 100 : 0
  const collectionRate = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0

  const systemPrompt = `You are the CFO Agent analyzing P&L for a digital agency.

Period: Last ${months} months
Total Revenue: PKR ${totalRevenue.toLocaleString()}
Paid Revenue: PKR ${paidRevenue.toLocaleString()}
Collection Rate: ${collectionRate}%
Total Expenses: PKR ${totalExpenseAmount.toLocaleString()}
Gross Profit: PKR ${grossProfit.toLocaleString()}
Profit Margin: ${profitMargin}%

Provide a P&L analysis as JSON only:
{
  "insights": ["key financial insight 1", "insight 2", "insight 3"],
  "recommendations": ["actionable recommendation 1", "recommendation 2"]
}`

  const result = await executeAgentTask(supabase, userId, null,
    `Period: ${startDate.toISOString().slice(0, 7)} to ${new Date().toISOString().slice(0, 7)}`, { systemPrompt })

  let parsed: any = { insights: [], recommendations: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.insights = [result.response || 'Analysis completed'] }

  const report: PnLReport = {
    period: `${startDate.toISOString().slice(0, 7)} to ${new Date().toISOString().slice(0, 7)}`,
    startDate: startDate.toISOString(),
    endDate: new Date().toISOString(),
    revenue: { total: totalRevenue, count: allInvoices.length },
    expenses: { total: totalExpenseAmount, count: allExpenses.length },
    grossProfit,
    netProfit: grossProfit,
    profitMargin,
    breakdowns: [...revenueBreakdown, ...expenseBreakdown],
    insights: parsed.insights || [],
    generatedAt: new Date().toISOString(),
  }

  await storeMemory(supabase, userId, {
    category: 'ceo_pnl_analysis',
    content: report,
    tags: ['ceo', 'pnl', `period:${report.period}`],
  })

  await logCeoAction(supabase, userId, 'P&L Analysis completed',
    `${months}mo analysis: Rev PKR ${totalRevenue.toLocaleString()}, Expenses PKR ${totalExpenseAmount.toLocaleString()}, Margin ${profitMargin}%`)

  return report
}

export async function runCashflowPrediction(supabase: SupabaseClient, userId: string, months = 6): Promise<CashflowPrediction> {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .limit(200)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .limit(200)

  const { data: projects } = await supabase
    .from('projects')
    .select('budget, actual_cost, status')
    .eq('user_id', userId)

  const allInvoices = (invoices ?? []) as any[]
  const allExpenses = (expenses ?? []) as any[]
  const allProjects = (projects ?? []) as any[]

  const monthlyAvgRevenue = allInvoices.filter((i: any) => i.status === 'paid')
    .reduce((s: number, i: any) => s + Number(i.total || 0), 0) / Math.max(1, months)
  const monthlyAvgExpenses = allExpenses
    .reduce((s: number, e: any) => s + Number(e.amount || 0), 0) / Math.max(1, months)

  const currentBalance = allInvoices.filter((i: any) => i.status === 'paid')
    .reduce((s: number, i: any) => s + Number(i.total || 0), 0) -
    allExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)

  const projections: CashflowEntry[] = []
  for (let i = 0; i < months; i++) {
    const month = new Date()
    month.setMonth(month.getMonth() + i + 1)
    const growthFactor = 1 + (i * 0.03)
    const confidence = Math.max(30, 90 - (i * 10))
    projections.push({
      month: month.toISOString().slice(0, 7),
      amount: Math.round((monthlyAvgRevenue * growthFactor) - monthlyAvgExpenses),
      confidence,
    })
  }

  const pendingRevenue = allInvoices.filter((i: any) => i.status === 'sent' || i.status === 'draft')
    .reduce((s: number, i: any) => s + Number(i.total || 0), 0)
  const overdueAmount = allInvoices.filter((i: any) => i.status === 'overdue')
    .reduce((s: number, i: any) => s + Number(i.total || 0), 0)
  const remainingBudget = allProjects
    .filter((p: any) => p.status === 'active' || p.status === 'planning')
    .reduce((s: number, p: any) => s + (Number(p.budget || 0) - Number(p.actual_cost || 0)), 0)

  const worstCase = currentBalance + pendingRevenue - (monthlyAvgExpenses * months)
  const riskLevel: 'low' | 'medium' | 'high' = worstCase < 0 ? 'high' : worstCase < monthlyAvgExpenses * 2 ? 'medium' : 'low'

  const systemPrompt = `You are the CFO Agent analyzing cashflow for a digital agency.

Current Balance: PKR ${currentBalance.toLocaleString()}
Monthly Avg Revenue: PKR ${monthlyAvgRevenue.toLocaleString()}
Monthly Avg Expenses: PKR ${monthlyAvgExpenses.toLocaleString()}
Pending Invoices: PKR ${pendingRevenue.toLocaleString()}
Overdue Amount: PKR ${overdueAmount.toLocaleString()}
Remaining Project Budget: PKR ${remainingBudget.toLocaleString()}
Risk Level: ${riskLevel}

Provide cashflow insights as JSON only:
{
  "insights": ["cashflow insight 1", "insight 2", "insight 3"],
  "recommendations": ["financial recommendation 1", "recommendation 2"]
}`

  const result = await executeAgentTask(supabase, userId, null,
    `Cashflow projection for next ${months} months`, { systemPrompt })

  let parsed: any = { insights: [], recommendations: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.insights = [result.response || 'Cashflow analysis completed'] }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const currentMonth = new Date().getMonth()
  const projectedInflows = projections.map((p, i) => ({
    month: monthNames[(currentMonth + i + 1) % 12],
    amount: Math.round(monthlyAvgRevenue * (1 + (i * 0.03))),
    confidence: p.confidence,
  }))
  const projectedOutflows = projections.map((p, i) => ({
    month: monthNames[(currentMonth + i + 1) % 12],
    amount: Math.round(monthlyAvgExpenses * (1 + (i * 0.015))),
    confidence: p.confidence,
  }))

  const prediction: CashflowPrediction = {
    currentBalance,
    projectedInflows,
    projectedOutflows,
    netProjection: projections,
    riskLevel,
    insights: parsed.insights || [],
    recommendations: parsed.recommendations || [],
    generatedAt: new Date().toISOString(),
  }

  await storeMemory(supabase, userId, {
    category: 'ceo_cashflow_prediction',
    content: prediction,
    tags: ['ceo', 'cashflow', `projection:${months}mo`],
  })

  await logCeoAction(supabase, userId, 'Cashflow Prediction completed',
    `${months}mo projection: Balance PKR ${currentBalance.toLocaleString()}, Risk: ${riskLevel}`)

  return prediction
}

export async function runAutoBudgetSuggestions(supabase: SupabaseClient, userId: string): Promise<BudgetSuggestion[]> {
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .limit(200)

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .limit(200)

  const { data: projects } = await supabase
    .from('projects')
    .select('budget, actual_cost, name, status')
    .eq('user_id', userId)
    .limit(50)

  const allExpenses = (expenses ?? []) as any[]
  const allInvoices = (invoices ?? []) as any[]
  const allProjects = (projects ?? []) as any[]

  const categorySpend: Record<string, number> = {}
  for (const e of allExpenses) {
    const cat = e.category || 'other'
    categorySpend[cat] = (categorySpend[cat] || 0) + Number(e.amount || 0)
  }

  const totalRevenue = allInvoices.filter((i: any) => i.status === 'paid')
    .reduce((s: number, i: any) => s + Number(i.total || 0), 0)

  const totalExpense = allExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
  const avgMonthlyRevenue = totalRevenue / Math.max(1, 3)
  const budgetPercentage = totalRevenue > 0 ? (totalExpense / totalRevenue) * 100 : 0

  const systemPrompt = `You are the CFO Agent providing budget optimization for a digital agency.

Revenue: PKR ${totalRevenue.toLocaleString()}
Total Expenses: PKR ${totalExpense.toLocaleString()}
Expense/Revenue Ratio: ${budgetPercentage.toFixed(1)}%
Avg Monthly Revenue: PKR ${avgMonthlyRevenue.toLocaleString()}
Active Projects: ${allProjects.filter((p: any) => p.status === 'active').length}

Categories: ${Object.entries(categorySpend).map(([k, v]) => `${k}: PKR ${(v as number).toLocaleString()}`).join(', ')}

Provide budget suggestions as JSON only:
{
  "suggestions": [
    {
      "category": "category name",
      "currentSpend": number,
      "suggestedBudget": number,
      "reasoning": "why this change",
      "expectedImpact": "expected outcome",
      "priority": "high|medium|low"
    }
  ]
}

Consider: typical agency benchmarks (30-40% payroll, 10-15% tools/software, 15-20% marketing, 10-15% ops).`

  const result = await executeAgentTask(supabase, userId, null,
    `Current expenses: ${JSON.stringify(categorySpend)}`, { systemPrompt })

  let parsed: any = { suggestions: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.suggestions = [] }

  const suggestions: BudgetSuggestion[] = (parsed.suggestions || []).map((s: any) => ({
    category: s.category || 'other',
    currentSpend: s.currentSpend || categorySpend[s.category || 'other'] || 0,
    suggestedBudget: s.suggestedBudget || Math.round((categorySpend[s.category || 'other'] || 0) * 0.9),
    reasoning: s.reasoning || 'Optimize spend based on revenue ratio',
    expectedImpact: s.expectedImpact || 'Improved efficiency',
    priority: s.priority || 'medium',
  }))

  if (suggestions.length === 0) {
    suggestions.push(...Object.entries(categorySpend).map(([cat, amount]) => ({
      category: cat,
      currentSpend: amount,
      suggestedBudget: Math.round(amount * 0.9),
      reasoning: `Current spend PKR ${amount.toLocaleString()}. Reducing by 10% aligns with revenue-based budgeting.`,
      expectedImpact: `Save approximately PKR ${Math.round(amount * 0.1).toLocaleString()}`,
      priority: 'medium' as const,
    })))
  }

  await storeMemory(supabase, userId, {
    category: 'ceo_budget_suggestions',
    content: { suggestions, generatedAt: new Date().toISOString() },
    tags: ['ceo', 'budget', `date:${new Date().toISOString().slice(0, 10)}`],
  })

  await logCeoAction(supabase, userId, 'Budget Suggestions generated',
    `${suggestions.length} suggestions across ${Object.keys(categorySpend).length} categories`)

  return suggestions
}
