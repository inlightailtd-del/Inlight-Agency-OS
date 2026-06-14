import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const contentTypes = ['blog', 'social_media', 'ad_copy', 'email', 'landing_page', 'reel_script', 'carousel'] as const
export const contentStatuses = ['idea', 'planned', 'draft', 'approved', 'generated', 'scheduled', 'published', 'queued', 'generating', 'review', 'completed', 'failed'] as const
export const platforms = ['linkedin', 'twitter', 'facebook', 'instagram', 'tiktok', 'blog', 'email'] as const
export const tones = ['professional', 'casual', 'persuasive', 'informative', 'humorous'] as const

export type ContentType = (typeof contentTypes)[number]
export type ContentStatus = (typeof contentStatuses)[number]

export const contentFormSchema = z.object({
  title: z.string().min(1, 'Title required'),
  content_type: z.enum(contentTypes).default('blog'),
  description: z.string().trim().optional().nullable().transform((v) => v || null),
  platform: z.enum(platforms).optional().nullable().transform((v) => v || null),
  tone: z.enum(tones).default('professional'),
  status: z.enum(contentStatuses).default('draft'),
  word_count: z.string().trim().optional().transform((v) => (v ? Number(v) : null)),
  tags: z.string().trim().optional().nullable().transform((v) => v || null),
})

export type ContentRow = {
  id: string; user_id: string; title: string; content_type: ContentType
  description: string | null; platform: string | null; tone: string; status: ContentStatus
  word_count: number | null; generated_content: string | null; feedback: string | null
  score: number; tags: string[] | null; created_at: string; updated_at: string | null
  assignee_id: string | null; campaign_id: string | null; scheduled_at: string | null
  published_at: string | null; hashtags: string[] | null; target_audience: string | null
  media_url: string | null; media_asset_id: string | null; image_count: number | null; carousel_count: number | null
}

export function getContentTypeLabel(t: string): string {
  const m: Record<string, string> = {
    blog: 'Blog Post', social_media: 'Social Media', ad_copy: 'Ad Copy', email: 'Email',
    landing_page: 'Landing Page', reel_script: 'Reel Script', carousel: 'Carousel',
  }
  return m[t] ?? t
}
export function getStatusVariant(s: ContentStatus): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<ContentStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    idea: 'default', planned: 'info', draft: 'default', approved: 'success', generated: 'success',
    scheduled: 'info', published: 'success',
    queued: 'info', generating: 'warning', review: 'warning', completed: 'success', failed: 'destructive',
  }
  return map[s]
}
export function getPlatformLabel(p: string | null): string {
  if (!p) return '—'
  return { linkedin: 'LinkedIn', twitter: 'Twitter/X', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', blog: 'Blog', email: 'Email' }[p] ?? p
}
export function getToneLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function sanitize(s: string) { return s.replace(/%/g, '\\%').replace(/_/g, '\\_') }

export async function fetchContentRequests(supabase: SupabaseClient, searchQuery?: string, status?: string, type?: string): Promise<ContentRow[]> {
  let q = supabase.from('content_requests').select('*').order('updated_at', { ascending: false }).order('created_at', { ascending: false })
  if (searchQuery) { const esc = sanitize(searchQuery); q = q.or(`title.ilike.%${esc}%,description.ilike.%${esc}%`) }
  if (status && status !== 'all') q = q.eq('status', status)
  if (type && type !== 'all') q = q.eq('content_type', type)
  const { data, error } = await q; if (error) throw error; return (data ?? []) as ContentRow[]
}
export async function fetchContentById(supabase: SupabaseClient, id: string): Promise<ContentRow | null> {
  const { data, error } = await supabase.from('content_requests').select('*').eq('id', id).single()
  if (error) { if ((error as any).code === 'PGRST116') return null; throw error }; return data as ContentRow
}
export async function createContentRequest(supabase: SupabaseClient, userId: string, params: { title: string; content_type?: string; description?: string | null; platform?: string | null; tone?: string; status?: string; word_count?: number | null; tags?: string | null }) {
  const tagsArray = params.tags ? params.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
  const { data, error } = await supabase.from('content_requests').insert([{ ...params, user_id: userId, tags: tagsArray }]); if (error) throw error; return data
}
export async function updateContentRequest(supabase: SupabaseClient, id: string, patch: Record<string, any>) {
  if (patch.tags && typeof patch.tags === 'string') patch.tags = patch.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
  const { data, error } = await supabase.from('content_requests').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; return data
}
export async function deleteContentRequest(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('content_requests').delete().eq('id', id); if (error) throw error
}
