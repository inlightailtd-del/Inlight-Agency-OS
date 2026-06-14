import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const orchTaskStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'failed'] as const
export const orchPriorities = ['low', 'medium', 'high', 'critical'] as const

export type OrchTaskStatus = (typeof orchTaskStatuses)[number]

export const orchTaskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().trim().optional().nullable().transform((v) => v || null),
  agent_id: z.string().uuid().optional().nullable().transform((v) => v || null),
  status: z.enum(orchTaskStatuses).default('pending'),
  priority: z.enum(orchPriorities).default('medium'),
})

export const agentMessageFormSchema = z.object({
  from_agent_id: z.string().uuid('Sender is required'),
  to_agent_id: z.string().uuid('Recipient is required'),
  message: z.string().min(1, 'Message is required'),
})

export type OrchTaskRow = {
  id: string; user_id: string; title: string; description: string | null
  agent_id: string | null; status: OrchTaskStatus; priority: string
  result: string | null; assigned_at: string | null; completed_at: string | null
  created_at: string; updated_at: string | null
}

export type AgentMessageRow = {
  id: string; user_id: string; from_agent_id: string; to_agent_id: string
  message: string; context: Record<string, any>; created_at: string
}

export type OrchTaskWithAgent = OrchTaskRow & { agent_name?: string | null; agent_type?: string | null }
export type AgentMessageWithNames = AgentMessageRow & { from_agent_name?: string | null; to_agent_name?: string | null }

export function getStatusVariant(s: OrchTaskStatus): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const m: Record<OrchTaskStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'info', assigned: 'default', in_progress: 'warning', completed: 'success', failed: 'destructive',
  }
  return m[s] ?? 'default'
}
export function getPriorityVariant(p: string): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  return { low: 'default', medium: 'info', high: 'warning', critical: 'destructive' }[p] as any || 'default'
}

function sanitize(s: string) { return s.replace(/%/g, '\\%').replace(/_/g, '\\_') }

export async function fetchOrchTasks(supabase: SupabaseClient, searchQuery?: string, status?: string): Promise<OrchTaskWithAgent[]> {
  let q = supabase.from('orchestrator_tasks').select('*, agents!orchestrator_tasks_agent_id_fkey(name, type)').order('created_at', { ascending: false })
  if (searchQuery) { const esc = sanitize(searchQuery); q = q.or(`title.ilike.%${esc}%,description.ilike.%${esc}%`) }
  if (status && status !== 'all') q = q.eq('status', status)
  const { data, error } = await q; if (error) throw error
  return ((data ?? []) as any[]).map((r) => ({ ...r, agent_name: r.agents?.name ?? null, agent_type: r.agents?.type ?? null })) as OrchTaskWithAgent[]
}

export async function fetchOrchTaskById(supabase: SupabaseClient, id: string): Promise<OrchTaskWithAgent | null> {
  const { data, error } = await supabase.from('orchestrator_tasks').select('*, agents!orchestrator_tasks_agent_id_fkey(name, type)').eq('id', id).single()
  if (error) { if ((error as any).code === 'PGRST116') return null; throw error }
  const row = data as any
  return { ...row, agent_name: row.agents?.name ?? null, agent_type: row.agents?.type ?? null } as OrchTaskWithAgent
}

export async function createOrchTask(supabase: SupabaseClient, userId: string, params: { title: string; description?: string | null; agent_id?: string | null; status?: string; priority?: string }) {
  const { data, error } = await supabase.from('orchestrator_tasks').insert([{ ...params, user_id: userId }]); if (error) throw error; return data
}
export async function updateOrchTask(supabase: SupabaseClient, id: string, patch: Record<string, any>) {
  const { data, error } = await supabase.from('orchestrator_tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error; return data
}
export async function deleteOrchTask(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('orchestrator_tasks').delete().eq('id', id); if (error) throw error
}

export async function fetchAgentMessages(supabase: SupabaseClient): Promise<AgentMessageWithNames[]> {
  const { data, error } = await supabase.from('agent_messages').select('*, from_agent:agents!agent_messages_from_agent_id_fkey(name), to_agent:agents!agent_messages_to_agent_id_fkey(name)').order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return ((data ?? []) as any[]).map((r) => ({ ...r, from_agent_name: r.from_agent?.name ?? null, to_agent_name: r.to_agent?.name ?? null })) as AgentMessageWithNames[]
}
export async function createAgentMessage(supabase: SupabaseClient, userId: string, params: { from_agent_id: string; to_agent_id: string; message: string }) {
  const { data, error } = await supabase.from('agent_messages').insert([{ ...params, user_id: userId }]); if (error) throw error; return data
}

export async function fetchOrchMemory(supabase: SupabaseClient): Promise<{ id: string; key: string; value: any; agent_id: string | null; updated_at: string }[]> {
  const { data, error } = await supabase.from('orchestrator_memory').select('*').order('updated_at', { ascending: false })
  if (error) throw error; return (data ?? []) as any[]
}
export async function setOrchMemory(supabase: SupabaseClient, userId: string, key: string, value: any, agent_id?: string | null) {
  const { data, error } = await supabase.from('orchestrator_memory').upsert([{ user_id: userId, key, value: JSON.parse(JSON.stringify(value)), agent_id: agent_id || null, updated_at: new Date().toISOString() }], { onConflict: 'user_id,key' })
  if (error) throw error; return data
}