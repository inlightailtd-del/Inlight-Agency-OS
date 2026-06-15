/**
 * Marketing Skills System — Reusable marketing capabilities
 *
 * Skills are composable, loadable modules that agents can use.
 * Each skill: name, description, systemPrompt (injected into AI calls),
 * tools (what tools to enable), and agentTypes (which agents can use it).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Skill Definition ───────────────────────────────────────

export interface MarketingSkill {
  id: string
  name: string
  description: string
  category: 'seo' | 'copywriting' | 'lead_generation' | 'email_marketing' | 'social_media' | 'paid_ads'
  systemPrompt: string       // injected into agent system prompt
  tools: string[]            // tool names to enable
  agentTypes: string[]       // which agent types can load this
}

// ─── Skill Library ──────────────────────────────────────────

const SKILL_LIBRARY: Record<string, MarketingSkill> = {
  // ─── SEO ─────────────────────────────────────────────────
  seo_keyword_research: {
    id: 'seo_keyword_research',
    name: 'SEO Keyword Research',
    description: 'Research keywords, analyze search volume, competition, and content gaps',
    category: 'seo',
    systemPrompt: `You have SEO Keyword Research capabilities.
- Analyze target keywords for search volume and competition
- Identify content gaps and ranking opportunities
- Create keyword clusters and topic maps
- Recommend content optimizations based on keyword data`,
    tools: ['company_brain_search', 'workflow_history'],
    agentTypes: ['seo', 'marketing', 'content'],
  },
  seo_on_page: {
    id: 'seo_on_page',
    name: 'On-Page SEO',
    description: 'Optimize content for search engines with proper structure, metadata, and keywords',
    category: 'seo',
    systemPrompt: `You have On-Page SEO capabilities.
- Optimize title tags, meta descriptions, and headings
- Structure content for featured snippets
- Optimize internal linking and page hierarchy
- Ensure proper keyword density and semantic relevance`,
    tools: ['company_brain_search', 'content_database'],
    agentTypes: ['seo', 'content'],
  },

  // ─── Copywriting ─────────────────────────────────────────
  copywriting_blog: {
    id: 'copywriting_blog',
    name: 'Blog Copywriting',
    description: 'Write engaging, SEO-optimized blog posts that drive traffic and conversions',
    category: 'copywriting',
    systemPrompt: `You have Blog Copywriting capabilities.
- Write engaging blog posts with clear structure and actionable insights
- Optimize for SEO while maintaining readability
- Include compelling headlines, subheadings, and calls to action
- Adapt tone to brand voice while maximizing engagement`,
    tools: ['company_brain_search', 'content_database', 'create_content_request'],
    agentTypes: ['content', 'marketing'],
  },
  copywriting_conversion: {
    id: 'copywriting_conversion',
    name: 'Conversion Copywriting',
    description: 'Write persuasive copy for landing pages, ads, and sales materials',
    category: 'copywriting',
    systemPrompt: `You have Conversion Copywriting capabilities.
- Write persuasive copy that drives conversions
- Focus on benefits, social proof, and clear CTAs
- Create urgency and scarcity where appropriate
- A/B test different messaging approaches`,
    tools: ['company_brain_search', 'create_content_request'],
    agentTypes: ['content', 'marketing', 'sales'],
  },

  // ─── Lead Generation ─────────────────────────────────────
  lead_gen_qualification: {
    id: 'lead_gen_qualification',
    name: 'Lead Qualification',
    description: 'Score and qualify leads based on fit, intent, and engagement signals',
    category: 'lead_generation',
    systemPrompt: `You have Lead Qualification capabilities.
- Score leads based on demographic fit, behavioral signals, and engagement
- Identify hot leads that need immediate follow-up
- Segment leads by industry, company size, and intent
- Recommend personalized outreach strategies per segment`,
    tools: ['lead_database', 'company_brain_search', 'create_lead_task'],
    agentTypes: ['sales', 'marketing'],
  },
  lead_gen_outreach: {
    id: 'lead_gen_outreach',
    name: 'Lead Outreach',
    description: 'Create personalized outreach sequences for lead conversion',
    category: 'lead_generation',
    systemPrompt: `You have Lead Outreach capabilities.
- Create personalized email and message sequences
- Craft compelling value propositions per lead segment
- Design follow-up cadences that maximize response rates
- Track and optimize conversion at each outreach stage`,
    tools: ['lead_database', 'create_lead_task', 'workflow_history'],
    agentTypes: ['sales'],
  },

  // ─── Email Marketing ─────────────────────────────────────
  email_campaigns: {
    id: 'email_campaigns',
    name: 'Email Campaign Strategy',
    description: 'Plan and execute email marketing campaigns with segmentation and automation',
    category: 'email_marketing',
    systemPrompt: `You have Email Marketing capabilities.
- Plan email campaigns with clear goals and audience segments
- Write compelling subject lines and email copy
- Design automation sequences (welcome, nurture, re-engagement)
- Track and optimize open rates, click rates, and conversions`,
    tools: ['lead_database', 'create_content_request', 'workflow_history'],
    agentTypes: ['marketing', 'automation'],
  },

  // ─── Social Media ────────────────────────────────────────
  social_media_strategy: {
    id: 'social_media_strategy',
    name: 'Social Media Strategy',
    description: 'Plan social media content, posting schedules, and engagement strategies',
    category: 'social_media',
    systemPrompt: `You have Social Media capabilities.
- Plan content calendars across LinkedIn, Twitter, Instagram, Facebook
- Write platform-optimized posts with hashtags and CTAs
- Schedule content for optimal engagement times
- Track and analyze post performance metrics`,
    tools: ['content_database', 'company_brain_search', 'create_content_request'],
    agentTypes: ['marketing', 'content'],
  },

  // ─── Paid Ads ────────────────────────────────────────────
  paid_ads_strategy: {
    id: 'paid_ads_strategy',
    name: 'Paid Ads Strategy',
    description: 'Plan and optimize paid advertising campaigns across platforms',
    category: 'paid_ads',
    systemPrompt: `You have Paid Advertising capabilities.
- Plan ad campaigns with clear objectives and target audiences
- Write compelling ad copy for different platforms
- Define budget allocation and bidding strategies
- Recommend A/B test structures for creative optimization`,
    tools: ['company_brain_search', 'create_content_request'],
    agentTypes: ['marketing', 'automation'],
  },
}

// ─── API ────────────────────────────────────────────────────

export function listSkills(): MarketingSkill[] {
  return Object.values(SKILL_LIBRARY)
}

export function getSkill(id: string): MarketingSkill | undefined {
  return SKILL_LIBRARY[id]
}

export function getSkillsForAgent(agentType: string): MarketingSkill[] {
  return Object.values(SKILL_LIBRARY).filter((s) => s.agentTypes.includes(agentType))
}

export function getSkillsByCategory(category: MarketingSkill['category']): MarketingSkill[] {
  return Object.values(SKILL_LIBRARY).filter((s) => s.category === category)
}

export function getSkillSystemPrompt(agentType: string): string {
  const skills = getSkillsForAgent(agentType)
  if (skills.length === 0) return ''
  return skills.map((s) => s.systemPrompt).join('\n\n')
}

export function getSkillToolNames(agentType: string): string[] {
  const skills = getSkillsForAgent(agentType)
  const toolSet = new Set<string>()
  for (const s of skills) {
    for (const t of s.tools) toolSet.add(t)
  }
  return Array.from(toolSet)
}

export async function loadSkillsForAgent(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
  agentType: string
): Promise<string[]> {
  const skills = getSkillsForAgent(agentType)
  const skillIds = skills.map((s) => s.id)

  if (skillIds.length > 0) {
    await supabase.from('agents').update({
      skills: skillIds,
      updated_at: new Date().toISOString(),
    }).eq('id', agentId)
  }

  return skillIds
}
