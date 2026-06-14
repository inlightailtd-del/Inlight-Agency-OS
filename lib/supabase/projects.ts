import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const projectStatuses = ['planning', 'active', 'paused', 'completed', 'cancelled'] as const
export const projectStatusOptions = ['all', ...projectStatuses] as const
export type ProjectStatus = (typeof projectStatuses)[number]
export type ProjectListStatus = (typeof projectStatusOptions)[number]

export const projectPriorities = ['low', 'medium', 'high', 'critical'] as const
export const serviceTypes = ['seo', 'social_media', 'paid_ads', 'web_dev', 'ai_automation', 'other'] as const
export type ProjectPriority = (typeof projectPriorities)[number]
export type ServiceType = (typeof serviceTypes)[number]

export const milestoneStatuses = ['pending', 'in_progress', 'completed', 'delayed'] as const
export type MilestoneStatus = (typeof milestoneStatuses)[number]

export const projectFormSchema = z.object({
  name: z.string().min(1),
  client_id: z.string().uuid().optional().nullable().transform((v) => v || null),
  description: z.string().trim().optional().nullable().transform((v) => v || null),
  status: z.enum(projectStatuses).default('planning'),
  priority: z.enum(projectPriorities).default('medium'),
  service_type: z.enum(serviceTypes).optional().nullable().transform((v) => v || null),
  start_date: z.string().optional().nullable().transform((v) => v || null),
  end_date: z.string().optional().nullable().transform((v) => v || null),
  budget: z.string().trim().optional().nullable().transform((v) => (v ? Number(v) : null)),
  actual_cost: z.string().trim().optional().nullable().transform((v) => (v ? Number(v) : null)),
  currency: z.string().trim().optional().default('PKR'),
  notes: z.string().trim().optional().nullable().transform((v) => v || null),
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

export type ProjectFormValues = z.infer<typeof projectFormSchema>

export type ProjectRow = {
  id: string
  user_id: string
  client_id: string | null
  name: string
  description: string | null
  status: ProjectStatus
  priority: string | null
  start_date: string | null
  end_date: string | null
  budget: number | null
  actual_cost: number | null
  currency: string | null
  service_type: string | null
  health: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProjectWithClient = ProjectRow & {
  client_name?: string | null
}

export type MilestoneRow = {
  id: string
  project_id: string
  name: string
  description: string | null
  status: MilestoneStatus
  due_date: string | null
  completed_at: string | null
  order_index: number
  created_at: string
}

// ---- Display helpers ----

export function getStatusLabel(status: ProjectListStatus | ProjectStatus): string {
  if (status === 'all') return 'All'
  const labels: Record<string, string> = {
    planning: 'Planning',
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return labels[status] ?? status
}

export function getStatusVariant(
  status: ProjectStatus
): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<ProjectStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    planning: 'info',
    active: 'success',
    paused: 'warning',
    completed: 'default',
    cancelled: 'destructive',
  }
  return map[status] ?? 'default'
}

export function getHealthLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 50) return 'Stable'
  if (score >= 30) return 'At risk'
  return 'Critical'
}

export function getHealthColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  if (score >= 30) return 'bg-orange-500'
  return 'bg-red-500'
}

export function getPriorityLabel(priority: string): string {
  return (priority ?? 'medium').charAt(0).toUpperCase() + (priority ?? 'medium').slice(1)
}

export function getPriorityVariant(priority: string): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    low: 'default',
    medium: 'info',
    high: 'warning',
    critical: 'destructive',
  }
  return map[priority] ?? 'default'
}

export function getServiceTypeLabel(type: string | null): string {
  if (!type) return '—'
  const labels: Record<string, string> = {
    seo: 'SEO',
    social_media: 'Social Media',
    paid_ads: 'Paid Ads',
    web_dev: 'Web Development',
    ai_automation: 'AI Automation',
    other: 'Other',
  }
  return labels[type] ?? type
}

export function getMilestoneStatusLabel(status: MilestoneStatus): string {
  const labels: Record<MilestoneStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    delayed: 'Delayed',
  }
  return labels[status]
}

export function parseHealthScore(raw: string | null | undefined): number {
  if (!raw) return 50
  // Could be numeric string or word like "good"/"at_risk"/"critical"
  const map: Record<string, number> = { good: 80, at_risk: 40, critical: 10 }
  if (map[raw] !== undefined) return map[raw]
  const num = Number(raw)
  return Number.isNaN(num) ? 50 : Math.min(100, Math.max(0, num))
}

// ---- Data fetching ----

function sanitizeSearchQuery(searchQuery: string) {
  return searchQuery.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function fetchProjects(
  supabase: SupabaseClient,
  searchQuery?: string,
  status?: ProjectListStatus
): Promise<ProjectWithClient[]> {
  let query = supabase
    .from('projects')
    .select('*, clients!projects_client_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (searchQuery) {
    const escaped = sanitizeSearchQuery(searchQuery)
    query = query.or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    client_name: row.clients?.name ?? null,
  })) as ProjectWithClient[]
}

export async function fetchProjectById(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectWithClient | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients!projects_client_id_fkey(name)')
    .eq('id', projectId)
    .single()

  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }

  return {
    ...data,
    client_name: (data as any).clients?.name ?? null,
  } as ProjectWithClient
}

export async function fetchProjectsByClientId(
  supabase: SupabaseClient,
  clientId: string
): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ProjectRow[]
}

export async function fetchMilestonesForProject(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase.from('milestones').select('*').eq('project_id', projectId).order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []) as Array<any>
}

export async function createMilestone(supabase: SupabaseClient, projectId: string, name: string, due_date?: string) {
  const { data, error } = await supabase.from('milestones').insert([{ project_id: projectId, name, due_date }])
  if (error) throw error
  return data
}

export async function updateMilestone(supabase: SupabaseClient, milestoneId: string, patch: Record<string, any>) {
  const { data, error } = await supabase.from('milestones').update(patch).eq('id', milestoneId)
  if (error) throw error
  return data
}

export async function deleteMilestone(supabase: SupabaseClient, milestoneId: string) {
  const { data, error } = await supabase.from('milestones').delete().eq('id', milestoneId)
  if (error) throw error
  return data
}
