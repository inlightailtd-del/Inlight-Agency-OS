import type { SupabaseClient } from '@supabase/supabase-js'

export type AgentMemoryRow = {
  id: string; user_id: string; agent_id: string | null; category: string; content: Record<string, any>; tags: string[]; created_at: string
}

export async function storeMemory(supabase: SupabaseClient, userId: string, params: { agent_id?: string | null; category?: string; content: Record<string, any>; tags?: string[] }) {
  const { data, error } = await supabase.from('agent_memory').insert([{
    user_id: userId, agent_id: params.agent_id || null, category: params.category || 'general',
    content: params.content, tags: params.tags || [],
  }])
  if (error) throw error; return data
}

export async function getAgentMemory(supabase: SupabaseClient, agentId: string, category?: string, limit = 20): Promise<AgentMemoryRow[]> {
  let q = supabase.from('agent_memory').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(limit)
  if (category) q = q.eq('category', category)
  const { data, error } = await q; if (error) throw error; return (data ?? []) as AgentMemoryRow[]
}

export async function getMemoryContext(supabase: SupabaseClient, userId: string, limit = 10): Promise<AgentMemoryRow[]> {
  const { data, error } = await supabase.from('agent_memory').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error; return (data ?? []) as AgentMemoryRow[]
}

export async function getWorkflowMemory(
  supabase: SupabaseClient,
  userId: string,
  agentTypes: string[],
  maxResults = 3
): Promise<AgentMemoryRow[]> {
  let q = supabase
    .from('agent_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'workflow_output')
    .order('created_at', { ascending: false })
    .limit(maxResults)

  if (agentTypes.length > 0) {
    q = q.overlaps('tags', agentTypes)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AgentMemoryRow[]
}
