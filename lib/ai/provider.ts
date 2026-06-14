/*
 * AI Provider Abstraction Layer
 * Supports Ollama (default), OpenAI, Anthropic, Groq
 * All providers share a unified interface
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  model: string
  provider: string
  tokens_used: number
  duration_ms: number
}

export interface AIProviderConfig {
  provider: 'ollama' | 'openai' | 'anthropic' | 'groq'
  model: string
  api_url?: string
  api_key?: string
}

// Default config
const DEFAULT_CONFIG: AIProviderConfig = {
  provider: 'ollama',
  model: 'llama3.1',
  api_url: 'http://localhost:11434',
}

export async function generateAIResponse(
  config: AIProviderConfig,
  messages: AIMessage[]
): Promise<AIResponse> {
  const startTime = Date.now()
  const merged = { ...DEFAULT_CONFIG, ...config }

  try {
    switch (merged.provider) {
      case 'ollama':
        return await callOllama(merged, messages, startTime)
      case 'openai':
        return await callOpenAI(merged, messages, startTime)
      case 'anthropic':
        return await callAnthropic(merged, messages, startTime)
      case 'groq':
        return await callGroq(merged, messages, startTime)
      default:
        throw new Error(`Unsupported provider: ${merged.provider}`)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown AI error'
    return {
      content: `[Error] ${msg}`,
      model: merged.model,
      provider: merged.provider,
      tokens_used: 0,
      duration_ms: Date.now() - startTime,
    }
  }
}

async function callOllama(
  config: AIProviderConfig,
  messages: AIMessage[],
  startTime: number
): Promise<AIResponse> {
  const url = `${config.api_url}/api/chat`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, messages, stream: false }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error(`Ollama error: ${response.status}`)
  const data = await response.json()
  return {
    content: data.message?.content || '',
    model: config.model,
    provider: 'ollama',
    tokens_used: data.eval_count || 0,
    duration_ms: Date.now() - startTime,
  }
}

async function callOpenAI(
  config: AIProviderConfig,
  messages: AIMessage[],
  startTime: number
): Promise<AIResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.api_key}` },
    body: JSON.stringify({ model: config.model, messages }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: config.model,
    provider: 'openai',
    tokens_used: data.usage?.total_tokens || 0,
    duration_ms: Date.now() - startTime,
  }
}

async function callAnthropic(
  config: AIProviderConfig,
  messages: AIMessage[],
  startTime: number
): Promise<AIResponse> {
  const systemMsg = messages.find((m) => m.role === 'system')
  const userMsgs = messages.filter((m) => m.role !== 'system')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.api_key || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemMsg?.content,
      messages: userMsgs,
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error(`Anthropic error: ${response.status}`)
  const data = await response.json()
  return {
    content: data.content?.[0]?.text || '',
    model: config.model,
    provider: 'anthropic',
    tokens_used: data.usage?.input_tokens + (data.usage?.output_tokens || 0),
    duration_ms: Date.now() - startTime,
  }
}

async function callGroq(
  config: AIProviderConfig,
  messages: AIMessage[],
  startTime: number
): Promise<AIResponse> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.api_key}` },
    body: JSON.stringify({ model: config.model, messages }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error(`Groq error: ${response.status}`)
  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: config.model,
    provider: 'groq',
    tokens_used: data.usage?.total_tokens || 0,
    duration_ms: Date.now() - startTime,
  }
}