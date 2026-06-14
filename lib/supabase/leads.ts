import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const leadSources = ['website', 'linkedin', 'facebook', 'google_maps', 'manual'] as const
export const leadStatuses = ['new', 'contacted', 'qualified', 'proposal', 'converted', 'lost'] as const
export type LeadStatus = (typeof leadStatuses)[number]

export const leadFormSchema = z.object({
  name: z.string().min(1, 'Name required'),
  company: z.string().trim().optional().nullable().transform((v) => v || null),
  website: z.string().trim().optional().nullable().transform((v) => v || null),
  email: z.string().trim().optional().nullable().transform((v) => v || null),
  phone: z.string().trim().optional().nullable().transform((v) => v || null),
  industry: z.string().trim().optional().nullable().transform((v) => v || null),
  country: z.string().trim().optional().nullable().transform((v) => v || null),
  source: z.enum(leadSources).default('manual'),
  status: z.enum(leadStatuses).default('new'),
  score: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  notes: z.string().trim().optional().nullable().transform((v) => v || null),
  tags: z.string().trim().optional().nullable().transform((v) => v || null),
})

export type LeadRow = {
  id: string; user_id: string; name: string; company: string | null; website: string | null
  email: string | null; phone: string | null; industry: string | null; country: string | null
  source: string; status: LeadStatus; score: number; notes: string | null; tags: string[] | null
  converted_client_id: string | null; created_at: string; updated_at: string | null
}

export function getSourceLabel(s: string): string {
  return { website: 'Website', linkedin: 'LinkedIn', facebook: 'Facebook', google_maps: 'Google Maps', manual: 'Manual' }[s] ?? s
}
export function getStatusVariant(s: LeadStatus): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const m: Record<LeadStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    new: 'info', contacted: 'default', qualified: 'success', proposal: 'warning', converted: 'success', lost: 'destructive',
  }
  return m[s]
}
export function getStatusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function sanitize(s: string) { return s.replace(/%/g, '\\%').replace(/_/g, '\\_') }

export async function fetchLeads(supabase: SupabaseClient, searchQuery?: string, status?: string, source?: string): Promise<LeadRow[]> {
  let q = supabase.from('leads').select('*').order('created_at', { ascending: false })
  if (searchQuery) { const esc = sanitize(searchQuery); q = q.or(`name.ilike.%${esc}%,company.ilike.%${esc}%,email.ilike.%${esc}%`) }
  if (status && status !== 'all') q = q.eq('status', status)
  if (source && source !== 'all') q = q.eq('source', source)
  const { data, error } = await q; if (error) throw error; return (data ?? []) as LeadRow[]
}
export async function fetchLeadById(supabase: SupabaseClient, id: string): Promise<LeadRow | null> {
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).single()
  if (error) { if ((error as any).code === 'PGRST116') return null; throw error }; return data as LeadRow
}
export async function createLead(supabase: SupabaseClient, userId: string, params: Record<string, any>) {
  const tagsArray = params.tags ? params.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
  const { data, error } = await supabase.from('leads').insert([{ ...params, user_id: userId, tags: tagsArray }]); if (error) throw error; return data
}
export async function updateLead(supabase: SupabaseClient, id: string, patch: Record<string, any>) {
  if (patch.tags && typeof patch.tags === 'string') patch.tags = patch.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
  const { data, error } = await supabase.from('leads').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; return data
}
export async function deleteLead(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('leads').delete().eq('id', id); if (error) throw error
}