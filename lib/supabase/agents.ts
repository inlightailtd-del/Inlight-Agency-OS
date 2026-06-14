import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const agentTypes = ['general', 'ceo', 'sales', 'marketing', 'content', 'seo', 'research', 'support', 'developer', 'automation', 'finance'] as const
export const agentStatuses = ['active', 'idle', 'busy', 'offline'] as const
export const agentDepartments = ['sales', 'marketing', 'design', 'development', 'hr', 'admin'] as const

export type AgentType = (typeof agentTypes)[number]
export type AgentStatus = (typeof agentStatuses)[number]
export type AgentDepartment = (typeof agentDepartments)[number]

export const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().trim().optional().nullable().transform((v) => v || null),
  type: z.enum(agentTypes).default('general'),
  role: z.string().trim().optional().nullable().transform((v) => v || null),
  status: z.enum(agentStatuses).default('offline'),
  department: z.enum(agentDepartments).optional().nullable().transform((v) => v || null),
  performance_score: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  assigned_tasks: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  assigned_projects: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  total_executions: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  success_rate: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  avg_response_time_ms: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
})

export type AgentRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  type: AgentType
  role: string | null
  status: AgentStatus
  department: string | null
  assigned_tasks: number
  assigned_projects: number
  performance_score: number
  total_executions: number
  success_rate: number
  avg_response_time_ms: number
  tasks_completed: number
  level: number
  promoted_at: string | null
  skills: string[]
  specialization: string | null
  training_count: number
  last_trained_at: string | null
  hired_at: string | null
  retired_at: string | null
  config: Record<string, any> | null
  last_active_at: string | null
  created_at: string
  updated_at: string | null
}

export function getAgentTypeLabel(type: string): string {
  const map: Record<string, string> = {
    ceo: 'CEO Agent', sales: 'Sales Agent', marketing: 'Marketing Agent',
    content: 'Content Agent', seo: 'SEO Agent', research: 'Research Agent',
    support: 'Customer Support', developer: 'Developer Agent',
    automation: 'Automation Agent', finance: 'Finance Agent', general: 'General',
  }
  return map[type] ?? type
}

export function getAgentStatusVariant(status: AgentStatus): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<AgentStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    active: 'success', idle: 'info', busy: 'warning', offline: 'default',
  }
  return map[status] ?? 'default'
}

export function getDepartmentLabel(dept: string | null): string {
  if (!dept) return '—'
  const m: Record<string, string> = { sales: 'Sales', marketing: 'Marketing', design: 'Design', development: 'Development', hr: 'HR', admin: 'Admin' }
  return m[dept] ?? dept
}

function sanitize(s: string) { return s.replace(/%/g, '\\%').replace(/_/g, '\\_') }

export async function fetchAgents(
  supabase: SupabaseClient, searchQuery?: string, type?: string, status?: string, department?: string
): Promise<AgentRow[]> {
  let query = supabase.from('agents').select('*').order('name', { ascending: true })
  if (searchQuery) { const esc = sanitize(searchQuery); query = query.or(`name.ilike.%${esc}%,description.ilike.%${esc}%`) }
  if (type && type !== 'all') query = query.eq('type', type)
  if (status && status !== 'all') query = query.eq('status', status)
  if (department && department !== 'all') query = query.eq('department', department)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AgentRow[]
}

export async function fetchAgentById(supabase: SupabaseClient, id: string): Promise<AgentRow | null> {
  const { data, error } = await supabase.from('agents').select('*').eq('id', id).single()
  if (error) { if ((error as any).code === 'PGRST116') return null; throw error }
  return data as AgentRow
}

export async function createAgent(
  supabase: SupabaseClient, userId: string,
  params: { name: string; description?: string | null; type?: string; role?: string | null; status?: string; department?: string | null; performance_score?: number; assigned_tasks?: number; assigned_projects?: number; total_executions?: number; success_rate?: number; avg_response_time_ms?: number }
) {
  const { data, error } = await supabase.from('agents').insert([{ ...params, user_id: userId }])
  if (error) throw error
  return data
}

export async function updateAgent(supabase: SupabaseClient, id: string, patch: Record<string, any>) {
  patch.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('agents').update(patch).eq('id', id)
  if (error) throw error
  return data
}

export async function deleteAgent(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('agents').delete().eq('id', id)
  if (error) throw error
}
