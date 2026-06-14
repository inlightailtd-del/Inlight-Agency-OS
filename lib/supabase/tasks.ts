import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const taskStatuses = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const
export const taskStatusOptions = ['all', ...taskStatuses] as const
export const taskPriorities = ['low', 'medium', 'high', 'critical'] as const

export type TaskStatus = (typeof taskStatuses)[number]
export type TaskListStatus = (typeof taskStatusOptions)[number]
export type TaskPriority = (typeof taskPriorities)[number]

export const taskFormSchema = z.object({
  project_id: z.string().uuid('Must select a project'),
  milestone_id: z.string().uuid().optional().nullable().transform((v) => v || null),
  title: z.string().min(1, 'Title is required'),
  description: z.string().trim().optional().nullable().transform((v) => v || null),
  status: z.enum(taskStatuses).default('todo'),
  priority: z.enum(taskPriorities).default('medium'),
  due_date: z.string().optional().nullable().transform((v) => v || null),
  estimated_hrs: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? Number(v) : null)),
  actual_hrs: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? Number(v) : null)),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

export type TaskRow = {
  id: string
  project_id: string
  milestone_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: string | null
  due_date: string | null
  completed_at: string | null
  estimated_hrs: number | null
  actual_hrs: number | null
  tags: string[] | null
  created_at: string
  updated_at: string | null
}

export type TaskWithRelations = TaskRow & {
  project_name?: string | null
  client_name?: string | null
  client_id?: string | null
  milestone_name?: string | null
}

// ---- Display helpers ----

export function getStatusLabel(status: TaskListStatus | TaskStatus): string {
  if (status === 'all') return 'All'
  const labels: Record<TaskStatus, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
    blocked: 'Blocked',
  }
  return labels[status] ?? status
}

export function getStatusVariant(
  status: TaskStatus
): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<TaskStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    todo: 'default',
    in_progress: 'info',
    review: 'warning',
    done: 'success',
    blocked: 'destructive',
  }
  return map[status] ?? 'default'
}

export function getPriorityLabel(priority: string): string {
  return (priority ?? 'medium').charAt(0).toUpperCase() + (priority ?? 'medium').slice(1)
}

export function getPriorityVariant(
  priority: string
): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    low: 'default',
    medium: 'info',
    high: 'warning',
    critical: 'destructive',
  }
  return map[priority] ?? 'default'
}

export function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate) return false
  if (status === 'done') return false
  return new Date(dueDate) < new Date()
}

export function getDaysRemaining(dueDate: string | null): number | null {
  if (!dueDate) return null
  return Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

// ---- Data fetching ----

function sanitizeSearchQuery(searchQuery: string) {
  return searchQuery.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function fetchTasks(
  supabase: SupabaseClient,
  searchQuery?: string,
  status?: TaskListStatus
): Promise<TaskWithRelations[]> {
  let query = supabase
    .from('tasks')
    .select(
      '*, projects!tasks_project_id_fkey(name, client_id, clients!projects_client_id_fkey(name)), milestones!tasks_milestone_id_fkey(name)'
    )
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (searchQuery) {
    const escaped = sanitizeSearchQuery(searchQuery)
    query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    project_name: row.projects?.name ?? null,
    client_name: row.projects?.clients?.name ?? null,
    client_id: row.projects?.client_id ?? null,
    milestone_name: row.milestones?.name ?? null,
  })) as TaskWithRelations[]
}

export async function fetchTaskById(
  supabase: SupabaseClient,
  taskId: string
): Promise<TaskWithRelations | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(
      '*, projects!tasks_project_id_fkey(name, client_id, clients!projects_client_id_fkey(name)), milestones!tasks_milestone_id_fkey(name)'
    )
    .eq('id', taskId)
    .single()

  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }

  return {
    ...data,
    project_name: (data as any).projects?.name ?? null,
    client_name: (data as any).projects?.clients?.name ?? null,
    client_id: (data as any).projects?.client_id ?? null,
    milestone_name: (data as any).milestones?.name ?? null,
  } as TaskWithRelations
}

export async function fetchTasksForProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as TaskRow[]
}

export async function fetchMilestonesForProjectSelect(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('id, name')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })

  if (error) throw error
  return (data ?? []) as { id: string; name: string }[]
}

export async function createTask(
  supabase: SupabaseClient,
  params: {
    project_id: string
    title: string
    milestone_id?: string | null
    description?: string | null
    status?: TaskStatus
    priority?: string
    due_date?: string | null
    estimated_hrs?: number | null
    actual_hrs?: number | null
  }
) {
  const { data, error } = await supabase.from('tasks').insert([
    {
      project_id: params.project_id,
      title: params.title,
      milestone_id: params.milestone_id ?? null,
      description: params.description ?? null,
      status: params.status ?? 'todo',
      priority: params.priority ?? 'medium',
      due_date: params.due_date ?? null,
      estimated_hrs: params.estimated_hrs ?? null,
      actual_hrs: params.actual_hrs ?? null,
    },
  ])
  if (error) throw error
  return data
}

export async function updateTask(
  supabase: SupabaseClient,
  taskId: string,
  patch: Record<string, any>
) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw error
  return data
}

export async function deleteTask(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
  return data
}