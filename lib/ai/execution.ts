import type { SupabaseClient } from '@supabase/supabase-js'
import { generateAIResponse, type AIProviderConfig, type AIResponse } from './provider'
import { getWorkflowMemory } from './memory'
import { executeTools, getToolsForAgent } from './tools'

export type AgentExecutionRow = {
  id: string; user_id: string; agent_id: string | null; command_id: string | null; task_id: string | null
  prompt: string; response: string | null; model: string | null; provider: string | null
  tokens_used: number; duration_ms: number; status: string; error_msg: string | null
  metadata: Record<string, any>; created_at: string
}

export async function getActiveProviderConfig(supabase: SupabaseClient, userId: string): Promise<AIProviderConfig> {
  const { data } = await supabase.from('ai_provider_configs').select('*').eq('user_id', userId).eq('is_active', true).limit(1).single()
  if (data) { return { provider: data.provider, model: data.model, api_url: data.api_url, api_key: data.api_key } }
  return { provider: 'ollama', model: 'llama3.1', api_url: 'http://localhost:11434' }
}

const AGENT_TAGS: Record<string, string[]> = {
  ceo: ['ceo'], research: ['research'], marketing: ['marketing'],
  content: ['content'], seo: ['seo'], sales: ['sales'],
  finance: ['finance'], support: ['support'], developer: ['developer'],
  automation: ['automation'], general: ['general'],
}

function extractAgentTags(systemPrompt: string | undefined): string[] {
  if (!systemPrompt) return []
  const lower = systemPrompt.toLowerCase()
  for (const [keyword, tags] of Object.entries(AGENT_TAGS)) {
    if (lower.includes(keyword)) return tags
  }
  return []
}

export async function executeAgentTask(
  supabase: SupabaseClient,
  userId: string,
  agentId: string | null,
  prompt: string,
  opts: { systemPrompt?: string; commandId?: string; taskId?: string } = {}
): Promise<AgentExecutionRow> {
  const config = await getActiveProviderConfig(supabase, userId)
  const startTime = Date.now()

  // Create execution record
  const { data: execution, error: execErr } = await supabase.from('agent_executions').insert([{
    user_id: userId, agent_id: agentId, command_id: opts.commandId || null, task_id: opts.taskId || null,
    prompt, model: config.model, provider: config.provider, status: 'running', metadata: {},
  }]).select().single()
  if (execErr) throw execErr

  // Update agent status to busy
  if (agentId) { await supabase.from('agents').update({ status: 'busy' }).eq('id', agentId) }

  // Inject relevant workflow memories
  const agentTags = extractAgentTags(opts.systemPrompt)
  const memories = await getWorkflowMemory(supabase, userId, agentTags, 3)
  const memoryBlock = memories.length > 0
    ? `\n\n[Company Brain — Previous Workflow Knowledge]\nThe following are relevant outputs from previous workflow runs. Use them to maintain consistency and build on past work.\n\n${memories.map((m) => `[${m.content.stepLabel} (${m.content.workflowName})]: ${(m.content.output || '').slice(0, 150)}`).join('\n\n')}`
    : ''

  // Execute tools for agent type
  const toolResults = await executeTools(supabase, userId, agentTags, prompt)

  // Build messages
  const messages = [
    ...(opts.systemPrompt ? [{ role: 'system' as const, content: opts.systemPrompt + memoryBlock + toolResults }] : memoryBlock || toolResults ? [{ role: 'system' as const, content: (memoryBlock + toolResults).trim() }] : []),
    { role: 'user' as const, content: prompt },
  ]

  // Call AI provider
  const aiResponse = await generateAIResponse(config, messages)

  // Update execution record
  const patch: Record<string, any> = {
    response: aiResponse.content, tokens_used: aiResponse.tokens_used, duration_ms: aiResponse.duration_ms,
    status: aiResponse.content.startsWith('[Error]') ? 'failed' : 'completed',
    error_msg: aiResponse.content.startsWith('[Error]') ? aiResponse.content : null,
  }
  await supabase.from('agent_executions').update(patch).eq('id', execution.id)

  // Update agent stats
  if (agentId) {
    const { data: agent } = await supabase.from('agents').select('total_executions, success_rate').eq('id', agentId).single()
    if (agent) {
      const totalExec = (agent.total_executions || 0) + 1
      const isOk = !aiResponse.content.startsWith('[Error]')
      const newRate = Math.round(((agent.success_rate || 0) * (agent.total_executions || 0) + (isOk ? 100 : 0)) / totalExec)
      await supabase.from('agents').update({
        status: 'idle', total_executions: totalExec, success_rate: newRate,
        last_active_at: new Date().toISOString(),
      }).eq('id', agentId)
    }
  }

  return { ...execution, ...patch } as AgentExecutionRow
}

export async function executeCommand(
  supabase: SupabaseClient,
  userId: string,
  commandId: string,
  commandText: string,
  agentId: string | null,
  category: string = 'general'
): Promise<AgentExecutionRow> {
  // Update command to processing
  await supabase.from('commands').update({ status: 'processing', agent_id: agentId }).eq('id', commandId)

  const systemPrompt = `You are an AI agency assistant. Category: ${category}. Execute the user's command and provide a clear, actionable response.`
  const result = await executeAgentTask(supabase, userId, agentId, commandText, { systemPrompt, commandId })

  // Update command with result
  await supabase.from('commands').update({
    status: result.status === 'completed' ? 'completed' : 'failed',
    response: result.response, execution_time_ms: result.duration_ms,
  }).eq('id', commandId)

  return result
}

export async function fetchAgentExecutions(supabase: SupabaseClient, agentId?: string, limit = 50): Promise<AgentExecutionRow[]> {
  let q = supabase.from('agent_executions').select('*').order('created_at', { ascending: false }).limit(limit)
  if (agentId) q = q.eq('agent_id', agentId)
  const { data, error } = await q; if (error) throw error; return (data ?? []) as AgentExecutionRow[]
}

export async function fetchExecutionById(supabase: SupabaseClient, id: string): Promise<AgentExecutionRow | null> {
  const { data, error } = await supabase.from('agent_executions').select('*').eq('id', id).single()
  if (error) { if ((error as any).code === 'PGRST116') return null; throw error }; return data as AgentExecutionRow
}
