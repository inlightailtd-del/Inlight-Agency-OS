import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from './execution'

export async function analyzeLead(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
): Promise<{ score: number; analysis: string }> {
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (!lead) throw new Error('Lead not found')

  const systemPrompt = `You are a lead analysis AI. Analyze the lead and return ONLY a JSON response with:
{"score": <0-100>, "analysis": "<brief analysis>"}
Score based on: completeness of data, industry potential, company size signals, website quality.`
  const userPrompt = `Analyze this lead:\nName: ${lead.name}\nCompany: ${lead.company || 'N/A'}\nWebsite: ${lead.website || 'N/A'}\nEmail: ${lead.email || 'N/A'}\nIndustry: ${lead.industry || 'N/A'}\nCountry: ${lead.country || 'N/A'}\nSource: ${lead.source}`

  const result = await executeAgentTask(supabase, userId, null, userPrompt, { systemPrompt })

  let score = 50; let analysis = 'Analysis pending'
  try {
    const parsed = JSON.parse(result.response || '{}')
    score = parsed.score || 50
    analysis = parsed.analysis || 'No analysis available'
  } catch {
    analysis = result.response || 'Could not parse analysis'
  }

  await supabase.from('leads').update({ score, updated_at: new Date().toISOString() }).eq('id', leadId)
  return { score, analysis }
}

export async function scoreLeadsBatch(
  supabase: SupabaseClient,
  userId: string,
  leadIds: string[],
): Promise<{ id: string; score: number }[]> {
  const results: { id: string; score: number }[] = []
  for (const id of leadIds) {
    try {
      const { score } = await analyzeLead(supabase, userId, id)
      results.push({ id, score })
    } catch { results.push({ id, score: 0 }) }
  }
  return results
}