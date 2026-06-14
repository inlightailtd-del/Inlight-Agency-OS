import type { SupabaseClient } from '@supabase/supabase-js'

export type ScheduledTask = 'content_generation' | 'publishing' | 'lead_gen' | 'email_outreach' | 'kpi_report'

export interface ScheduleConfig {
  enabled: boolean
  contentGeneration: boolean
  contentTime: string
  publishing: boolean
  publishingTime: string
  leadGen: boolean
  leadGenTime: string
  emailOutreach: boolean
  emailTime: string
  kpiReport: boolean
  reportTime: string
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: true,
  contentGeneration: true, contentTime: '06:00',
  publishing: true, publishingTime: '08:00',
  leadGen: true, leadGenTime: '09:00',
  emailOutreach: true, emailTime: '10:00',
  kpiReport: true, reportTime: '23:00',
}

const getSettings = (supabase: SupabaseClient) => supabase ? supabase : null

export async function getSchedule(supabase: SupabaseClient, userId: string): Promise<ScheduleConfig> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('user_id', userId)
      .eq('key', 'execution_schedule')
      .limit(1)
    if (data && data.length > 0) {
      const saved = (data[0] as any).value as Partial<ScheduleConfig>
      return { ...DEFAULT_SCHEDULE, ...saved }
    }
  } catch { /* use defaults */ }
  return DEFAULT_SCHEDULE
}

export async function saveSchedule(supabase: SupabaseClient, userId: string, config: ScheduleConfig): Promise<void> {
  await supabase
    .from('settings')
    .upsert({ user_id: userId, key: 'execution_schedule', value: config as any },
      { onConflict: 'user_id, key' })
}

export function shouldRun(hourMin: string): boolean {
  const now = new Date()
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (current === hourMin) return true
  // Allow a 5-minute window
  const [cH, cM] = current.split(':').map(Number)
  const [tH, tM] = hourMin.split(':').map(Number)
  const cMin = cH * 60 + cM
  const tMin = tH * 60 + tM
  return cMin >= tMin && cMin <= tMin + 5
}

export async function runScheduledTasks(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const executed: string[] = []
  const schedule = await getSchedule(supabase, userId)
  if (!schedule.enabled) return executed

  if (schedule.contentGeneration && shouldRun(schedule.contentTime)) {
    executed.push('content_generation')
  }
  if (schedule.publishing && shouldRun(schedule.publishingTime)) {
    executed.push('publishing')
  }
  if (schedule.leadGen && shouldRun(schedule.leadGenTime)) {
    executed.push('lead_gen')
  }
  if (schedule.emailOutreach && shouldRun(schedule.emailTime)) {
    executed.push('email_outreach')
  }
  if (schedule.kpiReport && shouldRun(schedule.reportTime)) {
    executed.push('kpi_report')
  }

  return executed
}
