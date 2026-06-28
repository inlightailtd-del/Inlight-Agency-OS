let LangfuseClient: any = null

function getClient() {
  if (LangfuseClient) return LangfuseClient
  try {
    const { Langfuse } = require('langfuse')
    LangfuseClient = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY || '',
      publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      enabled: !!process.env.LANGFUSE_SECRET_KEY,
    })
  } catch {
    LangfuseClient = null
  }
  return LangfuseClient
}

export async function traceLLMCall(params: {
  agent: string
  model: string
  prompt: string
  response: string
  durationMs: number
  tokensIn?: number
  tokensOut?: number
  userId?: string
  metadata?: Record<string, any>
}): Promise<void> {
  const client = getClient()
  if (!client) return

  const trace = client.trace({
    name: `llm_${params.agent}`,
    userId: params.userId,
    metadata: params.metadata,
  })

  trace.generation({
    name: params.agent,
    model: params.model,
    input: params.prompt,
    output: params.response,
    usage: {
      input: params.tokensIn,
      output: params.tokensOut,
      unit: 'TOKENS',
    },
    latency: params.durationMs / 1000,
  })

  await client.flushAsync()
}

export async function traceAgentExecution(params: {
  agent: string
  action: string
  input: any
  output: any
  durationMs: number
  userId?: string
  success: boolean
  metadata?: Record<string, any>
}): Promise<void> {
  const client = getClient()
  if (!client) return

  const trace = client.trace({
    name: `agent_${params.agent}`,
    userId: params.userId,
    metadata: { action: params.action, success: params.success, ...params.metadata },
  })

  trace.span({
    name: params.action,
    input: params.input,
    output: params.output,
    latency: params.durationMs / 1000,
  })

  await client.flushAsync()
}

export function isObservabilityEnabled(): boolean {
  return !!process.env.LANGFUSE_SECRET_KEY || !!process.env.NEXT_PUBLIC_SENTRY_DSN
}
