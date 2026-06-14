import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const commandStatuses = ['pending', 'processing', 'completed', 'failed'] as const
export const commandCategories = ['content', 'research', 'sales', 'seo', 'analysis', 'operations', 'general'] as const
export const executionModules = ['clients', 'projects', 'tasks', 'milestones', 'finance', 'brain', 'agents', 'automations'] as const

export type CommandStatus = (typeof commandStatuses)[number]
export type ExecutionStatus = 'success' | 'failed' | 'warning'

export const commandFormSchema = z.object({
  command: z.string().min(1, 'Enter a command'),
  category: z.enum(commandCategories).optional().default('general'),
  agent_id: z.string().uuid().optional().nullable().transform((v) => v || null),
  automation_id: z.string().uuid().optional().nullable().transform((v) => v || null),
})

export type CommandRow = {
  id: string; user_id: string; command: string; response: string | null
  status: CommandStatus; category: string | null; agent_id: string | null
  automation_id: string | null; execution_time_ms: number | null; created_at: string
}

export type ExecutionLogRow = {
  id: string; user_id: string; command_id: string; action: string; module: string | null
  entity_type: string | null; entity_id: string | null; result: Record<string, any> | null
  status: ExecutionStatus; message: string | null; duration_ms: number | null; created_at: string
}

export function getStatusVariant(s: CommandStatus): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<CommandStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'info', processing: 'warning', completed: 'success', failed: 'destructive'
  }
  return map[s] ?? 'default'
}
export function getCategoryLabel(c: string): string {
  const m: Record<string, string> = { content: 'Content', research: 'Research', sales: 'Sales', seo: 'SEO', analysis: 'Analysis', operations: 'Operations', general: 'General' }
  return m[c] ?? c
}

function sanitize(s: string) { return s.replace(/%/g, '\\%').replace(/_/g, '\\_') }

export async function fetchCommands(supabase: SupabaseClient, searchQuery?: string, status?: string): Promise<CommandRow[]> {
  let query = supabase.from('commands').select('*').order('created_at', { ascending: false })
  if (searchQuery) { const esc = sanitize(searchQuery); query = query.ilike('command', `%${esc}%`) }
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query; if (error) throw error
  return (data ?? []) as CommandRow[]
}
export async function fetchCommandById(supabase: SupabaseClient, id: string): Promise<CommandRow | null> {
  const { data, error } = await supabase.from('commands').select('*').eq('id', id).single()
  if (error) { if ((error as any).code === 'PGRST116') return null; throw error }
  return data as CommandRow
}
export async function fetchExecutionLogs(supabase: SupabaseClient, commandId?: string): Promise<ExecutionLogRow[]> {
  let query = supabase.from('execution_logs').select('*').order('created_at', { ascending: false }).limit(100)
  if (commandId) query = query.eq('command_id', commandId)
  const { data, error } = await query; if (error) throw error
  return (data ?? []) as ExecutionLogRow[]
}
export async function createCommand(supabase: SupabaseClient, userId: string, params: { command: string; category?: string; agent_id?: string | null; automation_id?: string | null }) {
  const { data, error } = await supabase.from('commands').insert([{ ...params, user_id: userId }])
  if (error) throw error
  return data
}
export async function updateCommand(supabase: SupabaseClient, id: string, patch: Record<string, any>) {
  const { data, error } = await supabase.from('commands').update(patch).eq('id', id)
  if (error) throw error; return data
}
export async function createExecutionLog(supabase: SupabaseClient, userId: string, params: { command_id: string; action: string; module?: string | null; entity_type?: string | null; entity_id?: string | null; result?: any; status?: string; message?: string | null; duration_ms?: number | null }) {
  const { data, error } = await supabase.from('execution_logs').insert([{ ...params, user_id: userId }])
  if (error) throw error; return data
}
export async function getSystemStats(supabase: SupabaseClient) {
  const now = new Date().toISOString()
  const today = now.substring(0, 10)
  const [{ count: totalCommands }, { count: todayCommands }, { count: activeAgents }, { count: activeAutomations }] = await Promise.all([
    supabase.from('commands').select('*', { count: 'exact', head: true }),
    supabase.from('commands').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('automations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])
  return { totalCommands, todayCommands, activeAgents, activeAutomations }
}