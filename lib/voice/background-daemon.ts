import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { detectInterruption, handleInterruption } from './interruptions'
import { getPendingApprovals, readApprovalsAloud } from './voice-approvals'
import { searchVoiceMemory } from './voice-memory'

export type DaemonMode = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export interface DaemonState {
  mode: DaemonMode
  activeSince: string
  lastActivity: string
  totalUtterances: number
  totalInterruptions: number
  sessionsMonitored: number
  approvalsProcessed: number
  memoriesQueried: number
  errorCount: number
}

export interface DaemonCommand {
  id: string
  type: 'query' | 'approval' | 'delegation' | 'interruption' | 'report' | 'status' | 'custom'
  input: string
  response: string
  handledAt: string
  confidence: number
}

export async function initializeDaemon(supabase: SupabaseClient, userId: string): Promise<DaemonState> {
  const state: DaemonState = {
    mode: 'idle', activeSince: new Date().toISOString(),
    lastActivity: new Date().toISOString(), totalUtterances: 0,
    totalInterruptions: 0, sessionsMonitored: 0,
    approvalsProcessed: 0, memoriesQueried: 0,
    errorCount: 0,
  }

  await storeMemory(supabase, userId, {
    category: 'voice_learning', tags: ['daemon', 'initialized'],
    content: { type: 'daemon_state', state, initializedAt: state.activeSince },
  })

  return state
}

export async function processDaemonUtterance(
  supabase: SupabaseClient,
  userId: string,
  state: DaemonState,
  utterance: string,
  context?: { sessionId?: string; aiSpeaking?: boolean; contextBefore?: string }
): Promise<{ response: string; command: DaemonCommand; newState: DaemonState }> {
  state.mode = 'processing'
  state.totalUtterances++
  state.lastActivity = new Date().toISOString()

  const systemPrompt = `You are a voice background daemon for an AI agency OS. Classify this utterance. Return JSON: {"commandType": "query|approval|delegation|interruption|report|status|custom", "confidence": 0-1, "requiresAction": boolean, "intent": "string", "entities": {"key": "value"}, "shouldRespond": boolean, "responseTone": "professional|casual|urgent|brief"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Classify this user utterance: "${utterance}". Determine the intent and whether it requires action.`, { systemPrompt }
  )

  let classification: any = {}
  try { classification = JSON.parse(result.response || '{}') } catch {}

  let response = ''
  const commandType = classification.commandType || 'custom'

  try {
    switch (commandType) {
      case 'approval': {
        const text = await readApprovalsAloud(supabase, userId)
        response = text
        state.approvalsProcessed++
        break
      }
      case 'query': {
        const memories = await searchVoiceMemory(supabase, userId, utterance)
        if (memories.length > 0) {
          const qPrompt = `You are a voice assistant. Answer based on conversation memory. Keep it brief and conversational.`
          const qResult = await executeAgentTask(supabase, userId, null,
            `User asked: "${utterance}". Based on these memories: ${JSON.stringify(memories.slice(0, 3))}. Provide a helpful spoken response.`, { systemPrompt: qPrompt }
          )
          response = qResult.response || `I found ${memories.length} relevant conversations.`
        } else {
          response = `I checked the conversation memory but couldn't find anything about "${utterance}".`
        }
        state.memoriesQueried++
        break
      }
      case 'interruption': {
        const event = await detectInterruption(supabase, userId, context?.sessionId || 'daemon', utterance, context?.aiSpeaking || false, context?.contextBefore || '')
        if (event) {
          response = await handleInterruption(supabase, userId, event)
          state.totalInterruptions++
        } else {
          response = ''
        }
        break
      }
      case 'report': {
        const rPrompt = `You are Jarvis, the AI voice assistant. Generate a brief status report. Keep it under 30 seconds when read aloud.`
        const rResult = await executeAgentTask(supabase, userId, null,
          `Generate a brief spoken status report. Include: ${state.sessionsMonitored} sessions monitored, ${state.totalInterruptions} interruptions handled, ${state.approvalsProcessed} approvals processed.`, { systemPrompt: rPrompt }
        )
        response = rResult.response || 'All systems operating normally.'
        break
      }
      case 'status': {
        const activeMinutes = Math.round((Date.now() - new Date(state.activeSince).getTime()) / 60000)
        response = `I have been active for ${activeMinutes} minutes. Monitored ${state.sessionsMonitored} sessions, handled ${state.totalInterruptions} interruptions, processed ${state.approvalsProcessed} approvals. ${state.errorCount} errors logged.`
        break
      }
      default: {
        const dPrompt = `You are Jarvis, an AI voice assistant. Respond conversationally and helpfully. Keep responses brief for spoken delivery.`
        const dResult = await executeAgentTask(supabase, userId, null,
          `The user said: "${utterance}". Respond naturally and helpfully. Keep it brief.`, { systemPrompt: dPrompt }
        )
        response = dResult.response || 'I understand. Let me process that.'
      }
    }
  } catch (err: any) {
    state.errorCount++
    response = 'I encountered an error processing that request. Please try again.'
  }

  const command: DaemonCommand = {
    id: 'cmd_' + Date.now(),
    type: commandType, input: utterance,
    response, handledAt: new Date().toISOString(),
    confidence: classification.confidence || 0.5,
  }

  state.mode = response ? 'speaking' : 'listening'

  return { response, command, newState: state }
}

export async function getDaemonStatus(supabase: SupabaseClient, userId: string): Promise<DaemonState | null> {
  const { data: memories } = await supabase
    .from('agent_memory')
    .select('content')
    .eq('user_id', userId)
    .eq('category', 'voice_learning')
    .contains('tags', ['daemon_state'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (!memories?.length) return null
  const daemonState = (memories[0] as any).content?.state
  return daemonState || null
}

export async function heartbeat(
  supabase: SupabaseClient,
  userId: string,
  state: DaemonState
): Promise<void> {
  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[Voice Daemon] Heartbeat', module: 'voice', status: 'success',
    message: `Mode: ${state.mode}, Utterances: ${state.totalUtterances}, Sessions: ${state.sessionsMonitored}, Approvals: ${state.approvalsProcessed}`,
  }])
}
