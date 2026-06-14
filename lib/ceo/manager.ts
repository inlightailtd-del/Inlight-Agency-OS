import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { enqueueJob, fetchJobs } from '@/lib/queue/queue'
import { assignTaskToEmployee } from '@/lib/employees/employee'

export type DepartmentType = 'sales' | 'marketing' | 'content' | 'operations' | 'finance'

export interface ManagerReport {
  department: DepartmentType
  summary: string
  metrics: DepartmentMetrics
  decisions: ManagerDecision[]
  generatedAt: string
}

export interface DepartmentMetrics {
  totalJobs: number
  failedJobs: number
  pendingTasks: number
  completedToday: number
  departmentSpecific: Record<string, any>
}

export interface ManagerDecision {
  type: 'create_task' | 'launch_workflow' | 'create_content' | 'enqueue_job'
  description: string
  priority: string
  executed: boolean
  result?: string
}

const DEPARTMENT_SYSTEM_PROMPTS: Record<DepartmentType, string> = {
  sales: `You are the Sales Manager of an AI-powered digital agency.
Review the sales data below and provide:
1. A brief assessment of sales pipeline health (2-3 sentences)
2. 2-3 specific insights about leads, conversions, or outreach
3. 1-2 concrete actions to improve sales

Format your response as JSON only:
{
  "summary": "sales assessment",
  "insights": ["insight1", "insight2"],
  "actions": [{"type": "create_task|launch_workflow|create_content|enqueue_job", "description": "what to do", "priority": "high|medium|low"}]
}`,
  marketing: `You are the Marketing Manager of an AI-powered digital agency.
Review the marketing data below and provide:
1. A brief assessment of marketing performance (2-3 sentences)
2. 2-3 specific insights about campaigns, content, or channels
3. 1-2 concrete actions to improve marketing

Format your response as JSON only:
{
  "summary": "marketing assessment",
  "insights": ["insight1", "insight2"],
  "actions": [{"type": "create_task|launch_workflow|create_content|enqueue_job", "description": "what to do", "priority": "high|medium|low"}]
}`,
  content: `You are the Content Manager of an AI-powered digital agency.
Review the content data below and provide:
1. A brief assessment of content pipeline (2-3 sentences)
2. 2-3 specific insights about content quality, gaps, or performance
3. 1-2 concrete actions to improve content operations

Format your response as JSON only:
{
  "summary": "content assessment",
  "insights": ["insight1", "insight2"],
  "actions": [{"type": "create_task|launch_workflow|create_content|enqueue_job", "description": "what to do", "priority": "high|medium|low"}]
}`,
  operations: `You are the Operations Manager of an AI-powered digital agency.
Review the operations data below and provide:
1. A brief assessment of operational efficiency (2-3 sentences)
2. 2-3 specific insights about workflow bottlenecks or queue health
3. 1-2 concrete actions to improve operations

Format your response as JSON only:
{
  "summary": "operations assessment",
  "insights": ["insight1", "insight2"],
  "actions": [{"type": "create_task|launch_workflow|enqueue_job", "description": "what to do", "priority": "high|medium|low"}]
}`,
  finance: `You are the Finance Manager of an AI-powered digital agency.
Review the financial data below and provide:
1. A brief assessment of financial health (2-3 sentences)
2. 2-3 specific insights about revenue, expenses, or invoices
3. 1-2 concrete actions to improve financial performance

Format your response as JSON only:
{
  "summary": "finance assessment",
  "insights": ["insight1", "insight2"],
  "actions": [{"type": "create_task|launch_workflow|enqueue_job", "description": "what to do", "priority": "high|medium|low"}]
}`,
}

export function listDepartments(): DepartmentType[] {
  return ['sales', 'marketing', 'content', 'operations', 'finance']
}

export const DEPARTMENT_DISPLAY_NAMES: Record<DepartmentType, string> = {
  sales: 'Sales Manager',
  marketing: 'Marketing Manager',
  content: 'Content Manager',
  operations: 'Operations Manager',
  finance: 'Finance Manager',
}

async function logManagerAction(supabase: SupabaseClient, userId: string, dept: string, action: string, detail: string) {
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[${dept}] ${action}`, module: dept, status: 'success',
    message: detail, entity_type: 'manager_agent',
  }])
}

async function gatherDepartmentState(supabase: SupabaseClient, userId: string, dept: DepartmentType): Promise<{ text: string; metrics: DepartmentMetrics }> {
  const jobs = await fetchJobs(supabase, userId)

  const relevantTypes: Record<DepartmentType, string[]> = {
    sales: ['agent_execution', 'workflow_execution'],
    marketing: ['agent_execution', 'workflow_execution'],
    content: ['content_generation'],
    operations: ['agent_execution', 'workflow_execution', 'automation_execution'],
    finance: ['agent_execution'],
  }

  const deptJobs = jobs.filter((j) => relevantTypes[dept]?.includes(j.job_type))

  const { data: orchTasks } = await supabase
    .from('orchestrator_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  const tasks = (orchTasks ?? []) as any[]
  const pendingTasks = tasks.filter((t: any) => t.status === 'pending' || t.status === 'in_progress')
  const completedToday = tasks.filter((t: any) => {
    if (t.status !== 'completed' || !t.completed_at) return false
    return new Date(t.completed_at).toDateString() === new Date().toDateString()
  })

  const metrics: DepartmentMetrics = {
    totalJobs: deptJobs.length,
    failedJobs: deptJobs.filter((j) => j.status === 'failed').length,
    pendingTasks: pendingTasks.length,
    completedToday: completedToday.length,
    departmentSpecific: {},
  }

  // Gather department-specific data
  let deptData = ''
  switch (dept) {
    case 'sales': {
      const { data: leads } = await supabase.from('leads').select('*').eq('user_id', userId).limit(10)
      const allLeads = (leads ?? []) as any[]
      metrics.departmentSpecific.leadCount = allLeads.length
      metrics.departmentSpecific.converted = allLeads.filter((l: any) => l.status === 'converted').length
      deptData = `\nLeads: ${allLeads.length}, Converted: ${allLeads.filter((l: any) => l.status === 'converted').length}`
      break
    }
    case 'marketing': {
      const { data: content } = await supabase.from('content_requests').select('*').eq('user_id', userId).limit(10)
      const allContent = (content ?? []) as any[]
      metrics.departmentSpecific.contentCount = allContent.length
      deptData = `\nContent requests: ${allContent.length}, Drafts: ${allContent.filter((c: any) => c.status === 'draft').length}`
      break
    }
    case 'content': {
      const { data: content } = await supabase.from('content_requests').select('*').eq('user_id', userId).limit(10)
      const allContent = (content ?? []) as any[]
      metrics.departmentSpecific.contentCount = allContent.length
      metrics.departmentSpecific.generatedCount = allContent.filter((c: any) => c.status === 'completed').length
      deptData = `\nContent: ${allContent.length}, Generated: ${allContent.filter((c: any) => c.status === 'completed').length}`
      break
    }
    case 'operations': {
      metrics.departmentSpecific.jobBacklog = deptJobs.filter((j) => j.status === 'pending').length
      deptData = `\nJob backlog: ${metrics.departmentSpecific.jobBacklog}, Running: ${deptJobs.filter((j) => j.status === 'running').length}`
      break
    }
    case 'finance': {
      const { data: invoices } = await supabase.from('invoices').select('*').eq('user_id', userId).limit(20)
      const allInvoices = (invoices ?? []) as any[]
      metrics.departmentSpecific.invoiceCount = allInvoices.length
      metrics.departmentSpecific.overdueInvoices = allInvoices.filter((i: any) => i.status === 'overdue').length
      deptData = `\nInvoices: ${allInvoices.length}, Overdue: ${allInvoices.filter((i: any) => i.status === 'overdue').length}`
      break
    }
  }

  const text = `=== ${dept.toUpperCase()} DEPARTMENT STATUS ===
Jobs: ${deptJobs.length} (${deptJobs.filter((j) => j.status === 'pending').length} pending, ${deptJobs.filter((j) => j.status === 'running').length} running)
Failed: ${metrics.failedJobs}
Pending tasks: ${pendingTasks.length}
Completed today: ${completedToday.length}
${deptData}`

  return { text, metrics }
}

export async function runManagerAssessment(
  supabase: SupabaseClient,
  userId: string,
  dept: DepartmentType
): Promise<ManagerReport> {
  const { text: departmentState, metrics } = await gatherDepartmentState(supabase, userId, dept)
  const systemPrompt = DEPARTMENT_SYSTEM_PROMPTS[dept]

  const result = await executeAgentTask(supabase, userId, null, departmentState, { systemPrompt })

  let parsed: any = { summary: '', insights: [], actions: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response || 'Assessment completed' }

  const decisions: ManagerDecision[] = []
  for (const a of (parsed.actions || [])) {
    try {
      let decisionResult: string | undefined
      switch (a.type) {
        case 'create_task': {
          // Find an employee in this department to assign the task to
          const { data: deptAgents } = await supabase
            .from('agents')
            .select('id, name')
            .eq('user_id', userId)
            .eq('department', dept)
            .order('performance_score', { ascending: false })
            .limit(1)

          if (deptAgents && deptAgents.length > 0) {
            await assignTaskToEmployee(supabase, userId, deptAgents[0].id, a.description.slice(0, 120), a.description)
            decisionResult = `Task assigned to ${deptAgents[0].name}`
          } else {
            await supabase.from('orchestrator_tasks').insert([{
              user_id: userId, title: a.description.slice(0, 120),
              description: a.description, status: 'pending', priority: a.priority || 'medium',
            }])
            decisionResult = 'Task created (unassigned)'
          }
          break
        }
        case 'launch_workflow':
          await enqueueJob(supabase, userId, 'workflow_execution', {
            input: a.description, workflow_id: 'agency-growth',
          })
          decisionResult = 'Workflow enqueued'
          break
        case 'create_content':
          await supabase.from('content_requests').insert([{
            user_id: userId, title: a.description.slice(0, 120),
            description: a.description, content_type: 'blog', status: 'draft',
          }])
          decisionResult = 'Content request created'
          break
        case 'enqueue_job':
          await enqueueJob(supabase, userId, 'agent_execution', {
            prompt: a.description, systemPrompt: `Execute this task as a ${dept} department agent.`,
          })
          decisionResult = 'Job enqueued'
          break
      }
      decisions.push({ type: a.type, description: a.description, priority: a.priority || 'medium', executed: true, result: decisionResult })
      await logManagerAction(supabase, userId, dept, `Decision: ${a.type}`, a.description.slice(0, 100))
    } catch (err: any) {
      decisions.push({ type: a.type, description: a.description, priority: a.priority || 'medium', executed: false, result: err.message })
    }
  }

  // Store in Company Brain
  await storeMemory(supabase, userId, {
    category: 'manager_assessment',
    content: { department: dept, summary: parsed.summary, insights: parsed.insights || [], decisions: decisions.map((d) => ({ type: d.type, description: d.description })), metrics },
    tags: [dept, 'manager_assessment'],
  })

  await logManagerAction(supabase, userId, dept, 'Assessment completed', `${(parsed.insights || []).length} insights, ${decisions.length} decisions`)

  return { department: dept, summary: parsed.summary || '', decisions, metrics, generatedAt: new Date().toISOString() }
}

export async function getAllManagerReports(supabase: SupabaseClient, userId: string): Promise<ManagerReport[]> {
  const reports: ManagerReport[] = []
  for (const dept of listDepartments()) {
    const report = await getLatestManagerReport(supabase, userId, dept)
    if (report) reports.push(report)
  }
  return reports
}

export async function getLatestManagerReport(supabase: SupabaseClient, userId: string, dept: DepartmentType): Promise<ManagerReport | null> {
  const { data } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'manager_assessment')
    .contains('tags', [dept])
    .order('created_at', { ascending: false })
    .limit(1)

  const rows = (data ?? []) as any[]
  if (!rows.length) return null

  const m = rows[0].content
  return {
    department: dept,
    summary: m.summary || '',
    decisions: (m.decisions || []).map((d: any) => ({ ...d, executed: true, priority: 'medium' })),
    metrics: m.metrics || {},
    generatedAt: rows[0].created_at,
  }
}

export async function getManagerStats(supabase: SupabaseClient, userId: string): Promise<Record<DepartmentType, { totalRuns: number; lastRun: string | null }>> {
  const stats: any = {}
  for (const dept of listDepartments()) {
    const { count } = await supabase
      .from('agent_memory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category', 'manager_assessment')
      .contains('tags', [dept])

    const { data: last } = await supabase
      .from('agent_memory')
      .select('created_at')
      .eq('user_id', userId)
      .eq('category', 'manager_assessment')
      .contains('tags', [dept])
      .order('created_at', { ascending: false })
      .limit(1)

    stats[dept] = { totalRuns: count || 0, lastRun: (last as any)?.[0]?.created_at || null }
  }
  return stats
}
