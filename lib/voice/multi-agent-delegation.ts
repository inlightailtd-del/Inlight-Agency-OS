import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type VoiceAgentType = 'cold_caller' | 'qualifier' | 'setter' | 'closer' | 'support' | 'success' | 'analyst' | 'manager' | 'jarvis'

export interface VoiceDelegationRequest {
  id: string
  userId: string
  fromAgent: VoiceAgentType
  toAgent: VoiceAgentType
  task: string
  context: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'accepted' | 'completed' | 'rejected' | 'escalated'
  response?: string
  createdAt: string
  completedAt?: string
}

const AGENT_CAPABILITIES: Record<VoiceAgentType, string> = {
  cold_caller: 'Cold calling, lead engagement, initial pitch delivery, interest qualification',
  qualifier: 'Lead qualification, BANT criteria, budget assessment, authority verification',
  setter: 'Appointment setting, calendar coordination, followup scheduling, confirmation calls',
  closer: 'Deal closing, negotiation, pricing discussions, contract finalization',
  support: 'Customer support, issue resolution, product guidance, troubleshooting',
  success: 'Customer success, onboarding, training, check-in calls, retention',
  analyst: 'Call analysis, performance metrics, conversation intelligence, trend detection',
  manager: 'Team coordination, escalation handling, strategy adjustment, performance reviews',
  jarvis: 'Executive assistant, all-purpose voice AI, system-wide orchestration, approval processing',
}

const DELEGATION_TRIGGERS: Record<string, VoiceAgentType> = {
  'cold': 'cold_caller',
  'qualify': 'qualifier',
  'book': 'setter',
  'schedule': 'setter',
  'close': 'closer',
  'negotiate': 'closer',
  'support': 'support',
  'help': 'support',
  'onboard': 'success',
  'train': 'success',
  'analyze': 'analyst',
  'report': 'analyst',
  'manage': 'manager',
  'escalate': 'manager',
  'jarvis': 'jarvis',
}

export async function delegateVoiceTask(
  supabase: SupabaseClient,
  userId: string,
  taskDescription: string,
  context: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Promise<VoiceDelegationRequest> {
  const systemPrompt = `You are a voice task delegator. Analyze the task and determine the best agent to handle it. Return JSON: {"toAgent": "cold_caller|qualifier|setter|closer|support|success|analyst|manager|jarvis", "reasoning": "string", "confidence": 0-1}`
  const result = await executeAgentTask(supabase, userId, null,
    `Task: "${taskDescription}". Context: "${context}". Determine which voice agent should handle this task. Available agents: ${Object.entries(AGENT_CAPABILITIES).map(([k, v]) => `${k}: ${v}`).join(', ')}`, { systemPrompt }
  )

  let delegation: any = {}
  try { delegation = JSON.parse(result.response || '{}') } catch {}

  const triggerKey = Object.keys(DELEGATION_TRIGGERS).find(t => taskDescription.toLowerCase().includes(t))
  const toAgent: VoiceAgentType = delegation.toAgent || (triggerKey ? DELEGATION_TRIGGERS[triggerKey] : 'jarvis')
  const request: VoiceDelegationRequest = {
    id: 'del_' + Date.now(),
    userId, fromAgent: 'jarvis', toAgent,
    task: taskDescription, context,
    priority, status: 'pending',
    createdAt: new Date().toISOString(),
  }

  await supabase.from('voice_delegations').insert([{
    id: request.id, user_id: userId,
    from_agent: request.fromAgent, to_agent: toAgent,
    task: taskDescription, context, priority,
    status: 'pending', created_at: request.createdAt,
  }])

  const agentCapability = AGENT_CAPABILITIES[toAgent]
  const acceptPrompt = `You are a ${toAgent} AI agent. Decide if you can handle this delegated task. Capabilities: ${agentCapability}. Return JSON: {"canHandle": boolean, "response": "string", "estimatedTime": "string"}`
  const acceptResult = await executeAgentTask(supabase, userId, null,
    `You are being delegated this task: "${taskDescription}". Context: "${context}". Priority: ${priority}. Can you handle this?`, { systemPrompt: acceptPrompt }
  )

  let acceptance: any = {}
  try { acceptance = JSON.parse(acceptResult.response || '{}') } catch {}

  request.status = acceptance.canHandle ? 'accepted' : 'rejected'
  request.response = acceptance.response || `${toAgent} agent acknowledged the task.`

  if (acceptance.canHandle) {
    request.status = 'accepted'
    await supabase.from('voice_delegations').update({
      status: 'accepted', response: acceptance.response,
    }).eq('id', request.id)
  } else {
    request.status = 'rejected'
    request.toAgent = 'manager'
    await supabase.from('voice_delegations').update({
      status: 'rejected', to_agent: 'manager',
      response: `Escalated: ${acceptance.response || 'Task rejected by agent'}`,
    }).eq('id', request.id)
  }

  await storeMemory(supabase, userId, {
    category: 'voice_learning', tags: ['delegation', toAgent, priority],
    content: { delegationId: request.id, fromAgent: request.fromAgent, toAgent, task: taskDescription, status: request.status, priority, response: request.response, createdAt: request.createdAt },
  })

  return request
}

export async function processVoiceCommand(
  supabase: SupabaseClient,
  userId: string,
  command: string
): Promise<{ response: string; delegation?: VoiceDelegationRequest }> {
  const systemPrompt = `You are Jarvis, an executive voice AI. Determine if this voice command requires delegation or can be handled directly. Return JSON: {"needsDelegation": boolean, "taskDescription": "string", "context": "string", "priority": "low|medium|high|urgent", "directResponse": "string"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Voice command: "${command}". Decide: Can you handle this directly or does it need delegation to a specialist agent?`, { systemPrompt }
  )

  let parsed: any = {}
  try { parsed = JSON.parse(result.response || '{}') } catch {
    return { response: 'I understood your request. Let me process that.' }
  }

  if (!parsed.needsDelegation) {
    return { response: parsed.directResponse || 'Understood. Consider it done.' }
  }

  const delegation = await delegateVoiceTask(supabase, userId, parsed.taskDescription || command, parsed.context || command, parsed.priority || 'medium')
  return {
    response: `I'm delegating this to the ${delegation.toAgent} agent. ${delegation.response || ''}`,
    delegation,
  }
}

export async function getAgentStatuses(
  supabase: SupabaseClient,
  userId: string
): Promise<{ agent: VoiceAgentType; capability: string; activeTasks: number; status: string }[]> {
  const { data: delegations } = await supabase
    .from('voice_delegations')
    .select('to_agent, status')
    .eq('user_id', userId)

  const allDelegations = (delegations ?? []) as any[]
  const taskCounts: Record<string, number> = {}

  for (const d of allDelegations) {
    const agent = d.to_agent
    taskCounts[agent] = (taskCounts[agent] || 0) + 1
  }

  return (Object.entries(AGENT_CAPABILITIES) as [VoiceAgentType, string][]).map(([agent, capability]) => ({
    agent, capability,
    activeTasks: taskCounts[agent] || 0,
    status: (taskCounts[agent] || 0) > 0 ? 'active' : 'idle',
  }))
}
