import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const knowledgeCategories = ['general', 'sop', 'wiki', 'policy', 'guide', 'template'] as const
export const knowledgeDepartments = ['sales', 'marketing', 'design', 'development', 'hr', 'admin'] as const
export const knowledgeStatuses = ['draft', 'published', 'archived'] as const

export type KnowledgeCategory = (typeof knowledgeCategories)[number]
export type KnowledgeDepartment = (typeof knowledgeDepartments)[number]
export type KnowledgeStatus = (typeof knowledgeStatuses)[number]

export const knowledgeDocFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().trim().optional().nullable().transform((v) => v || null),
  category: z.enum(knowledgeCategories).default('general'),
  department: z.enum(knowledgeDepartments).optional().nullable().transform((v) => v || null),
  status: z.enum(knowledgeStatuses).default('published'),
  tags: z.string().trim().optional().nullable().transform((v) => v || null),
})

export type KnowledgeDoc = {
  id: string
  user_id: string
  title: string
  content: string | null
  category: KnowledgeCategory
  department: string | null
  status: KnowledgeStatus
  tags: string[] | null
  version: number
  created_at: string
  updated_at: string | null
}

export type KnowledgeDocVersion = {
  id: string
  doc_id: string
  version: number
  title: string
  content: string | null
  changed_by: string | null
  change_summary: string | null
  created_at: string
}

export function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    general: 'General', sop: 'SOP', wiki: 'Wiki',
    policy: 'Policy', guide: 'Guide', template: 'Template',
  }
  return map[cat] ?? cat
}

export function getDepartmentLabel(dept: string | null): string {
  if (!dept) return '—'
  const map: Record<string, string> = {
    sales: 'Sales', marketing: 'Marketing', design: 'Design',
    development: 'Development', hr: 'HR', admin: 'Admin',
  }
  return map[dept] ?? dept
}

export function getStatusVariant(status: KnowledgeStatus): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<KnowledgeStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'warning', published: 'success', archived: 'default',
  }
  return map[status] ?? 'default'
}

function sanitizeSearchQuery(s: string) { return s.replace(/%/g, '\\%').replace(/_/g, '\\_') }

export async function fetchKnowledgeDocs(
  supabase: SupabaseClient, searchQuery?: string, category?: string, department?: string, status?: string
): Promise<KnowledgeDoc[]> {
  let query = supabase.from('knowledge_docs').select('*').order('updated_at', { ascending: false }).order('created_at', { ascending: false })
  if (searchQuery) { const esc = sanitizeSearchQuery(searchQuery); query = query.or(`title.ilike.%${esc}%,content.ilike.%${esc}%`) }
  if (category && category !== 'all') query = query.eq('category', category)
  if (department && department !== 'all') query = query.eq('department', department)
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as KnowledgeDoc[]
}

export async function fetchKnowledgeDocById(supabase: SupabaseClient, id: string): Promise<KnowledgeDoc | null> {
  const { data, error } = await supabase.from('knowledge_docs').select('*').eq('id', id).single()
  if (error) { if ((error as any).code === 'PGRST116') return null; throw error }
  return data as KnowledgeDoc
}

export async function fetchDocVersions(supabase: SupabaseClient, docId: string): Promise<KnowledgeDocVersion[]> {
  const { data, error } = await supabase.from('knowledge_doc_versions').select('*').eq('doc_id', docId).order('version', { ascending: false })
  if (error) throw error
  return (data ?? []) as KnowledgeDocVersion[]
}

export async function createKnowledgeDoc(
  supabase: SupabaseClient, userId: string,
  params: { title: string; content?: string | null; category?: string; department?: string | null; status?: string; tags?: string | null }
) {
  const tagsArray = params.tags ? params.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
  const { data, error } = await supabase.from('knowledge_docs').insert([{ ...params, user_id: userId, tags: tagsArray, version: 1 }])
  if (error) throw error
  return data
}

export async function updateKnowledgeDoc(supabase: SupabaseClient, id: string, patch: Record<string, any>) {
  if (patch.tags && typeof patch.tags === 'string') {
    patch.tags = patch.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
  }
  const current = await fetchKnowledgeDocById(supabase, id)
  const newVersion = (current?.version ?? 0) + 1
  const changeSummary = patch.change_summary || null

  const payload: Record<string, any> = {
    title: patch.title,
    content: patch.content,
    category: patch.category,
    department: patch.department,
    status: patch.status,
    tags: patch.tags,
    version: newVersion,
    updated_at: new Date().toISOString(),
  }
  // Remove undefined keys
  Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k] })

  const { data, error } = await supabase.from('knowledge_docs').update(payload).eq('id', id)
  if (error) throw error

  if (current) {
    await supabase.from('knowledge_doc_versions').insert([{
      doc_id: id, version: newVersion,
      title: patch.title ?? current.title,
      content: patch.content !== undefined ? (patch.content ?? null) : current.content,
      change_summary: changeSummary,
    }])
  }
  return data
}

export async function deleteKnowledgeDoc(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('knowledge_docs').delete().eq('id', id)
  if (error) throw error
}