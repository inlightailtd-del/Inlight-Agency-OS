import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export type InterruptionType = 'barge_in' | 'question' | 'correction' | 'clarification' | 'stop' | 'change_topic' | 'repeat'

export interface InterruptionEvent {
  id: string
  sessionId: string
  type: InterruptionType
  timestamp: string
  detectedAt: number
  userSpeech: string
  aiResponse: string | null
  handled: boolean
  handlingStrategy: string
  contextBefore: string
}

export interface TurnState {
  speaker: 'ai' | 'user'
  startedAt: number
  utteranceCount: number
  interruptions: number
  lastInterruptionAt: number | null
  isBargeIn: boolean
}

export async function detectInterruption(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  userSpeech: string,
  aiSpeaking: boolean,
  contextBefore: string
): Promise<InterruptionEvent | null> {
  if (!userSpeech?.trim()) return null

  const systemPrompt = `You are a voice conversation interruption detector. Analyze if the user is interrupting. Return JSON: {"isInterruption": boolean, "type": "barge_in|question|correction|clarification|stop|change_topic|repeat", "confidence": 0-1, "shouldHandle": boolean, "handlingStrategy": "pause_and_listen|acknowledge_and_continue|stop_and_respond|clarify|change_direction", "reasoning": "string"}`
  const result = await executeAgentTask(supabase, userId, null,
    `User just said: "${userSpeech}". AI was ${aiSpeaking ? 'speaking' : 'listening'}. Previous context: "${contextBefore?.slice(-200)}". Detect if this is an interruption and determine the best handling strategy.`, { systemPrompt }
  )

  let detection: any = {}
  try { detection = JSON.parse(result.response || '{}') } catch { return null }
  if (!detection.isInterruption) return null

  const event: InterruptionEvent = {
    id: 'int_' + Date.now(),
    sessionId, type: detection.type || 'barge_in',
    timestamp: new Date().toISOString(),
    detectedAt: Date.now(),
    userSpeech, aiResponse: null,
    handled: false,
    handlingStrategy: detection.handlingStrategy || 'pause_and_listen',
    contextBefore,
  }

  await storeMemory(supabase, userId, {
    category: 'voice_learning', tags: [sessionId, 'interruption', event.type],
    content: { sessionId, type: event.type, userSpeech, strategy: event.handlingStrategy, confidence: detection.confidence, reasoning: detection.reasoning, detectedAt: event.timestamp },
  })

  return event
}

export async function handleInterruption(
  supabase: SupabaseClient,
  userId: string,
  event: InterruptionEvent
): Promise<string> {
  const strategyMap: Record<string, string> = {
    pause_and_listen: 'Pause current speech. Listen to the user completely before responding.',
    acknowledge_and_continue: 'Briefly acknowledge the interruption ("I hear you"), then continue with the current point.',
    stop_and_respond: "Stop immediately. Address the user's input directly.",
    clarify: 'Ask a clarifying question to understand what the user needs.',
    change_direction: 'Acknowledge the topic change and pivot the conversation.',
  }

  const strategy = strategyMap[event.handlingStrategy] || strategyMap.pause_and_listen
  const systemPrompt = `You are a voice AI handling an interruption. Strategy: ${strategy}. Generate a brief natural response. Return as plain text.`
  const result = await executeAgentTask(supabase, userId, null,
    `The user interrupted with: "${event.userSpeech}". Context before: "${event.contextBefore?.slice(-300)}". Respond appropriately using this strategy: ${strategy}`, { systemPrompt }
  )

  event.aiResponse = result.response || 'I understand. Please continue.'
  event.handled = true

  return event.aiResponse
}

export function determineBargeInPause(stage: string): number {
  const pauseMap: Record<string, number> = {
    greeting: 800, pitching: 400, objection: 600,
    closing: 700, followup: 500, qualification: 600,
    proposal: 300, appointment: 500,
  }
  return pauseMap[stage] || 500
}
