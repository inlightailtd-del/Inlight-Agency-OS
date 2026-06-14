import type { NightShiftGoal, NightShiftReport, NightShiftResult } from './types'
import { DevLoopV3 } from '@/lib/dev-v3'

export class NightShiftEngine {
  private supabase: any
  private userId: string
  constructor(supabase: any, userId: string) { this.supabase = supabase; this.userId = userId }

  async enqueue(objective: string, priority = 5, category = 'general', tags: string[] = []): Promise<NightShiftGoal> {
    const { data } = await this.supabase.from('night_shift_goals').insert([{ user_id: this.userId, objective, priority, category, tags, status: 'queued', max_retries: 2 }]).select('*').single()
    return this.mapGoal(data)
  }

  async enqueueBatch(objectives: { objective: string; priority?: number; category?: string; tags?: string[] }[]): Promise<number> {
    const batch = objectives.map(o => ({ user_id: this.userId, objective: o.objective, priority: o.priority || 5, category: o.category || 'general', tags: o.tags || [], status: 'queued', max_retries: 2 }))
    const { count } = await this.supabase.from('night_shift_goals').insert(batch).select('', { count: 'exact', head: true })
    return count || 0
  }

  async getNext(): Promise<NightShiftGoal | null> {
    const { data } = await this.supabase.from('night_shift_goals').select('*').eq('user_id', this.userId).eq('status', 'queued').order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(1).maybeSingle()
    return data ? this.mapGoal(data) : null
  }

  async listQueued(limit = 20): Promise<NightShiftGoal[]> {
    const { data } = await this.supabase.from('night_shift_goals').select('*').eq('user_id', this.userId).eq('status', 'queued').order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(limit)
    return (data || []).map((d: any) => this.mapGoal(d))
  }

  async getHistory(limit = 20): Promise<NightShiftGoal[]> {
    const { data } = await this.supabase.from('night_shift_goals').select('*').eq('user_id', this.userId).neq('status', 'queued').order('completed_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(limit)
    return (data || []).map((d: any) => this.mapGoal(d))
  }

  async updateStatus(id: string, status: string, extra: Record<string, any> = {}) {
    const update: any = { status, ...extra }
    if (status === 'running') update.started_at = new Date().toISOString()
    if (['completed', 'failed', 'skipped'].includes(status)) update.completed_at = new Date().toISOString()
    await this.supabase.from('night_shift_goals').update(update).eq('id', id)
  }

  async runCycle(maxDurationMs = 120000): Promise<NightShiftGoal | null> {
    const goal = await this.getNext(); if (!goal) return null
    await this.updateStatus(goal.id!, 'running')
    try {
      const result = await Promise.race([new DevLoopV3(this.supabase, this.userId).run(goal.objective), new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), maxDurationMs))])
      const success = result.status === 'completed' || (result.status === 'failed' && result.errors.length <= 2)
      await this.updateStatus(goal.id!, success ? 'completed' : 'failed', { result_summary: result.summary, result_data: { phases: result.phases?.length, commits: result.commits, qualityScore: result.qualityScore, durationMs: Date.now() }, error_message: success ? null : result.errors.join('; ') })
      if (!success && goal.retryCount < goal.maxRetries) await this.updateStatus(goal.id!, 'queued', { retry_count: goal.retryCount + 1 })
    } catch (e: any) {
      await this.updateStatus(goal.id!, 'failed', { error_message: e.message })
      if (goal.retryCount < goal.maxRetries) await this.updateStatus(goal.id!, 'queued', { retry_count: goal.retryCount + 1 })
    }
    return goal
  }

  async generateReport(): Promise<NightShiftReport> {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const { data: goals } = await this.supabase.from('night_shift_goals').select('*').eq('user_id', this.userId).gte('created_at', startOfDay.toISOString())
    const items = (goals || []).map((d: any) => this.mapGoal(d))
    const completed = items.filter((g: NightShiftGoal) => g.status === 'completed')
    const failed = items.filter((g: NightShiftGoal) => g.status === 'failed')
    const skipped = items.filter((g: NightShiftGoal) => g.status === 'skipped')

    const { data: results } = await this.supabase.from('night_shift_goals').select('result_data').eq('user_id', this.userId).eq('status', 'completed').order('created_at', { ascending: false }).limit(10)
    const scores = (results || []).map((r: any) => (r.result_data || r.resultData)?.qualityScore).filter(Boolean)
    const qualityScore = scores.length ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10 : 0

    const suggestedNext: string[] = []
    const topIssues: string[] = []
    for (const f of failed) { if (f.objective) suggestedNext.push('Retry: ' + f.objective.substring(0, 80)); if (f.errorMessage) topIssues.push(f.errorMessage.substring(0, 100)) }
    if (completed.length > 0 && qualityScore < 7) suggestedNext.push('Quality improvement')
    suggestedNext.push('Review failed tasks', 'Check architecture graph')

    const report: NightShiftReport = { reportDate: startOfDay.toISOString().split('T')[0], period: 'night', totalGoals: items.length, completedGoals: completed.length, failedGoals: failed.length, skippedGoals: skipped.length, totalPhases: 0, totalCommits: 0, totalErrors: failed.length, totalDurationSeconds: 0, qualityScore, summary: completed.length + '/' + items.length + ' goals | Quality: ' + qualityScore + '/10', topIssues: topIssues.slice(0, 10), suggestedNext: [...new Set(suggestedNext)].slice(0, 10), lessons: items.filter((g: NightShiftGoal) => g.status === 'failed').map((g: NightShiftGoal) => ({ objective: (g.objective || '').substring(0, 100), error: (g.errorMessage || '').substring(0, 200) })) }
    await this.supabase.from('night_shift_reports').insert([{ user_id: this.userId, report_date: report.reportDate, period: report.period, total_goals: report.totalGoals, completed_goals: report.completedGoals, failed_goals: report.failedGoals, skipped_goals: report.skippedGoals, total_phases: report.totalPhases, total_commits: report.totalCommits, total_errors: report.totalErrors, total_duration_seconds: report.totalDurationSeconds, quality_score: report.qualityScore, summary: report.summary, top_issues: report.topIssues, suggested_next: report.suggestedNext, lessons: report.lessons }])
    return report
  }

  async getLatestReport(): Promise<NightShiftReport | null> {
    const { data } = await this.supabase.from('night_shift_reports').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    return data ? this.mapReport(data) : null
  }

  async getReportHistory(limit = 10): Promise<NightShiftReport[]> {
    const { data } = await this.supabase.from('night_shift_reports').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }).limit(limit)
    return (data || []).map((d: any) => this.mapReport(d))
  }

  async getSchedule(): Promise<{ isActive: boolean; intervalMinutes: number; maxCycles: number }> {
    const { data } = await this.supabase.from('night_shift_schedule').select('*').eq('user_id', this.userId).limit(1).maybeSingle()
    if (!data) { await this.supabase.from('night_shift_schedule').insert([{ user_id: this.userId, is_active: true, interval_minutes: 60, max_cycles: 10 }]); return { isActive: true, intervalMinutes: 60, maxCycles: 10 } }
    return { isActive: data.is_active, intervalMinutes: data.interval_minutes, maxCycles: data.max_cycles }
  }

  async updateSchedule(config: { isActive?: boolean; intervalMinutes?: number; maxCycles?: number }) {
    const c = await this.getSchedule()
    await this.supabase.from('night_shift_schedule').update({ is_active: config.isActive ?? c.isActive, interval_minutes: config.intervalMinutes ?? c.intervalMinutes, max_cycles: config.maxCycles ?? c.maxCycles, updated_at: new Date().toISOString() }).eq('user_id', this.userId)
  }

  async bulkRun(maxCycles = 10, perCycleTimeout = 120000): Promise<NightShiftResult> {
    const startTime = Date.now(); let cycles = 0, completed = 0, failed = 0, skipped = 0, totalPhases = 0, totalCommits = 0, totalErrors = 0; const errors: string[] = []
    for (let i = 0; i < maxCycles; i++) {
      const goal = await this.getNext(); if (!goal) break; cycles++
      const result = await this.runCycle(perCycleTimeout)
      if (result?.status === 'completed') { completed++ } else if (result?.status === 'failed') { failed++; totalErrors++; errors.push((result.objective || '').substring(0, 60) + ': ' + (result.errorMessage || '').substring(0, 100)) } else skipped++
    }
    const report = cycles > 0 ? await this.generateReport() : null
    return { cycleCount: cycles, goalsCompleted: completed, goalsFailed: failed, goalsSkipped: skipped, totalPhases, totalCommits, totalErrors, totalDurationMs: Date.now() - startTime, report, errors, summary: cycles + ' cycles | ' + completed + ' ok | ' + failed + ' fail' }
  }

  private mapGoal(d: any): NightShiftGoal { return { id: d.id, objective: d.objective, priority: d.priority, category: d.category, status: d.status, tags: d.tags || [], maxRetries: d.max_retries || 2, retryCount: d.retry_count || 0, scheduledFor: d.scheduled_for, resultSummary: d.result_summary, resultData: d.result_data, errorMessage: d.error_message } }
  private mapReport(d: any): NightShiftReport { return { id: d.id, reportDate: d.report_date, period: d.period, totalGoals: d.total_goals, completedGoals: d.completed_goals, failedGoals: d.failed_goals, skippedGoals: d.skipped_goals, totalPhases: d.total_phases, totalCommits: d.total_commits, totalErrors: d.total_errors, totalDurationSeconds: d.total_duration_seconds, qualityScore: d.quality_score, summary: d.summary, topIssues: d.top_issues || [], suggestedNext: d.suggested_next || [], lessons: d.lessons || [] } }
}
