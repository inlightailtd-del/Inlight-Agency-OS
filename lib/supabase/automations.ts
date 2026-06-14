import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const automationCategories = ['lead_gen', 'support', 'social_media', 'content', 'seo', 'email', 'whatsapp', 'sales', 'crm', 'internal'] as const
export const automationStatuses = ['active', 'paused', 'draft', 'failed'] as const
export const triggerTypes = ['manual', 'scheduled', 'webhook', 'event'] as const

export type AutomationCategory = (typeof automationCategories)[number]
export type AutomationStatus = (typeof automationStatuses)[number]

export const automationFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().trim().optional().nullable().transform((v) => v || null),
  category: z.enum(automationCategories).default('internal'),
  status: z.enum(automationStatuses).default('draft'),
  trigger_type: z.enum(triggerTypes).default('manual'),
  schedule_cron: z.string().trim().optional().nullable().transform((v) => v || null),
  performance_score: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
})

export type AutomationRow = {
  id: string; user_id: string; name: string; description: string | null
  category: AutomationCategory; status: AutomationStatus; trigger_type: string
  schedule_cron: string | null; total_runs: number; success_runs: number; failed_runs: number
  last_run_at: string | null; performance_score: number; config: Record<string, any> | null
  created_at: string; updated_at: string | null
}

export type AutomationRun = {
  id: string; automation_id: string; status: string; started_at: string
  completed_at: string | null; duration_ms: number | null; result: any; error_msg: string | null
  triggered_by: string
}

export function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = { lead_gen: 'Lead Generation', support: 'Customer Support', social_media: 'Social Media', content: 'Content Creation', seo: 'SEO', email: 'Email Marketing', whatsapp: 'WhatsApp Automation', sales: 'Sales Automation', crm: 'CRM Automation', internal: 'Internal Operations' }
  return map[cat] ?? cat
}
export function getStatusVariant(s: AutomationStatus): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<AutomationStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = { active: 'success', paused: 'warning', draft: 'default', failed: 'destructive' }
  return map[s] ?? 'default'
}
function sanitize(s: string) { return s.replace(/%/g, '\\%').replace(/_/g, '\\_') }

export async function fetchAutomations(supabase: SupabaseClient, searchQuery?: string, category?: string, status?: string): Promise<AutomationRow[]> {
  let query = supabase.from('automations').select('*').order('updated_at', { ascending: false })
  if (searchQuery) { const esc = sanitize(searchQuery); query = query.or(`name.ilike.%${esc}%,description.ilike.%${esc}%`) }
  if (category && category !== 'all') query = query.eq('category', category)
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query; if (error) throw error
  return (data ?? []) as AutomationRow[]
}
export async function fetchAutomationById(supabase: SupabaseClient, id: string): Promise<AutomationRow | null> {
  const { data, error } = await supabase.from('automations').select('*').eq('id', id).single()
  if (error) { if ((error as any).code === 'PGRST116') return null; throw error }
  return data as AutomationRow
}
export async function fetchAutomationRuns(supabase: SupabaseClient, automationId: string): Promise<AutomationRun[]> {
  const { data, error } = await supabase.from('automation_runs').select('*').eq('automation_id', automationId).order('started_at', { ascending: false }).limit(50)
  if (error) throw error; return (data ?? []) as AutomationRun[]
}
export async function createAutomation(supabase: SupabaseClient, userId: string, params: { name: string; description?: string | null; category?: string; status?: string; trigger_type?: string; schedule_cron?: string | null }) {
  const { data, error } = await supabase.from('automations').insert([{ ...params, user_id: userId }]); if (error) throw error; return data
}
export async function updateAutomation(supabase: SupabaseClient, id: string, patch: Record<string, any>) {
  patch.updated_at = new Date().toISOString(); const { data, error } = await supabase.from('automations').update(patch).eq('id', id); if (error) throw error; return data
}
export async function deleteAutomation(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('automations').delete().eq('id', id); if (error) throw error
}