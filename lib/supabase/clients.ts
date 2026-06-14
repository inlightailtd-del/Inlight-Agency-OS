import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const clientStatuses = ['active', 'inactive', 'prospect'] as const
export const clientStatusOptions = ['all', ...clientStatuses] as const

export type ClientStatus = (typeof clientStatuses)[number]
export type ClientListStatus = (typeof clientStatusOptions)[number]

export const clientFormSchema = z.object({
  name: z.string().min(1),
  status: z.enum(clientStatuses).default('active'),
  industry: z.string().trim().optional().nullable().transform((value) => value || null),
  phone: z.string().trim().optional().nullable().transform((value) => value || null),
  email: z.string().trim().optional().nullable().transform((value) => value || null),
  website: z.string().trim().optional().nullable().transform((value) => value || null),
  city: z.string().trim().optional().nullable().transform((value) => value || null),
  monthly_retainer: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) return null
      return value
    }),
  currency: z.string().trim().optional().default('PKR'),
  notes: z.string().trim().optional().nullable().transform((value) => value || null),
  health_score: z
    .string()
    .trim()
    .optional()
    .default('50')
    .transform((value) => {
      const parsed = Number(value)
      if (Number.isNaN(parsed)) return 50
      return Math.min(100, Math.max(0, parsed))
    }),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>

export type ClientRow = {
  id: string
  user_id: string
  name: string
  industry: string | null
  status: ClientStatus
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  website: string | null
  notes: string | null
  monthly_retainer: string | null
  currency: string | null
  tags: string[] | null
  health_score: number
  created_at: string
  updated_at: string
}

export function getStatusLabel(status: ClientListStatus | ClientStatus) {
  if (status === 'all') return 'All'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function getHealthLabel(score: number) {
  if (score >= 80) return 'Excellent'
  if (score >= 50) return 'Stable'
  if (score >= 30) return 'Needs attention'
  return 'At risk'
}

export function getHealthColor(score: number) {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  if (score >= 30) return 'bg-orange-500'
  return 'bg-red-500'
}

function sanitizeSearchQuery(searchQuery: string) {
  return searchQuery.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function fetchClients(
  supabase: SupabaseClient,
  searchQuery?: string,
  status?: ClientListStatus
) {
  let query = supabase.from('clients').select('*').order('created_at', { ascending: false })

  if (searchQuery) {
    const escaped = sanitizeSearchQuery(searchQuery)
    query = query.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ClientRow[]
}

export async function fetchClientById(
  supabase: SupabaseClient,
  clientId: string
) {
  const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single()
  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }
  return data as ClientRow
}

export async function fetchContactsForClient(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Array<any>
}

export async function fetchInteractionsForClient(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })

  if (error) throw error
  return (data ?? []) as Array<any>
}

export async function fetchActivityForClient(supabase: SupabaseClient, clientId: string) {
  // Simple aggregated activity log: recent interactions + contact changes
  const interactions = await fetchInteractionsForClient(supabase, clientId)
  const { data: contacts } = await supabase
    .from('contacts')
    .select("id, name, created_at")
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  const contactActivities = (contacts ?? []).map((c: any) => ({
    type: 'contact_created',
    title: `Contact ${c.name} added`,
    date: c.created_at,
    meta: { contactId: c.id },
  }))

  const interactionActivities = (interactions ?? []).map((i: any) => ({
    type: 'interaction',
    title: i.subject || i.type,
    notes: i.notes,
    date: i.date,
    meta: { interactionId: i.id },
  }))

  const combined = [...contactActivities, ...interactionActivities].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  return combined
}
