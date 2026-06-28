import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { type KPI } from './types'

export const KPI_TEMPLATES: Record<string, { metric: string; target: number; weight: number }[]> = {
  sales: [
    { metric: 'deals_closed', target: 10, weight: 30 },
    { metric: 'revenue_generated', target: 50000, weight: 25 },
    { metric: 'leads_contacted', target: 100, weight: 15 },
    { metric: 'meetings_booked', target: 20, weight: 15 },
    { metric: 'response_time', target: 300, weight: 15 },
  ],
  marketing: [
    { metric: 'content_pieces', target: 15, weight: 25 },
    { metric: 'social_posts', target: 30, weight: 20 },
    { metric: 'leads_generated', target: 50, weight: 25 },
    { metric: 'engagement_rate', target: 5, weight: 15 },
    { metric: 'campaigns_launched', target: 3, weight: 15 },
  ],
  content: [
    { metric: 'articles_written', target: 10, weight: 30 },
    { metric: 'total_words', target: 15000, weight: 20 },
    { metric: 'content_approved', target: 8, weight: 25 },
    { metric: 'seo_score', target: 70, weight: 25 },
  ],
  operations: [
    { metric: 'tasks_completed', target: 50, weight: 30 },
    { metric: 'automations_built', target: 5, weight: 25 },
    { metric: 'queue_items_processed', target: 100, weight: 25 },
    { metric: 'uptime_percent', target: 99, weight: 20 },
  ],
  development: [
    { metric: 'features_shipped', target: 8, weight: 25 },
    { metric: 'bugs_fixed', target: 15, weight: 20 },
    { metric: 'code_reviews', target: 20, weight: 15 },
    { metric: 'deployments', target: 10, weight: 20 },
    { metric: 'test_coverage', target: 80, weight: 20 },
  ],
  finance: [
    { metric: 'invoices_processed', target: 30, weight: 25 },
    { metric: 'reports_generated', target: 10, weight: 20 },
    { metric: 'reconciliation_accuracy', target: 99, weight: 30 },
    { metric: 'expense_items', target: 50, weight: 25 },
  ],
}

export async function initializeKPIs(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  department: string
): Promise<KPI[]> {
  const template = KPI_TEMPLATES[department] || KPI_TEMPLATES.operations
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  const kpis: KPI[] = template.map((t, i) => ({
    id: `kpi_${Date.now()}_${i}`, employeeId, metric: t.metric,
    target: t.target, actual: 0, weight: t.weight,
    period: 'monthly', periodStart: monthStart, periodEnd: monthEnd,
    score: 0,
  }))

  const rows = kpis.map(k => ({
    user_id: userId, agent_id: employeeId, metric: k.metric,
    target: k.target, actual: 0, weight: k.weight,
    period: k.period, period_start: k.periodStart, period_end: k.periodEnd,
  }))

  await supabase.from('employee_kpis').insert(rows).maybeSingle()

  await storeMemory(supabase, userId, {
    category: 'employee_learning', tags: [employeeId, 'kpi_init'],
    content: { type: 'kpi_initialized', employeeId, department, kpis: kpis.map(k => ({ metric: k.metric, target: k.target, weight: k.weight })), initializedAt: new Date().toISOString() },
  })

  return kpis
}

export async function updateKPIMetric(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  metric: string,
  value: number
): Promise<KPI | null> {
  const { data: existing } = await supabase
    .from('employee_kpis')
    .select('*')
    .eq('agent_id', employeeId)
    .eq('metric', metric)
    .eq('period', 'monthly')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existing) {
    const { data: agent } = await supabase.from('agents').select('department').eq('id', employeeId).single()
    if (agent) await initializeKPIs(supabase, userId, employeeId, (agent as any).department || 'operations')
    return null
  }

  const row = existing as any
  const newActual = Math.min((row.actual || 0) + value, row.target * 2)
  const score = row.target > 0 ? Math.min(100, Math.round((newActual / row.target) * 100)) : 0

  await supabase.from('employee_kpis').update({
    actual: newActual, score,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)

  return {
    id: row.id, employeeId: row.agent_id, metric: row.metric,
    target: row.target, actual: newActual, weight: row.weight,
    period: row.period, periodStart: row.period_start,
    periodEnd: row.period_end, score,
  }
}

export async function getEmployeeKPIReport(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<{ kpis: KPI[]; overallScore: number; completedMetrics: number; totalMetrics: number }> {
  const { data: rows } = await supabase
    .from('employee_kpis')
    .select('*')
    .eq('agent_id', employeeId)
    .eq('period', 'monthly')
    .order('created_at', { ascending: true })

  const kpis: KPI[] = ((rows ?? []) as any[]).map(r => ({
    id: r.id, employeeId: r.agent_id, metric: r.metric,
    target: r.target, actual: r.actual || 0, weight: r.weight,
    period: r.period, periodStart: r.period_start,
    periodEnd: r.period_end, score: r.score || 0,
  }))

  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0)
  const overallScore = totalWeight > 0
    ? Math.round(kpis.reduce((s, k) => s + (k.score * k.weight / totalWeight), 0))
    : 0
  const completedMetrics = kpis.filter(k => k.actual >= k.target).length

  return { kpis, overallScore, completedMetrics, totalMetrics: kpis.length }
}

export async function getDepartmentKPIReport(
  supabase: SupabaseClient,
  userId: string,
  department: string
): Promise<{ employeeReports: { employeeId: string; employeeName: string; overallScore: number }[]; avgScore: number }> {
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name')
    .eq('user_id', userId)
    .eq('department', department)

  const reports: { employeeId: string; employeeName: string; overallScore: number }[] = []
  for (const agent of (agents ?? []) as any[]) {
    try {
      const report = await getEmployeeKPIReport(supabase, userId, agent.id)
      reports.push({ employeeId: agent.id, employeeName: agent.name, overallScore: report.overallScore })
    } catch { /* skip */ }
  }

  return {
    employeeReports: reports,
    avgScore: reports.length > 0 ? Math.round(reports.reduce((s, r) => s + r.overallScore, 0) / reports.length) : 0,
  }
}
