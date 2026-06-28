import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { IntegrationSDK } from '@/lib/integrations/sdk'

export interface WhatsAppLeadScore {
  waId: string
  score: number
  criteria: {
    bant: { budget: number; authority: number; need: number; timeline: number }
    engagement: { messageCount: number; responseRate: number; averageSentiment: number }
    profile: { hasName: number; hasCompany: number; hasEmail: number }
  }
  label: 'hot' | 'warm' | 'cold' | 'unqualified'
  qualifyingQuestions: string[]
  lastQualifiedAt: string
}

const QUALIFICATION_QUESTIONS: Record<string, string[]> = {
  initial: [
    'What does your company do?',
    'What role do you play in decision-making?',
    'What challenges are you currently facing?',
    'What timeline are you working with?',
    'Have you allocated budget for this?',
  ],
  followup: [
    'What solutions have you tried before?',
    'What would a successful outcome look like?',
    'Who else needs to be involved in this decision?',
    'What\'s your target budget range?',
    'How urgent is this for you?',
  ],
}

export async function qualifyLeadFromConversation(
  supabase: SupabaseClient,
  userId: string,
  waId: string,
  messages: { body: string; isIncoming: boolean }[]
): Promise<WhatsAppLeadScore> {
  const conversation = messages.map(m => `${m.isIncoming ? 'Prospect' : 'AI'}: ${m.body}`).join('\n')
  const systemPrompt = `You are a BANT lead qualification specialist for WhatsApp conversations. Analyze the conversation and return JSON: {"score": 0-100, "bant": {"budget": 0-100, "authority": 0-100, "need": 0-100, "timeline": 0-100}, "engagement": {"messageCount": number, "responseRate": 0-1, "averageSentiment": 0-1}, "missingInfo": ["string"], "label": "hot|warm|cold|unqualified", "notes": "string", "suggestedNextAction": "string"}`
  const result = await executeAgentTask(supabase, userId, null,
    `Qualify this lead based on WhatsApp conversation:\n\n${conversation}`, { systemPrompt }
  )

  let parsed: any = {}
  try { parsed = JSON.parse(result.response || '{}') } catch {}

  const score: WhatsAppLeadScore = {
    waId, score: parsed.score || 0,
    criteria: {
      bant: {
        budget: parsed.bant?.budget || 0,
        authority: parsed.bant?.authority || 0,
        need: parsed.bant?.need || 0,
        timeline: parsed.bant?.timeline || 0,
      },
      engagement: {
        messageCount: parsed.engagement?.messageCount || messages.length,
        responseRate: parsed.engagement?.responseRate || 0.5,
        averageSentiment: parsed.engagement?.averageSentiment || 0.5,
      },
      profile: {
        hasName: 0, hasCompany: 0, hasEmail: 0,
      },
    },
    label: parsed.label || 'unqualified',
    qualifyingQuestions: parsed.missingInfo || QUALIFICATION_QUESTIONS.initial,
    lastQualifiedAt: new Date().toISOString(),
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('name, email, company')
    .eq('user_id', userId)
    .eq('whatsapp', waId)
    .limit(1)
    .maybeSingle()

  if (contact) {
    if ((contact as any).name) score.criteria.profile.hasName = 100
    if ((contact as any).company) score.criteria.profile.hasCompany = 100
    if ((contact as any).email) score.criteria.profile.hasEmail = 100
  }

  const totalBant = (score.criteria.bant.budget + score.criteria.bant.authority + score.criteria.bant.need + score.criteria.bant.timeline) / 4
  const engagementAvg = score.criteria.engagement.averageSentiment * 100
  const profileAvg = (score.criteria.profile.hasName + score.criteria.profile.hasCompany + score.criteria.profile.hasEmail) / 3
  score.score = Math.round(totalBant * 0.5 + engagementAvg * 0.25 + profileAvg * 0.25)

  if (score.score >= 70) score.label = 'hot'
  else if (score.score >= 50) score.label = 'warm'
  else if (score.score >= 25) score.label = 'cold'
  else score.label = 'unqualified'

  await supabase.from('leads').upsert({
    user_id: userId, name: (contact as any)?.name || null,
    phone: waId, source: 'whatsapp', status: score.label === 'hot' ? 'qualified' : 'new',
    score: score.score,
  }, { onConflict: 'user_id,phone' })

  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: ['qualification', waId, score.label],
    content: { type: 'lead_qualified', waId, score: score.score, label: score.label, bant: score.criteria.bant },
  })

  return score
}

export async function sendQualificationQuestions(
  supabase: SupabaseClient,
  userId: string,
  waId: string,
  stage: 'initial' | 'followup' = 'initial'
): Promise<string[]> {
  const questions = QUALIFICATION_QUESTIONS[stage]
  const sdk = new IntegrationSDK(supabase, userId)

  const { data: lead } = await supabase
    .from('leads')
    .select('qualification_stage')
    .eq('user_id', userId)
    .eq('phone', waId)
    .limit(1)
    .maybeSingle()

  if (lead && (lead as any).qualification_stage === 'completed') {
    return []
  }

  for (let i = 0; i < questions.length; i += 3) {
    const batch = questions.slice(i, i + 3)
    const body = batch.join('\n\n')
    await sdk.executeAction('whatsapp', 'send_text', { to: waId, text: body })
  }

  await supabase.from('leads').update({
    qualification_stage: stage === 'initial' ? 'initial_sent' : 'followup_sent',
  }).eq('user_id', userId).eq('phone', waId)

  return questions
}

export async function getLeadScoreByWA(
  supabase: SupabaseClient,
  userId: string,
  waId: string
): Promise<WhatsAppLeadScore | null> {
  const { data: memories } = await supabase
    .from('agent_memory')
    .select('content')
    .eq('user_id', userId)
    .eq('category', 'whatsapp')
    .contains('tags', ['qualification', waId])
    .order('created_at', { ascending: false })
    .limit(1)

  if (!memories?.length) return null
  return (memories[0] as any).content as WhatsAppLeadScore
}

export async function getQualificationStats(
  supabase: SupabaseClient,
  userId: string
): Promise<{ total: number; hot: number; warm: number; cold: number; unqualified: number; avgScore: number }> {
  const { data: leads } = await supabase
    .from('leads')
    .select('score, status, source')
    .eq('user_id', userId)
    .eq('source', 'whatsapp')

  const filtered = (leads ?? []) as any[]
  const total = filtered.length
  const scored = filtered.filter((l: any) => l.score > 0)

  return {
    total,
    hot: scored.filter((l: any) => l.score >= 70).length,
    warm: scored.filter((l: any) => l.score >= 50 && l.score < 70).length,
    cold: scored.filter((l: any) => l.score >= 25 && l.score < 50).length,
    unqualified: scored.filter((l: any) => l.score < 25).length,
    avgScore: scored.length > 0 ? Math.round(scored.reduce((s: number, l: any) => s + (l.score || 0), 0) / scored.length) : 0,
  }
}

export async function routeQualifiedLead(
  supabase: SupabaseClient,
  userId: string,
  waId: string,
  score: WhatsAppLeadScore
): Promise<string> {
  if (score.label === 'hot') {
    const sdk = new IntegrationSDK(supabase, userId)
    await sdk.executeAction('whatsapp', 'send_text', {
      to: waId,
      text: 'Great news — it sounds like we can really help you! One of our senior team members will reach out shortly to discuss next steps. In the meantime, would you like to book a call?',
    })

    await storeMemory(supabase, userId, {
      category: 'whatsapp', tags: ['routing', waId, 'hot'],
      content: { type: 'lead_routed', waId, action: 'schedule_call', score: score.score },
    })

    return 'schedule_call'
  }

  if (score.label === 'warm') {
    const questions = await sendQualificationQuestions(supabase, userId, waId, 'followup')
    return 'send_followup'
  }

  if (score.label === 'cold') {
    await supabase.from('leads').update({ status: 'contacted' })
      .eq('user_id', userId).eq('phone', waId)

    return 'nurture'
  }

  return 'no_action'
}
