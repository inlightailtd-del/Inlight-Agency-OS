import type { SupabaseClient } from '@supabase/supabase-js'
import { storeMemory } from '@/lib/ai/memory'
import { executeAgentTask } from '@/lib/ai/execution'

export interface VoiceConversationMemory {
  sessionId: string
  userId: string
  contactInfo: { name?: string; company?: string; role?: string; phone?: string; email?: string }
  topics: { subject: string; sentiment: 'positive' | 'neutral' | 'negative'; keyPoints: string[] }[]
  objections: { type: string; response: string; resolved: boolean; expressedAt: string }[]
  decisions: { type: string; outcome: string; timestamp: string }[]
  actionItems: { description: string; assignee: string; dueDate?: string; status: 'pending' | 'completed' }[]
  summary: string
  sentiment: number
  callCount: number
  lastInteraction: string
}

export async function createVoiceMemory(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  transcript: string,
  contactName?: string
): Promise<VoiceConversationMemory | null> {
  const systemPrompt = `You are a voice memory system. Extract conversation intelligence. Return JSON: {"contactInfo": {"name": "string", "company": "string", "role": "string", "phone": "string", "email": "string"}, "topics": [{"subject": "string", "sentiment": "positive|neutral|negative", "keyPoints": ["string"]}], "objections": [{"type": "price|timing|trust|need|authority", "response": "string", "resolved": true}], "decisions": [{"type": "meeting|followup|proposal|purchase", "outcome": "string", "timestamp": "string"}], "actionItems": [{"description": "string", "assignee": "string", "dueDate": "string", "status": "pending|completed"}], "summary": "string", "sentiment": 0-100, "callCount": 1}`
  const result = await executeAgentTask(supabase, userId, null,
    `Extract conversation intelligence from this transcript:\n\n${transcript}\n\nIdentify contact info, topics discussed, objections raised, decisions made, and action items.`, { systemPrompt }
  )

  let memory: VoiceConversationMemory | null = null
  try { memory = JSON.parse(result.response || '{}') as VoiceConversationMemory } catch { return null }
  if (!memory?.summary) return null

  memory.sessionId = sessionId
  memory.userId = userId
  if (contactName && !memory.contactInfo?.name) memory.contactInfo = { ...memory.contactInfo, name: contactName }
  memory.lastInteraction = new Date().toISOString()

  await storeMemory(supabase, userId, {
    category: 'voice_memory', tags: [sessionId, contactName || 'unknown', 'conversation'],
    content: { sessionId, memory, createdAt: new Date().toISOString() },
  })

  return memory
}

export async function getContactVoiceMemory(
  supabase: SupabaseClient,
  userId: string,
  contactName: string
): Promise<VoiceConversationMemory | null> {
  const { data: memories } = await supabase
    .from('agent_memory')
    .select('content')
    .eq('user_id', userId)
    .eq('category', 'voice_memory')
    .contains('tags', [contactName])
    .order('created_at', { ascending: false })
    .limit(1)

  if (!memories?.length) return null
  return (memories[0] as any).content?.memory || null
}

export async function getAllVoiceMemories(
  supabase: SupabaseClient,
  userId: string
): Promise<{ contact: string; lastInteraction: string; sentiment: number; summary: string }[]> {
  const { data: memories } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'voice_memory')
    .order('created_at', { ascending: false })

  const items: { contact: string; lastInteraction: string; sentiment: number; summary: string }[] = []
  const seen = new Set<string>()

  for (const m of (memories ?? []) as any[]) {
    const mem = m.content?.memory as VoiceConversationMemory
    if (!mem?.contactInfo?.name || seen.has(mem.contactInfo.name)) continue
    seen.add(mem.contactInfo.name)
    items.push({
      contact: mem.contactInfo.name,
      lastInteraction: mem.lastInteraction,
      sentiment: mem.sentiment,
      summary: mem.summary.slice(0, 150),
    })
  }

  return items
}

export async function searchVoiceMemory(
  supabase: SupabaseClient,
  userId: string,
  query: string
): Promise<any[]> {
  const systemPrompt = `You are a memory search assistant. Extract search keywords from a user query. Return JSON: {"keywords": ["string"], "contactName": "string or null", "topic": "string or null"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Extract search keywords from this query: "${query}"`, { systemPrompt }
  )

  let searchTerms: any = { keywords: [query] }
  try { searchTerms = JSON.parse(result.response || '{}') } catch {}

  const { data: memories } = await supabase
    .from('agent_memory')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('category', 'voice_memory')
    .order('created_at', { ascending: false })
    .limit(20)

  const results: any[] = []
  const terms = [...(searchTerms.keywords || []), query.toLowerCase()]
  const nameFilter = searchTerms.contactName?.toLowerCase()

  for (const m of (memories ?? []) as any[]) {
    const mem = m.content?.memory as VoiceConversationMemory
    if (!mem) continue
    if (nameFilter && !mem.contactInfo?.name?.toLowerCase().includes(nameFilter)) continue

    const summary = mem.summary?.toLowerCase() || ''
    const topics = mem.topics?.map(t => t.subject?.toLowerCase()).join(' ') || ''
    const matched = terms.some(t => summary.includes(t) || topics.includes(t))

    if (matched) {
      results.push({ contact: mem.contactInfo?.name, summary: mem.summary, sentiment: mem.sentiment, topics: mem.topics?.map(t => t.subject), lastInteraction: mem.lastInteraction, sessionId: mem.sessionId })
    }
  }

  return results
}
