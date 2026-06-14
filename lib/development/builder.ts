import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { type PlannerTask, type BuildResult, AGENT_SYSTEM_PROMPTS } from './types'

export class BuilderAgent {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async executeTask(task: PlannerTask, projectContext: string): Promise<BuildResult> {
    const startTime = Date.now()

    const prompt = `Execute this development task:

TASK TITLE: ${task.title}
DESCRIPTION: ${task.description}
AGENT TYPE: ${task.agentType}

PROJECT CONTEXT:
${projectContext}

You are building Inlight Agency OS — a Next.js 14 application with Supabase backend.

CRITICAL RULES:
1. ALWAYS use 'use client' for React components that use useState, useEffect, or event handlers
2. ALWAYS import from '@supabase/ssr' for server-side Supabase, '@supabase/supabase-js' on client
3. ALWAYS use createClient() from '@/lib/supabase/server' for server, createClient() from '@/lib/supabase/client' for client
4. ALWAYS use Tailwind CSS classes, never inline styles
5. ALWAYS add RLS policies for new tables with auth.uid() = user_id
6. NEVER use mock data — every function must make real API/DB calls
7. ALWAYS handle errors with try/catch and return proper error responses
8. ALWAYS export types from types.ts and re-export from index.ts

Return your implementation as code blocks with file paths:
\`\`\`tsx:path/to/file.tsx
// code here
\`\`\`

List all files you created or modified.`

    const result = await executeAgentTask(this.supabase, this.userId, null, prompt, {
      systemPrompt: AGENT_SYSTEM_PROMPTS[task.agentType as keyof typeof AGENT_SYSTEM_PROMPTS] || AGENT_SYSTEM_PROMPTS.backend,
    })

    const filesChanged = this.extractFiles(result.response || '')
    
    return {
      taskId: task.id,
      taskTitle: task.title,
      agentType: task.agentType,
      success: true,
      output: result.response || '',
      filesChanged,
      durationMs: Date.now() - startTime,
    }
  }

  private extractFiles(response: string): string[] {
    const files: string[] = []
    const pattern = /(?:\/\/|\/\*)\s*(?:File:|file:)?\s*([\w\/.-]+\.(?:tsx?|jsx?|css|sql|json|toml))/gi
    let match
    while ((match = pattern.exec(response)) !== null) {
      files.push(match[1].trim())
    }
    const blockPattern = /```\w+:(.+?)\n/g
    while ((match = blockPattern.exec(response)) !== null) {
      files.push(match[1].trim())
    }
    return [...new Set(files)]
  }
}
