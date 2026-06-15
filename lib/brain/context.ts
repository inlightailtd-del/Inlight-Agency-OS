/**
 * Company Brain V2 — Context Builder & Agent Knowledge API
 *
 * Provides the unified interface that agents use to query the Company Brain.
 * Combines:
 *   - Vector similarity search (memories table with pgvector)
 *   - Keyword search (knowledge_docs table)
 *   - Recent workflow memory (agent_memory table)
 *   - Active project/lead/task context
 *
 * This is what agents call via the tool system to get rich context
 * before making decisions or generating content.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { searchMemories, buildContext } from './embeddings'
import type { SearchResult } from './embeddings'

export interface BrainContext {
  query: string
  vectorResults: SearchResult[]
  knowledgeDocs: { id: string; title: string; content: string | null; category: string; department: string | null }[]
  recentMemory: { category: string; content: any; created_at: string }[]
  activeContext: {
    activeProjects: number
    pendingTasks: number
    totalLeads: number
    draftContent: number
    totalInvoices: number
  }
}

/**
 * Fetch a rich context object for any agent prompt.
 * Used by the brain_search tool and by runtime exec() calls.
 */
export async function queryBrain(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts?: { maxVector?: number; includeRecentMemory?: boolean }
): Promise<BrainContext> {
  const maxVec = opts?.maxVector ?? 5

  // 1. Vector similarity search against all memory types
  const vectorResults = await searchMemories(supabase, userId, query, {
    maxResults: maxVec,
    minScore: 0.3,
  })

  // 2. Keyword search against knowledge_docs
  const { data: docs } = await supabase
    .from('knowledge_docs')
    .select('id, title, content, category, department')
    .eq('user_id', userId)
    .eq('status', 'published')
    .or(`title.ilike.%${query.replace(/%/g, '\\%')}%,content.ilike.%${query.replace(/%/g, '\\%')}%`)
    .limit(5)

  // 3. Recent agent memory (workflow outputs, assessments)
  let recentMemory: any[] = []
  if (opts?.includeRecentMemory !== false) {
    const { data: mem } = await supabase
      .from('agent_memory')
      .select('category, content, created_at')
      .eq('user_id', userId)
      .in('category', ['workflow_output', 'ceo_assessment', 'manager_assessment', 'monitoring'])
      .order('created_at', { ascending: false })
      .limit(8)
    recentMemory = (mem ?? []) as any[]
  }

  // 4. Active context counts
  const [
    { count: activeProjects },
    { count: pendingTasks },
    { count: totalLeads },
    { count: draftContent },
    { count: totalInvoices },
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['active', 'planning']),
    supabase.from('orchestrator_tasks').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['pending', 'assigned', 'in_progress']),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('content_requests').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'draft'),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  return {
    query,
    vectorResults,
    knowledgeDocs: (docs ?? []) as any[],
    recentMemory,
    activeContext: {
      activeProjects: activeProjects ?? 0,
      pendingTasks: pendingTasks ?? 0,
      totalLeads: totalLeads ?? 0,
      draftContent: draftContent ?? 0,
      totalInvoices: totalInvoices ?? 0,
    },
  }
}

/**
 * Format brain context into a system prompt block that gets injected
 * into agent execution calls.
 */
export async function formatContextBlock(
  supabase: SupabaseClient,
  userId: string,
  query: string
): Promise<string> {
  const ctx = await queryBrain(supabase, userId, query, {
    maxVector: 4,
  })

  const parts: string[] = []

  // Vector results
  if (ctx.vectorResults.length > 0) {
    parts.push(
      '--- Relevant Knowledge ---',
      ...ctx.vectorResults.map((r) =>
        `[${r.memoryType} (${Math.round(r.score * 100)}%)] ${r.content.slice(0, 300)}`
      )
    )
  }

  // Knowledge docs
  if (ctx.knowledgeDocs.length > 0) {
    parts.push(
      '--- Knowledge Base ---',
      ...ctx.knowledgeDocs.map((d) => `[${d.category}] ${d.title}: ${(d.content || '').slice(0, 200)}`)
    )
  }

  // Recent assessments
  const assessments = ctx.recentMemory.filter((m) =>
    m.category === 'ceo_assessment' || m.category === 'manager_assessment'
  )
  if (assessments.length > 0) {
    parts.push(
      '--- Recent Assessments ---',
      ...assessments.slice(0, 3).map((m) =>
        `[${m.category}] ${m.content?.summary || '(no summary)'}`
      )
    )
  }

  // Active context
  const a = ctx.activeContext
  parts.push(
    '--- Current Agency State ---',
    `Active Projects: ${a.activeProjects}`,
    `Pending Tasks: ${a.pendingTasks}`,
    `Total Leads: ${a.totalLeads}`,
    `Draft Content: ${a.draftContent}`,
    `Total Invoices: ${a.totalInvoices}`
  )

  return parts.join('\n')
}

/**
 * Register a new Company Brain tool in the existing tool registry.
 * This makes brain queries available to all agents during execution.
 */
export function getBrainToolSystemPrompt(): string {
  return `\n\nYou have access to the Company Brain. Use the brain_search tool or company_brain tool to retrieve relevant knowledge, past decisions, and current agency state before making recommendations or decisions.`
}
