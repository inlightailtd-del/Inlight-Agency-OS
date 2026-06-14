import type { SupabaseClient } from '@supabase/supabase-js'
import { getWorkflowMemory, getMemoryContext, type AgentMemoryRow } from './memory'

export interface Tool {
  name: string
  description: string
  execute(supabase: SupabaseClient, userId: string, input: string): Promise<string>
}

// ─── READ TOOLS ──────────────────────────────────────────────

const brainSearchTool: Tool = {
  name: 'company_brain_search',
  description: 'Search previous workflow outputs and agent memories',
  async execute(supabase, userId, input) {
    const memories = await getWorkflowMemory(supabase, userId, [], 5)
    if (memories.length === 0) return 'No relevant memories found.'
    return memories.map((m) =>
      `[${m.content.stepLabel} (${m.content.workflowName})]: ${(m.content.output || '').slice(0, 300)}`
    ).join('\n\n')
  },
}

const leadTool: Tool = {
  name: 'lead_database',
  description: 'Search leads in the database',
  async execute(supabase, userId, input) {
    const { data } = await supabase
      .from('leads')
      .select('name, company, industry, status, score, source')
      .eq('user_id', userId)
      .order('score', { ascending: false })
      .limit(5)
    if (!data || data.length === 0) return 'No leads found.'
    return data.map((l) =>
      `${l.name}${l.company ? ` at ${l.company}` : ''} — ${l.status}, Score: ${l.score}, Source: ${l.source}`
    ).join('\n')
  },
}

const contentTool: Tool = {
  name: 'content_database',
  description: 'Search generated content',
  async execute(supabase, userId, input) {
    const { data } = await supabase
      .from('content_requests')
      .select('title, content_type, status, score')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (!data || data.length === 0) return 'No content found.'
    return data.map((c) =>
      `${c.title} — ${c.content_type}, Status: ${c.status}, Score: ${c.score}`
    ).join('\n')
  },
}

const workflowHistoryTool: Tool = {
  name: 'workflow_history',
  description: 'Search previous workflow task results',
  async execute(supabase, userId, input) {
    const { data } = await supabase
      .from('orchestrator_tasks')
      .select('title, status, result, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5)
    if (!data || data.length === 0) return 'No completed tasks found.'
    return data.map((t) =>
      `${t.title} — Completed ${new Date(t.created_at).toLocaleDateString()}\n${(t.result || '').slice(0, 200)}`
    ).join('\n\n')
  },
}

// ─── ACTION TOOLS ────────────────────────────────────────────

async function logAction(supabase: SupabaseClient, userId: string, action: string, module: string, status: string, message: string) {
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null, action, module,
    status, message, entity_type: module, entity_id: null,
  }])
}

const createContentRequestTool: Tool = {
  name: 'create_content_request',
  description: 'Create a content request for blog, social, ad, email, or landing page content',
  async execute(supabase, userId, input) {
    const lower = input.toLowerCase()
    if (!lower.includes('blog') && !lower.includes('post') && !lower.includes('content') && !lower.includes('social') && !lower.includes('ad') && !lower.includes('email') && !lower.includes('landing')) {
      return ''
    }
    const contentType = lower.includes('social') ? 'social_media' : lower.includes('ad') ? 'ad_copy' : lower.includes('email') ? 'email' : lower.includes('landing') ? 'landing_page' : 'blog'
    const title = input.length > 80 ? input.slice(0, 80) + '...' : input
    await supabase.from('content_requests').insert([{
      user_id: userId, title, content_type: contentType, description: input, status: 'draft', tone: 'professional',
    }])
    await logAction(supabase, userId, `Created ${contentType} content request`, 'content', 'success', `Title: ${title}`)
    return `Created a new ${contentType} content request: "${title}". The request is saved as draft and ready for review.`
  },
}

const createLeadTaskTool: Tool = {
  name: 'create_lead_task',
  description: 'Create a task for lead follow-up or qualification',
  async execute(supabase, userId, input) {
    const lower = input.toLowerCase()
    if (!lower.includes('lead') && !lower.includes('follow') && !lower.includes('outreach') && !lower.includes('contact') && !lower.includes('prospect')) {
      return ''
    }
    const title = input.length > 80 ? input.slice(0, 80) + '...' : input
    const { data: task } = await supabase.from('orchestrator_tasks').insert([{
      user_id: userId, title: `Lead Task: ${title}`, description: input, status: 'pending', priority: 'medium',
    }]).select('id').single()
    await logAction(supabase, userId, 'Created lead task', 'clients', 'success', `Task ID: ${task?.id}`)
    return `Created a lead follow-up task. The task has been added to the orchestrator queue for processing.`
  },
}

const createWorkflowTaskTool: Tool = {
  name: 'create_workflow_task',
  description: 'Delegate a task to the orchestrator for multi-agent processing',
  async execute(supabase, userId, input) {
    const lower = input.toLowerCase()
    if (!lower.includes('delegate') && !lower.includes('task') && !lower.includes('assign') && !lower.includes('orchestrate') && !lower.includes('automate') && !lower.includes('run')) {
      return ''
    }
    const title = input.length > 80 ? input.slice(0, 80) + '...' : input
    const { data: task } = await supabase.from('orchestrator_tasks').insert([{
      user_id: userId, title, description: input, status: 'pending', priority: 'medium',
    }]).select('id').single()
    await logAction(supabase, userId, 'Created orchestrator task', 'automations', 'success', `Task ID: ${task?.id}`)
    return `Created an orchestrator task: "${title}". It will be processed by available agents.`
  },
}

const createAutomationTool: Tool = {
  name: 'create_automation',
  description: 'Create a new automation rule or workflow',
  async execute(supabase, userId, input) {
    const lower = input.toLowerCase()
    if (!lower.includes('automation') && !lower.includes('workflow') && !lower.includes('trigger') && !lower.includes('schedule') && !lower.includes('cron')) {
      return ''
    }
    const title = input.length > 80 ? input.slice(0, 80) + '...' : input
    await supabase.from('automations').insert([{
      user_id: userId, name: title, description: input, status: 'draft', trigger_type: 'manual', category: 'internal',
    }])
    await logAction(supabase, userId, 'Created automation', 'automations', 'success', `Name: ${title}`)
    return `Created a draft automation: "${title}". Configure triggers and actions in the automations dashboard.`
  },
}

const createKnowledgeDocTool: Tool = {
  name: 'create_knowledge_document',
  description: 'Save information as a knowledge document in the Company Brain',
  async execute(supabase, userId, input) {
    const lower = input.toLowerCase()
    if (!lower.includes('save') && !lower.includes('remember') && !lower.includes('store') && !lower.includes('document') && !lower.includes('knowledge') && !lower.includes('wiki') && !lower.includes('sop')) {
      return ''
    }
    const title = input.length > 80 ? input.slice(0, 80) + '...' : input
    await supabase.from('knowledge_docs').insert([{
      user_id: userId, title, content: input, category: 'general', status: 'published',
    }])
    await logAction(supabase, userId, 'Created knowledge document', 'brain', 'success', `Title: ${title}`)
    return `Saved a knowledge document: "${title}". It's available in the Company Brain.`
  },
}

// ─── REGISTRY ────────────────────────────────────────────────

const TOOL_REGISTRY: Record<string, Tool> = {
  company_brain_search: brainSearchTool,
  lead_database: leadTool,
  content_database: contentTool,
  workflow_history: workflowHistoryTool,
  create_content_request: createContentRequestTool,
  create_lead_task: createLeadTaskTool,
  create_workflow_task: createWorkflowTaskTool,
  create_automation: createAutomationTool,
  create_knowledge_document: createKnowledgeDocTool,
}

const AGENT_TOOLS: Record<string, string[]> = {
  ceo: ['workflow_history'],
  research: ['company_brain_search', 'lead_database', 'create_knowledge_document'],
  marketing: ['lead_database', 'content_database', 'company_brain_search', 'create_content_request'],
  content: ['content_database', 'company_brain_search', 'create_content_request'],
  sales: ['lead_database', 'workflow_history', 'create_lead_task'],
  seo: ['company_brain_search', 'content_database', 'create_content_request'],
  finance: ['workflow_history'],
  automation: ['workflow_history', 'create_workflow_task', 'create_automation'],
  general: ['company_brain_search', 'create_knowledge_document'],
}

export function getToolsForAgent(agentType: string): string[] {
  return AGENT_TOOLS[agentType] || ['company_brain_search']
}

export async function executeTools(
  supabase: SupabaseClient,
  userId: string,
  agentTypes: string[],
  userPrompt: string
): Promise<string> {
  const toolNames = new Set<string>()
  for (const t of agentTypes) {
    for (const toolName of getToolsForAgent(t)) {
      toolNames.add(toolName)
    }
  }

  const results: string[] = []
  for (const name of toolNames) {
    const tool = TOOL_REGISTRY[name]
    if (!tool) continue
    try {
      const result = await tool.execute(supabase, userId, userPrompt)
      if (result) {
        results.push(`[Tool: ${tool.name}]\n${result}`)
      }
    } catch (e: any) {
      results.push(`[Tool: ${tool.name}]\nError: ${e.message}`)
    }
  }

  if (results.length === 0) return ''

  const readResults = results.filter((r) => !r.includes('Created a') && !r.includes('Created an') && !r.includes('Saved a') && !r.includes('Created lead'))
  const actionResults = results.filter((r) => r.includes('Created a') || r.includes('Created an') || r.includes('Saved a') || r.includes('Created lead'))

  let output = ''
  if (readResults.length > 0) {
    output += `\n\n[Retrieved Data]\n${readResults.join('\n\n')}`
  }
  if (actionResults.length > 0) {
    output += `\n\n[Actions Performed]\n${actionResults.join('\n\n')}`
  }

  return output
}
