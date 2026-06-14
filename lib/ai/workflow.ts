import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from './execution'
import { storeMemory } from './memory'
import { createAgentMessage } from '@/lib/supabase/orchestrator'
import { fetchAgents } from '@/lib/supabase/agents'
import { extractWorkflowLessons } from '@/lib/learning/patterns'

export interface WorkflowStep {
  agentType: string
  agentId: string | null
  systemPrompt: string
  label: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
}

export interface WorkflowStepResult {
  step: string
  agentType: string
  output: string
  duration_ms: number
  tokens_used: number
  status: string
}

export interface WorkflowResult {
  workflowId: string
  workflowName: string
  steps: WorkflowStepResult[]
  finalOutput: string
  totalDurationMs: number
  totalTokens: number
  status: string
}

const SAAS_BUILDER_WORKFLOW: Workflow = {
  id: 'saas-builder',
  name: 'SaaS Business Builder',
  description: 'End-to-end SaaS business strategy: CEO → Research → Marketing → Content',
  steps: [
    {
      agentType: 'ceo',
      agentId: null,
      label: 'CEO Strategy',
      systemPrompt: `You are a CEO agent. Create a high-level SaaS business strategy. Define the vision, target market, revenue model, and key milestones. Be specific and actionable. Output in clear sections.`,
    },
    {
      agentType: 'research',
      agentId: null,
      label: 'Market Research',
      systemPrompt: `You are a Research agent. Based on the CEO's strategy provided below, conduct market research. Identify competitors, market size, pricing benchmarks, and gaps in the market. Provide data-driven insights.`,
    },
    {
      agentType: 'marketing',
      agentId: null,
      label: 'Marketing Plan',
      systemPrompt: `You are a Marketing agent. Based on the CEO strategy and market research provided below, create a comprehensive marketing plan. Include channels, budget allocation, customer acquisition strategy, and launch timeline.`,
    },
    {
      agentType: 'content',
      agentId: null,
      label: 'Content Strategy',
      systemPrompt: `You are a Content agent. Based on all previous analysis, create a 30-day content strategy. Include content pillars, formats, distribution channels, and KPIs. Make it actionable.`,
    },
  ],
}

const MARKETING_STRATEGY_WORKFLOW: Workflow = {
  id: 'marketing-strategy',
  name: 'Marketing Strategy',
  description: 'Marketing → Research → Content — Build a complete marketing strategy',
  steps: [
    {
      agentType: 'marketing',
      agentId: null,
      label: 'Marketing Strategy',
      systemPrompt: `You are a Marketing agent. Create a comprehensive marketing strategy. Define target audience, channels, positioning, and budget allocation. Be specific and actionable.`,
    },
    {
      agentType: 'research',
      agentId: null,
      label: 'Market Research',
      systemPrompt: `You are a Research agent. Based on the marketing strategy below, conduct market research. Identify competitors, audience segments, market trends, and validate the chosen channels. Provide data-driven insights.`,
    },
    {
      agentType: 'content',
      agentId: null,
      label: 'Content Plan',
      systemPrompt: `You are a Content agent. Based on the marketing strategy and research below, create a 60-day content plan. Include content pillars, formats, distribution schedule, and KPIs. Make it actionable.`,
    },
  ],
}

const LEAD_GENERATION_WORKFLOW: Workflow = {
  id: 'lead-generation',
  name: 'Lead Generation',
  description: 'Research → Sales → Automation — Generate and qualify leads',
  steps: [
    {
      agentType: 'research',
      agentId: null,
      label: 'Lead Research',
      systemPrompt: `You are a Research agent. Identify target industries, ideal customer profiles, and lead sources. Research market segments with high conversion potential. Provide a detailed lead sourcing strategy.`,
    },
    {
      agentType: 'sales',
      agentId: null,
      label: 'Sales Outreach',
      systemPrompt: `You are a Sales agent. Based on the lead research below, create a sales outreach strategy. Define email sequences, call scripts, qualification criteria, and conversion goals. Make it actionable.`,
    },
    {
      agentType: 'automation',
      agentId: null,
      label: 'Automation Setup',
      systemPrompt: `You are an Automation agent. Based on the sales outreach plan below, design an automation workflow. Define triggers, email sequences, CRM updates, lead scoring, and follow-up schedules. Be specific about tools and integration points.`,
    },
  ],
}

const CLIENT_PROPOSAL_WORKFLOW: Workflow = {
  id: 'client-proposal',
  name: 'Client Proposal',
  description: 'Research → Sales → Content — Build a winning client proposal',
  steps: [
    {
      agentType: 'research',
      agentId: null,
      label: 'Client Research',
      systemPrompt: `You are a Research agent. Research the client's industry, company, competitors, and pain points. Identify opportunities where your services provide maximum value. Provide a detailed analysis.`,
    },
    {
      agentType: 'sales',
      agentId: null,
      label: 'Proposal Strategy',
      systemPrompt: `You are a Sales agent. Based on the client research below, create a proposal strategy. Define pricing, package tiers, value proposition, and negotiation approach. Be specific and persuasive.`,
    },
    {
      agentType: 'content',
      agentId: null,
      label: 'Proposal Writing',
      systemPrompt: `You are a Content agent. Based on the research and strategy below, write a compelling client proposal. Include executive summary, problem statement, solution, pricing, timeline, and call to action. Format professionally.`,
    },
  ],
}

const SEO_WORKFLOW: Workflow = {
  id: 'seo-strategy',
  name: 'SEO Strategy',
  description: 'Research → SEO → Content — Build a data-driven SEO strategy',
  steps: [
    {
      agentType: 'research',
      agentId: null,
      label: 'SEO Research',
      systemPrompt: `You are a Research agent. Conduct SEO research. Identify target keywords, search volume, competition level, and content gaps. Analyze top-ranking pages and provide a keyword opportunity map.`,
    },
    {
      agentType: 'seo',
      agentId: null,
      label: 'SEO Strategy',
      systemPrompt: `You are an SEO agent. Based on the research below, create a comprehensive SEO strategy. Define on-page optimization, technical SEO, link building, content clusters, and ranking targets. Provide a 90-day implementation plan.`,
    },
    {
      agentType: 'content',
      agentId: null,
      label: 'SEO Content',
      systemPrompt: `You are a Content agent. Based on the SEO strategy below, create a content plan targeting the identified keywords. Define content clusters, article topics, publishing schedule, and optimization guidelines.`,
    },
  ],
}

const AGENCY_GROWTH_WORKFLOW: Workflow = {
  id: 'agency-growth',
  name: 'Agency Growth',
  description: 'CEO → Sales → Marketing → Finance — Scale your agency',
  steps: [
    {
      agentType: 'ceo',
      agentId: null,
      label: 'Growth Strategy',
      systemPrompt: `You are a CEO agent. Create an agency growth strategy. Define revenue targets, team structure, service expansion, and market positioning. Be ambitious but realistic. Provide a 12-month roadmap.`,
    },
    {
      agentType: 'sales',
      agentId: null,
      label: 'Sales Growth',
      systemPrompt: `You are a Sales agent. Based on the growth strategy below, create a sales expansion plan. Define pipeline targets, conversion goals, team hiring, and retention strategies. Be specific about metrics.`,
    },
    {
      agentType: 'marketing',
      agentId: null,
      label: 'Marketing Scaling',
      systemPrompt: `You are a Marketing agent. Based on the growth strategy and sales plan below, create a scalable marketing plan. Define channels, budget scaling, lead generation targets, and brand positioning for growth phase.`,
    },
    {
      agentType: 'finance',
      agentId: null,
      label: 'Financial Planning',
      systemPrompt: `You are a Finance agent. Based on all previous analysis, create a financial plan. Define revenue projections, cost structure, profit margins, cash flow management, and reinvestment strategy. Provide specific numbers.`,
    },
  ],
}

const WORKFLOWS: Record<string, Workflow> = {
  'saas-builder': SAAS_BUILDER_WORKFLOW,
  'marketing-strategy': MARKETING_STRATEGY_WORKFLOW,
  'lead-generation': LEAD_GENERATION_WORKFLOW,
  'client-proposal': CLIENT_PROPOSAL_WORKFLOW,
  'seo-strategy': SEO_WORKFLOW,
  'agency-growth': AGENCY_GROWTH_WORKFLOW,
}

const WORKFLOW_MATCHING: Record<string, string> = {
  'saas': 'saas-builder', 'startup': 'saas-builder', 'business': 'saas-builder',
  'marketing': 'marketing-strategy', 'campaign': 'marketing-strategy',
  'advertising': 'marketing-strategy', 'promotion': 'marketing-strategy',
  'lead': 'lead-generation', 'leads': 'lead-generation',
  'prospecting': 'lead-generation', 'outreach': 'lead-generation',
  'proposal': 'client-proposal', 'pitch': 'client-proposal', 'proposals': 'client-proposal',
  'seo': 'seo-strategy', 'search engine': 'seo-strategy', 'ranking': 'seo-strategy', 'keyword': 'seo-strategy',
  'growth': 'agency-growth', 'scale': 'agency-growth', 'expand': 'agency-growth',
}

export function getWorkflow(id: string): Workflow | undefined {
  return WORKFLOWS[id]
}

export function listWorkflows(): Workflow[] {
  return Object.values(WORKFLOWS)
}

export function matchWorkflow(input: string): string | null {
  const lower = input.toLowerCase()
  for (const [keyword, workflowId] of Object.entries(WORKFLOW_MATCHING)) {
    if (lower.includes(keyword)) return workflowId
  }
  return null
}

export async function runWorkflow(
  supabase: SupabaseClient,
  userId: string,
  workflowId: string,
  userInput: string
): Promise<WorkflowResult> {
  const workflow = WORKFLOWS[workflowId]
  if (!workflow) throw new Error(`Workflow '${workflowId}' not found`)

  const stepResults: WorkflowStepResult[] = []
  let context = userInput

  // Resolve existing agents by type for inter-agent messaging
  const allAgents = await fetchAgents(supabase)
  const agentByType = new Map<string, string>()
  for (const a of allAgents) {
    if (a.type && !agentByType.has(a.type)) agentByType.set(a.type, a.id)
  }

  for (const step of workflow.steps) {
    const stepPrompt = `${step.label} — Input context:\n\n${context}\n\nGenerate your output based on the context above.`

    const result = await executeAgentTask(supabase, userId, step.agentId, stepPrompt, {
      systemPrompt: step.systemPrompt,
    })

    const stepResult: WorkflowStepResult = {
      step: step.label,
      agentType: step.agentType,
      output: result.response || '',
      duration_ms: result.duration_ms,
      tokens_used: result.tokens_used,
      status: result.status,
    }
    stepResults.push(stepResult)

    // Persist step output to agent memory for Company Brain
    await storeMemory(supabase, userId, {
      category: 'workflow_output',
      content: {
        workflowId,
        workflowName: workflow.name,
        stepLabel: step.label,
        agentType: step.agentType,
        output: result.response,
      },
      tags: [workflowId, step.agentType],
    })

    // Send inter-agent message to next step if both agents exist
    const stepIndex = workflow.steps.indexOf(step)
    if (stepIndex < workflow.steps.length - 1) {
      const nextType = workflow.steps[stepIndex + 1].agentType
      const fromId = agentByType.get(step.agentType)
      const toId = agentByType.get(nextType)
      if (fromId && toId) {
        await createAgentMessage(supabase, userId, {
          from_agent_id: fromId,
          to_agent_id: toId,
          message: (result.response || '').slice(0, 3000),
        })
      }
    }

    context = `Previous step (${step.label}) output:\n${result.response || '(no output)'}\n\n`
  }

  const finalOutput = stepResults
    .map((s) => `=== ${s.step} (${s.agentType}) ===\n${s.output}`)
    .join('\n\n')

  const status = stepResults.every((s) => s.status === 'completed') ? 'completed' : 'partial'

  // Extract lessons learned for self-evolving Company Brain
  try {
    await extractWorkflowLessons(supabase, userId, workflowId, workflow.name, stepResults, status)
  } catch { /* non-blocking */ }

  return {
    workflowId,
    workflowName: workflow.name,
    steps: stepResults,
    finalOutput,
    totalDurationMs: stepResults.reduce((sum, s) => sum + s.duration_ms, 0),
    totalTokens: stepResults.reduce((sum, s) => sum + s.tokens_used, 0),
    status,
  }
}
