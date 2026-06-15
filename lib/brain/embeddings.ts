/**
 * Company Brain V2 — Embedding Generation
 *
 * Generates vector embeddings from text using the configured AI provider.
 * Stores them in the existing `memories` table with pgvector.
 *
 * The `memories` table (from 001_initial_schema.sql):
 *   content      text
 *   embedding    vector(768)   -- nomic-embed-text default
 *   memory_type  text          -- episode | knowledge | procedure | insight
 *   entity_type  text
 *   entity_id    uuid
 *   importance   integer default 5
 *   metadata     jsonb
 *
 * Embeddings are 768-dimensional (nomic-embed-text via Ollama).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getActiveProviderConfig } from '@/lib/ai/execution'

export interface MemoryEntry {
  content: string
  memoryType: 'episode' | 'knowledge' | 'procedure' | 'insight'
  entityType?: string
  entityId?: string
  importance?: number
  metadata?: Record<string, any>
}

export interface SearchResult {
  id: string
  content: string
  memoryType: string
  entityType: string | null
  entityId: string | null
  importance: number
  score: number
  metadata: Record<string, any>
  created_at: string
}

const EMBEDDING_DIMS = 768

/**
 * Generate an embedding vector from text via the Ollama embedding API.
 * Falls back to the active provider config's api_url.
 */
export async function generateEmbedding(
  supabase: SupabaseClient,
  userId: string,
  text: string
): Promise<number[]> {
  const config = await getActiveProviderConfig(supabase, userId)

  // Default: Ollama embedding endpoint with nomic-embed-text
  const embedUrl = config.provider === 'ollama'
    ? `${config.api_url || 'http://localhost:11434'}/api/embeddings`
    : `${config.api_url || 'http://localhost:11434'}/api/embeddings`

  const model = 'nomic-embed-text' // 768-dim, matches the IVFFlat index

  try {
    const response = await fetch(embedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error(`Embedding API error: ${response.status}`)
    const data = await response.json()
    return data.embedding as number[]
  } catch (err) {
    console.warn('[Brain] Embedding failed, using zero vector:', err)
    return new Array(EMBEDDING_DIMS).fill(0)
  }
}

/**
 * Store one or more memory entries with embeddings in the memories table.
 */
export async function storeMemories(
  supabase: SupabaseClient,
  userId: string,
  entries: MemoryEntry[]
): Promise<void> {
  for (const entry of entries) {
    const embedding = await generateEmbedding(supabase, userId, entry.content)

    const { error } = await supabase.from('memories').insert([{
      content: entry.content,
      embedding: `[${embedding.join(',')}]`,
      memory_type: entry.memoryType,
      entity_type: entry.entityType || null,
      entity_id: entry.entityId || null,
      importance: entry.importance ?? 5,
      metadata: entry.metadata || {},
    }])
    if (error) console.warn('[Brain] Failed to store memory:', error.message)
  }
}

/**
 * Store a memory entry and also sync it to agent_memory for the runtime.
 */
export async function storeDualMemory(
  supabase: SupabaseClient,
  userId: string,
  entry: MemoryEntry,
  agentId?: string
): Promise<void> {
  // Store with embedding
  await storeMemories(supabase, userId, [entry])

  // Also store in agent_memory for tag-based runtime access
  const { storeMemory } = await import('@/lib/ai/memory')
  await storeMemory(supabase, userId, {
    agent_id: agentId || null,
    category: entry.memoryType === 'knowledge' ? 'workflow_output' : 'general',
    content: {
      content: entry.content,
      memoryType: entry.memoryType,
      entityType: entry.entityType,
      importance: entry.importance,
      metadata: entry.metadata,
    },
    tags: ['brain', entry.memoryType, entry.entityType || 'general'].filter(Boolean),
  })
}

/**
 * Cosine similarity search against the memories table.
 * Uses the search_memories RPC (pgvector) if available.
 * Falls back to search_memories_keyword RPC or pure textSearch.
 *
 * The search_memories function must be created via migration 040:
 *   supabase/migrations/040_search_memories.sql
 *
 * Run that SQL in Supabase SQL Editor BEFORE vector search will work.
 */
export async function searchMemories(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts?: {
    memoryType?: string
    entityType?: string
    minScore?: number
    maxResults?: number
  }
): Promise<SearchResult[]> {
  const embedding = await generateEmbedding(supabase, userId, query)
  const queryVector = embedding
  const maxResults = opts?.maxResults ?? 10
  const minScore = opts?.minScore ?? 0.3

  // Try pgvector search via RPC (requires migration 040)
  try {
    const { data, error } = await supabase.rpc('search_memories', {
      query_embedding: queryVector,
      match_threshold: minScore,
      match_count: maxResults,
      filter_memory_type: opts?.memoryType ?? null,
      filter_entity_type: opts?.entityType ?? null,
    })

    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data.map((r: any) => ({
        id: r.id,
        content: r.content,
        memoryType: r.memory_type,
        entityType: r.entity_type,
        entityId: r.entity_id,
        importance: r.importance,
        score: r.similarity,
        metadata: r.metadata ?? {},
        created_at: r.created_at,
      })) as SearchResult[]
    }
  } catch {
    // RPC not available, fall through to keyword
  }

  // Fallback: try keyword search RPC
  try {
    const { data, error } = await supabase.rpc('search_memories_keyword', {
      search_query: query,
      match_count: maxResults,
      filter_memory_type: opts?.memoryType ?? null,
      filter_entity_type: opts?.entityType ?? null,
    })

    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data.map((r: any) => ({
        id: r.id,
        content: r.content,
        memoryType: r.memory_type,
        entityType: r.entity_type,
        entityId: r.entity_id,
        importance: r.importance,
        score: 0.5,
        metadata: r.metadata ?? {},
        created_at: r.created_at,
      })) as SearchResult[]
    }
  } catch {
    // RPC not available, fall through
  }

  // Final fallback: REST API textSearch
  return fallbackSearch(supabase, userId, query, opts)
}

/**
 * Keyword fallback when pgvector query isn't available via REST.
 */
async function fallbackSearch(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts?: { memoryType?: string; entityType?: string; maxResults?: number }
): Promise<SearchResult[]> {
  let q = supabase
    .from('memories')
    .select('id, content, memory_type, entity_type, entity_id, importance, metadata, created_at')
    .textSearch('content', query, { type: 'plain' })
    .order('importance', { ascending: false })
    .limit(opts?.maxResults ?? 10) as any

  if (opts?.memoryType) q = q.eq('memory_type', opts.memoryType)
  if (opts?.entityType) q = q.eq('entity_type', opts.entityType)

  const { data } = await q
  return ((data ?? []) as any[]).map((r: any) => ({
    ...r,
    score: 0.5,
  })) as SearchResult[]
}

/**
 * Build a context block for an agent by searching relevant memories
 * and formatting them into a prompt-friendly string.
 */
export async function buildContext(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts?: { memoryTypes?: string[]; maxResults?: number }
): Promise<string> {
  const allResults: SearchResult[] = []
  const types = opts?.memoryTypes ?? ['knowledge', 'procedure', 'insight', 'episode']

  for (const memoryType of types) {
    const results = await searchMemories(supabase, userId, query, {
      memoryType,
      minScore: 0.4,
      maxResults: 3,
    })
    allResults.push(...results)
  }

  // Deduplicate by content
  const seen = new Set<string>()
  const unique = allResults.filter((r) => {
    if (seen.has(r.content)) return false
    seen.add(r.content)
    return true
  })

  if (unique.length === 0) return ''

  const sections = unique.map((r) => {
    const label = r.memoryType.charAt(0).toUpperCase() + r.memoryType.slice(1)
    return `[${label}] (relevance: ${Math.round(r.score * 100)}%)\n${r.content}${r.entityType ? `\nSource: ${r.entityType}` : ''}`
  })

  return `\n\n[Company Brain — Retrieved Knowledge]\n${sections.join('\n\n')}`
}

/**
 * Auto-index a knowledge document into the memories table.
 */
export async function indexKnowledgeDoc(
  supabase: SupabaseClient,
  userId: string,
  doc: { id: string; title: string; content: string | null; category: string; tags: string[] | null }
): Promise<void> {
  const content = doc.content || doc.title
  const tags = doc.tags || []

  // Split long documents into chunks
  const chunks = chunkText(content, 1000)

  for (let i = 0; i < chunks.length; i++) {
    await storeMemories(supabase, userId, [{
      content: chunks[i],
      memoryType: 'knowledge',
      entityType: 'knowledge_doc',
      entityId: doc.id,
      importance: i === 0 ? 8 : 5,
      metadata: { title: doc.title, category: doc.category, tags, chunk: i, totalChunks: chunks.length },
    }])
  }
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    if ((current + line).length > maxChars && current.length > 0) {
      chunks.push(current.trim())
      current = ''
    }
    current += line + '\n'
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
