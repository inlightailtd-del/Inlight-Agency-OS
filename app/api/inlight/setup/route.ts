/**
 * Inlight Agency — Onboarding & First Company Setup
 *
 * POST /api/inlight/setup
 *
 * Seeds the platform with everything needed to run Inlight Agency itself:
 *   1. Creates agent definitions (CEO, Content, Sales, Marketing, Automation)
 *   2. Creates knowledge base documents (SOPs, service catalog, brand guide)
 *   3. Creates marketing goals and targets
 *   4. Creates sample client for dogfooding
 *   5. Enables the CEO scheduler
 *   6. Configures the daily cron for autonomous execution
 *
 * This makes Inlight Agency the first company running on the platform.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AGENT_DEFINITIONS = [
  {
    name: 'Inlight CEO',
    type: 'ceo',
    role: 'Chief Executive Agent',
    department: 'admin',
    description: 'Company-wide oversight, KPI monitoring, strategic planning, and department coordination for Inlight Agency.',
    performance_score: 85,
    status: 'active',
    config: {
      autonomy: { level: 3, requires_approval_for: ['delete_entity', 'budget_change', 'client_communication'] },
      schedule: { interval_minutes: 120 },
      events: ['ceo_assessment_needed'],
    },
  },
  {
    name: 'Inlight Content',
    type: 'content',
    role: 'Content Production Agent',
    department: 'marketing',
    description: 'Creates blog posts, social media content, email campaigns, and landing pages for Inlight Agency marketing.',
    performance_score: 80,
    status: 'active',
    config: {
      autonomy: { level: 3, requires_approval_for: ['client_communication'] },
      skills: ['copywriting_blog', 'copywriting_conversion', 'social_media_strategy'],
    },
  },
  {
    name: 'Inlight Sales',
    type: 'sales',
    role: 'Lead Development Agent',
    department: 'sales',
    description: 'Scores leads, detects opportunities, and manages the sales pipeline for Inlight Agency services.',
    performance_score: 75,
    status: 'active',
    config: {
      autonomy: { level: 2 },
      skills: ['lead_gen_qualification', 'lead_gen_outreach'],
    },
  },
  {
    name: 'Inlight Marketing',
    type: 'marketing',
    role: 'Growth Marketing Agent',
    department: 'marketing',
    description: 'Drives demand through campaigns, content distribution, and channel optimization for Inlight Agency.',
    performance_score: 78,
    status: 'active',
    config: {
      autonomy: { level: 3 },
      skills: ['seo_keyword_research', 'email_campaigns', 'paid_ads_strategy'],
    },
  },
  {
    name: 'Inlight Automation',
    type: 'automation',
    role: 'Operations & Automation Agent',
    department: 'admin',
    description: 'Handles project monitoring, queue processing, quality checks, and automated workflows for Inlight Agency operations.',
    performance_score: 82,
    status: 'active',
    config: {
      autonomy: { level: 3 },
      events: ['task_overdue', 'project_at_risk'],
    },
  },
  {
    name: 'Inlight Research',
    type: 'research',
    role: 'Market Intelligence Agent',
    department: 'marketing',
    description: 'Conducts market research, competitor analysis, trend detection, and content gap analysis for Inlight Agency.',
    performance_score: 70,
    status: 'idle',
    config: { autonomy: { level: 2 } },
  },
]

const KNOWLEDGE_DOCS = [
  {
    title: 'Inlight Agency — Service Catalog',
    category: 'guide',
    department: 'sales',
    tags: ['services', 'catalog', 'offerings'],
    content: `# Inlight Agency Service Catalog

## Core Services

### 1. AI Agency Operating System
The Inlight Agency OS is a complete platform for running an AI-powered digital agency. It includes CRM, project management, finance, AI agents, content factory, and company brain.

### 2. AI Agent Development
Custom AI agent development for agency operations. We build specialized agents for sales, marketing, content, support, and operations.

### 3. Content Factory Setup
End-to-end content production pipeline setup. AI-powered blog writing, social media content generation, email campaigns, and multi-channel publishing.

### 4. Agency Automation Consulting
Workflow automation strategy and implementation for agencies. Process optimization, tool integration, and autonomous execution setup.

### 5. AI Strategy & Training
Strategic consulting for AI adoption in agency operations. Team training, workflow redesign, and ROI measurement.

## Pricing Model
- Platform subscription: Tiered by team size
- Implementation: One-time setup fee
- Consulting: Hourly or project-based
- Training: Per-session or per-team`,
  },
  {
    title: 'Inlight Agency — Brand Voice & Messaging',
    category: 'guide',
    department: 'marketing',
    tags: ['brand', 'voice', 'messaging', 'content'],
    content: `# Inlight Agency Brand Voice

## Core Identity
Inlight Agency is the operating system for AI-powered agencies. We enable solo founders and small teams to run their agencies like enterprises — with AI agents handling the work while humans focus on strategy.

## Brand Voice Principles

### 1. Confident but Not Arrogant
We build the future of agency operations. We speak with authority backed by real technology.

### 2. Technical but Accessible
We explain complex AI concepts in plain language. No unnecessary jargon.

### 3. Action-Oriented
Every piece of content should drive action. We don't just inform — we enable.

### 4. Founder-First
We speak directly to the solo founder or small agency owner who needs to do more with less.

## Tone Guidelines
- Blog posts: Educational, authoritative, slightly conversational
- Social media: Punchy, insight-driven, engagement-focused
- Email: Direct, valuable, non-salesy
- Landing pages: Benefit-focused, clear, conversion-optimized

## Key Messaging Pillars
1. "Run your agency with AI — not more people"
2. "From solo to enterprise, without hiring"
3. "The operating system for AI-native agencies"
4. "Your agency, supercharged by AI agents"`,
  },
  {
    title: 'Inlight Agency Content Strategy — Q3 2026',
    category: 'sop',
    department: 'marketing',
    tags: ['content', 'strategy', 'q3-2026', 'marketing'],
    content: `# Q3 2026 Content Strategy

## Content Pillars
1. **AI Agency Operations** — How to run an agency with AI agents (40% of content)
2. **Solo Founder Growth** — Scaling from 1 to 10 figures without hiring (25%)
3. **Product Deep Dives** — Inlight OS features, updates, case studies (20%)
4. **Industry Analysis** — AI in agency landscape, trends, predictions (15%)

## Channel Strategy
- **LinkedIn**: Daily posts + 2 long-form articles/week (primary channel)
- **Blog**: 3 posts/week on inlight.ai/blog
- **Twitter/X**: 5 posts/day sharing insights and links
- **Email Newsletter**: Weekly digest every Tuesday
- **YouTube**: 2 videos/week (tutorials and strategy)

## Monthly Targets
- 30 blog posts
- 60 LinkedIn posts
- 100 Twitter posts
- 4 newsletter editions
- 8 YouTube videos
- 2 lead magnets (guides/templates)

## KPI Targets
- Blog traffic: 10,000 monthly visitors by end of Q3
- LinkedIn followers: 5,000 by end of Q3
- Email subscribers: 1,000 by end of Q3
- Qualified leads: 50/month by end of Q3
- Content-generated SQLs: 10/month by end of Q3`,
  },
  {
    title: 'Inlight Agency — Target Client Profiles',
    category: 'wiki',
    department: 'sales',
    tags: ['clients', 'target', 'persona', 'sales'],
    content: `# Target Client Profiles

## Profile 1: The Solo Agency Founder
- Runs a 1-5 person digital agency
- Services: web dev, design, marketing, consulting
- Pain point: Too much time on operations, not enough on client work
- Budget: $100-500/month for tools
- Decision trigger: Realizes they're spending 60% of time on admin

## Profile 2: The Small Agency Team
- Runs a 5-20 person agency
- Services: full-service digital (creative + tech + media)
- Pain point: Multiple tools don't talk to each other, no unified view
- Budget: $500-2,000/month for platform
- Decision trigger: Hires first operations person and realizes they need systems

## Profile 3: The Agency Founder 2.0
- Has been in business 3+ years
- Wants to scale without proportional headcount growth
- Pain point: Margins shrinking as team grows
- Budget: $2,000-5,000/month
- Decision trigger: Sees competitors using AI and getting better results

## Ideal Customer Profile Summary
- Role: Founder, CEO, or Operations Director at a digital agency
- Company size: 1-20 people
- Revenue: $100K-$5M
- Tech comfort: Moderate to high
- Primary need: Operations automation and AI integration`,
  },
  {
    title: 'Inlight Agency — Competitive Positioning',
    category: 'wiki',
    department: 'marketing',
    tags: ['competitive', 'positioning', 'market'],
    content: `# Competitive Positioning

## Direct Competitors
- **AgencyAnalytics**: Reporting-focused, no AI agents
- **Productive**: Agency management, no AI execution
- **Teamwork**: Project management, no autonomous features

## Our Differentiators
1. **AI-Native Architecture**: Built for AI agents from day one, not retrofitted
2. **Autonomous Execution**: Agents don't just suggest — they execute
3. **Company Brain**: Institutional memory that learns and improves
4. **Solo Founder Focus**: Designed for small teams, not enterprises
5. **All-in-One**: CRM + projects + finance + agents + content in one platform

## Market Position
Inlight competes at the intersection of:
- Agency management platforms (Productive, Teamwork)
- AI automation tools (Zapier, Make)
- Content platforms (Jasper, Copy.ai)
- CRM (HubSpot, Salesforce)

We replace 5+ tools with one AI-native platform.`,
  },
]

const MARKETING_GOALS = [
  {
    title: 'Q3 2026 — Content Volume Target',
    category: 'growth',
    target_value: 100,
    target_unit: 'pieces',
    timeframe: 'quarterly',
    description: 'Publish 100+ pieces of content across blog, LinkedIn, and Twitter by end of Q3 2026.',
    tags: ['content', 'q3-2026'],
  },
  {
    title: 'Q3 2026 — Lead Generation Target',
    category: 'sales',
    target_value: 150,
    target_unit: 'leads',
    timeframe: 'quarterly',
    description: 'Generate 150 qualified leads through content marketing, outreach, and organic channels.',
    tags: ['leads', 'q3-2026'],
  },
  {
    title: 'Q3 2026 — LinkedIn Audience Growth',
    category: 'growth',
    target_value: 5000,
    target_unit: 'followers',
    timeframe: 'quarterly',
    description: 'Grow LinkedIn following from current to 5,000 followers.',
    tags: ['linkedin', 'q3-2026'],
  },
  {
    title: 'Monthly — Revenue Target',
    category: 'revenue',
    target_value: 50000,
    target_unit: 'PKR',
    timeframe: 'monthly',
    description: 'Achieve PKR 50,000 monthly recurring revenue from platform subscriptions.',
    tags: ['revenue', 'monthly'],
  },
  {
    title: 'Weekly — Content Publishing',
    category: 'content',
    target_value: 7,
    target_unit: 'pieces',
    timeframe: 'weekly',
    description: 'Publish minimum 7 content pieces per week across all channels.',
    tags: ['content', 'weekly'],
  },
]

const SAMPLE_SERVICES = [
  { name: 'AI Agency OS Platform', type: 'ai_automation', description: 'Full platform subscription with all modules', price: 50000 },
  { name: 'Agent Development', type: 'ai_automation', description: 'Custom AI agent development for agency operations', price: 150000 },
  { name: 'Content Factory Setup', type: 'ai_automation', description: 'End-to-end AI content production pipeline', price: 100000 },
  { name: 'Agency Automation Audit', type: 'ai_automation', description: 'Process audit and automation roadmap', price: 75000 },
  { name: 'AI Strategy Consulting', type: 'ai_automation', description: 'Strategic AI adoption consulting for agencies', price: 50000 },
]

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const results: Record<string, any> = {}
    const errors: string[] = []
    const userId = user.id

    // 1. Create agents
    let agentsCreated = 0
    for (const agent of AGENT_DEFINITIONS) {
      const { error } = await supabase.from('agents').insert([{
        user_id: userId,
        ...agent,
        assigned_tasks: 0, assigned_projects: 0,
        total_executions: 0, success_rate: 100,
        avg_response_time_ms: 0, level: 1,
      }])
      if (error && !error.message.includes('duplicate')) errors.push(`Agent ${agent.name}: ${error.message}`)
      else agentsCreated++
    }
    results.agentsCreated = agentsCreated

    // 2. Create knowledge docs
    let docsCreated = 0
    for (const doc of KNOWLEDGE_DOCS) {
      const { error } = await supabase.from('knowledge_docs').insert([{
        user_id: userId,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        department: doc.department,
        tags: doc.tags,
        status: 'published',
        version: 1,
      }])
      if (error && !error.message.includes('duplicate')) errors.push(`Doc ${doc.title}: ${error.message}`)
      else docsCreated++
    }
    results.knowledgeDocsCreated = docsCreated

    // 3. Create marketing goals (in agent_memory as goal entries)
    let goalsCreated = 0
    for (const goal of MARKETING_GOALS) {
      const { error } = await supabase.from('agent_memory').insert([{
        user_id: userId,
        agent_id: null,
        category: 'goal',
        content: goal,
        tags: goal.tags,
      }])
      if (error && !error.message.includes('duplicate')) errors.push(`Goal ${goal.title}: ${error.message}`)
      else goalsCreated++
    }
    results.goalsCreated = goalsCreated

    // 4. Create sample services
    let servicesCreated = 0
    for (const svc of SAMPLE_SERVICES) {
      const { error } = await supabase.from('settings').insert([{
        user_id: userId,
        key: `service_${svc.name.toLowerCase().replace(/\s+/g, '_')}`,
        value: svc,
        updated_at: new Date().toISOString(),
      }])
      if (error && !error.message.includes('duplicate')) errors.push(`Service ${svc.name}: ${error.message}`)
      else servicesCreated++
    }
    results.servicesCreated = servicesCreated

    // 5. Enable CEO scheduler
    await supabase.from('settings').upsert([{
      user_id: userId,
      key: 'ceo_scheduler_config',
      value: { enabled: true, intervalMinutes: 120 },
      updated_at: new Date().toISOString(),
    }], { onConflict: 'user_id,key' })
    results.ceoSchedulerEnabled = true

    // 6. Schedule the automation agent for project monitoring
    const { data: automationAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'automation')
      .limit(1)
      .single()

    if (automationAgent) {
      // Register schedule in orchestrator_memory
      await supabase.from('orchestrator_memory').upsert([{
        user_id: userId,
        key: `schedule:${automationAgent.id}`,
        value: {
          agent_id: automationAgent.id,
          cron: 'every_2h',
          interval_minutes: 120,
          instruction: 'Run Project Monitor: scan all active projects for risks, overdue tasks, budget overruns, and stalled work. Report findings.',
          enabled: true,
          last_run: null,
        },
        updated_at: new Date().toISOString(),
      }, {
        user_id: userId,
        key: `schedule:ceo`,
        value: {
          cron: 'every_4h',
          interval_minutes: 240,
          instruction: 'Run CEO assessment: gather system state, review KPIs, generate insights and strategic tasks.',
          enabled: true,
          last_run: null,
        },
        updated_at: new Date().toISOString(),
      }], { onConflict: 'user_id,key' })
      results.schedulesRegistered = true
    }

    // 7. Create an orchestrator task to trigger the first CEO assessment
    await supabase.from('orchestrator_tasks').insert([{
      user_id: userId,
      title: 'Inlight Agency — First CEO Assessment',
      description: 'Run initial CEO assessment to establish baseline KPIs and generate first strategic recommendations.',
      status: 'pending',
      priority: 'high',
    }])

    // 8. Store onboarding completion in memory
    await supabase.from('agent_memory').insert([{
      user_id: userId,
      category: 'onboarding',
      content: {
        completedAt: new Date().toISOString(),
        agentsCreated,
        docsCreated,
        goalsCreated,
        servicesCreated,
      },
      tags: ['inlight', 'onboarding', 'setup'],
    }])

    return NextResponse.json({
      ok: true,
      message: 'Inlight Agency onboarded successfully',
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
