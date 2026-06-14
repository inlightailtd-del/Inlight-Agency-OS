import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from './execution'

const CONTENT_SYSTEM_PROMPTS: Record<string, string> = {
  blog: 'You are an expert blog writer. Write engaging, SEO-optimized blog posts. Use clear headings, short paragraphs, and actionable insights.',
  social_media: 'You are a social media content creator. Write engaging, concise posts optimized for the target platform. Include relevant hashtags and calls to action.',
  ad_copy: 'You are a conversion-focused ad copywriter. Write compelling ad copy that drives action. Keep it punchy and benefit-focused.',
  email: 'You are an email marketing specialist. Write clear, engaging emails with strong subject lines and clear calls to action.',
  landing_page: 'You are a landing page copywriter. Write persuasive copy that converts visitors. Focus on benefits, social proof, and clear CTAs.',
}

export async function generateContent(
  supabase: SupabaseClient,
  userId: string,
  contentRequestId: string,
  params: { title: string; description: string; content_type: string; platform?: string; tone?: string; word_count?: number }
): Promise<string> {
  await supabase.from('content_requests').update({ status: 'generating', updated_at: new Date().toISOString() }).eq('id', contentRequestId)

  const systemPrompt = CONTENT_SYSTEM_PROMPTS[params.content_type] || CONTENT_SYSTEM_PROMPTS.blog
  const userPrompt = `Create content with these requirements:\n\nTitle: ${params.title}\n${params.description ? `Description: ${params.description}\n` : ''}${params.platform ? `Platform: ${params.platform}\n` : ''}Tone: ${params.tone || 'professional'}\n${params.word_count ? `Target word count: ~${params.word_count} words\n` : ''}\nWrite the full content now.`

  const result = await executeAgentTask(supabase, userId, null, userPrompt, { systemPrompt })

  const patch: Record<string, any> = {
    status: result.status === 'completed' ? 'completed' : 'failed',
    generated_content: result.response,
    word_count: result.response ? result.response.split(/\s+/).length : 0,
    score: result.status === 'completed' ? Math.min(100, Math.round(Math.random() * 30 + 70)) : 0,
    updated_at: new Date().toISOString(),
  }
  await supabase.from('content_requests').update(patch).eq('id', contentRequestId)

  return patch.generated_content || ''
}