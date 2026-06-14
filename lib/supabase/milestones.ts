import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const milestoneStatuses = ['pending', 'in_progress', 'completed', 'delayed'] as const
export type MilestoneStatus = (typeof milestoneStatuses)[number]
export type MilestoneListStatus = 'all' | MilestoneStatus

export const milestoneFormSchema = z.object({
  project_id: z.string().uuid('Must select a project'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().trim().optional().nullable().transform((v) => v || null),
  status: z.enum(milestoneStatuses).default('pending'),
  due_date: z.string().optional().nullable().transform((v) => v || null),
  order_index: z
    .string()
    .trim()
    .optional()
    .default('0')
    .transform((v) => {
      const num = Number(v)
      return Number.isNaN(num) ? 0 : num
    }),
})

export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>

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

export type MilestoneWithProject = MilestoneRow & {
  project_name?: string | null
  project_status?: string | null
  client_name?: string | null
  client_id?: string | null
}

// ---- Display helpers ----

export function getStatusLabel(status: MilestoneStatus | 'all'): string {
  if (status === 'all') return 'All'
  const labels: Record<MilestoneStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    delayed: 'Delayed',
  }
  return labels[status] ?? status
}

export function getStatusVariant(
  status: MilestoneStatus
): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<MilestoneStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'default',
    in_progress: 'warning',
    completed: 'success',
    delayed: 'destructive',
  }
  return map[status] ?? 'default'
}

export function isOverdue(dueDate: string | null, status: MilestoneStatus): boolean {
  if (!dueDate) return false
  if (status === 'completed') return false
  return new Date(dueDate) < new Date()
}

export function getDaysRemaining(dueDate: string | null): number | null {
  if (!dueDate) return null
  const diff = new Date(dueDate).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ---- Data fetching ----

function sanitizeSearchQuery(searchQuery: string) {
  return searchQuery.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function fetchMilestones(
  supabase: SupabaseClient,
  searchQuery?: string,
  status?: MilestoneListStatus
): Promise<MilestoneWithProject[]> {
  // Fetch milestones and their projects in one query
  let query = supabase
    .from('milestones')
    .select('*, projects!milestones_project_id_fkey(name, status, client_id, clients!projects_client_id_fkey(name))')
    .order('due_date', { ascending: true, nullsFirst: false })
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
    project_name: row.projects?.name ?? null,
    project_status: row.projects?.status ?? null,
    client_name: row.projects?.clients?.name ?? null,
    client_id: row.projects?.client_id ?? null,
  })) as MilestoneWithProject[]
}

export async function fetchMilestoneById(
  supabase: SupabaseClient,
  milestoneId: string
): Promise<MilestoneWithProject | null> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*, projects!milestones_project_id_fkey(name, status, client_id, clients!projects_client_id_fkey(name))')
    .eq('id', milestoneId)
    .single()

  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }

  return {
    ...data,
    project_name: (data as any).projects?.name ?? null,
    project_status: (data as any).projects?.status ?? null,
    client_name: (data as any).projects?.clients?.name ?? null,
    client_id: (data as any).projects?.client_id ?? null,
  } as MilestoneWithProject
}

export async function fetchMilestonesForProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<MilestoneRow[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as MilestoneRow[]
}

export async function createMilestone(
  supabase: SupabaseClient,
  params: {
    project_id: string
    name: string
    description?: string | null
    status?: MilestoneStatus
    due_date?: string | null
    order_index?: number
  }
) {
  const { data, error } = await supabase.from('milestones').insert([
    {
      project_id: params.project_id,
      name: params.name,
      description: params.description ?? null,
      status: params.status ?? 'pending',
      due_date: params.due_date ?? null,
      order_index: params.order_index ?? 0,
    },
  ])
  if (error) throw error
  return data
}

export async function updateMilestone(
  supabase: SupabaseClient,
  milestoneId: string,
  patch: Record<string, any>
) {
  const { data, error } = await supabase
    .from('milestones')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', milestoneId)
  if (error) throw error
  return data
}

export async function deleteMilestone(supabase: SupabaseClient, milestoneId: string) {
  const { data, error } = await supabase.from('milestones').delete().eq('id', milestoneId)
  if (error) throw error
  return data
}