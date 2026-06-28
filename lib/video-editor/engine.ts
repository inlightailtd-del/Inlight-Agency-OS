import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { runFullVideoCycle, getVideoPipeline, type VideoMetrics } from '@/lib/video/engine'

export interface VideoEditorReport {
  summary: string
  pendingEdits: number
  completedEdits: number
  suggestedContent: string[]
  qualityRecommendations: string[]
}

export interface VideoProject {
  id?: string
  title: string
  type: 'short_form' | 'long_form' | 'reel' | 'ad' | 'social'
  status: 'planned' | 'in_production' | 'completed' | 'published'
  duration: string
  platform: string
  description: string
}

export class VideoEditorAgent {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async assessVideoPipeline(): Promise<VideoEditorReport> {
    const start = Date.now()
    const { data: videos } = await this.supabase
      .from('video_projects')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(20)

    const projects = (videos ?? []) as any[]
    const pending = projects.filter((v: any) => v.status === 'planned' || v.status === 'in_production')
    const completed = projects.filter((v: any) => v.status === 'completed' || v.status === 'published')

    const context = projects.map((v: any) =>
      `[${v.status}] ${v.title} — ${v.type || 'N/A'} — ${v.duration || 'N/A'} (${v.platform || 'N/A'})`
    ).join('\n')

    const systemPrompt = `You are a Video Production Director. Assess the video pipeline. Return JSON:
{
  "summary": "pipeline assessment",
  "suggestedContent": ["video idea 1"],
  "qualityRecommendations": ["rec1"]
}`

    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Current video projects:\n${context || 'No active video projects'}\n\nAssess the video pipeline and suggest improvements.`,
      { systemPrompt }
    )

    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.summary = result.response }

    await this.log('video_assessment', `${pending.length} pending, ${completed.length} completed | ${(Date.now() - start)}ms`)
    return {
      summary: parsed.summary || 'Video pipeline assessed',
      pendingEdits: pending.length,
      completedEdits: completed.length,
      suggestedContent: parsed.suggestedContent || [],
      qualityRecommendations: parsed.qualityRecommendations || [],
    }
  }

  async runVideoProduction(idea?: string): Promise<any> {
    const start = Date.now()
    const result = await runFullVideoCycle(this.supabase, this.userId)
    await storeMemory(this.supabase, this.userId, {
      category: 'video_production',
      content: { type: 'production_run', idea: idea || 'scheduled', result, createdAt: new Date().toISOString() },
      tags: ['video_editor', 'production'],
    })
    await this.log('video_production', `Ideas: ${result.ideasGenerated} | Edited: ${result.edited} | Published: ${result.published} | ${(Date.now() - start)}ms`)
    return result
  }

  async generateVideoIdeas(topic: string, count: number = 3): Promise<VideoProject[]> {
    const systemPrompt = `You are a Video Content Strategist. Generate video content ideas. Return JSON:
{
  "videos": [
    {
      "title": "video title",
      "type": "short_form|long_form|reel|ad|social",
      "description": "content description",
      "duration": "estimated duration",
      "platform": "target platform"
    }
  ]
}`

    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Generate ${count} video content ideas about "${topic}" optimized for social media engagement.`,
      { systemPrompt }
    )

    let ideas: VideoProject[] = []
    try { ideas = JSON.parse(result.response || '{}').videos || [] } catch { /* use default */ }

    if (ideas.length === 0) {
      ideas = [{ title: `${topic} Overview`, type: 'short_form', status: 'planned', duration: '60s', platform: 'instagram', description: `Quick overview of ${topic}` }]
    }

    for (const idea of ideas) {
      await this.supabase.from('video_projects').insert([{
        user_id: this.userId, title: idea.title, type: idea.type,
        status: 'planned', duration: idea.duration, platform: idea.platform,
        description: idea.description,
      }])
    }

    await this.log('video_ideas', `${ideas.length} ideas generated for: ${topic.substring(0, 60)}`)
    return ideas
  }

  async optimizeVideoMetadata(videoId: string): Promise<{ title: string; description: string; tags: string[]; thumbnailSuggestion: string }> {
    const { data: video } = await this.supabase
      .from('video_projects')
      .select('*')
      .eq('id', videoId)
      .single()

    const project = video as any
    if (!project) throw new Error('Video project not found')

    const systemPrompt = `You are a Video SEO Specialist. Optimize video metadata. Return JSON:
{
  "title": "optimized title",
  "description": "SEO-optimized description",
  "tags": ["tag1", "tag2"],
  "thumbnailSuggestion": "thumbnail concept"
}`

    const result = await executeAgentTask(this.supabase, this.userId, null,
      `Optimize metadata for: ${project.title} — ${project.description || ''} (${project.platform || 'youtube'})`,
      { systemPrompt }
    )

    let parsed: any = {}
    try { parsed = JSON.parse(result.response || '{}') } catch { parsed.title = project.title }

    await this.supabase.from('video_projects').update({
      seo_title: parsed.title, seo_description: parsed.description,
      seo_tags: parsed.tags, updated_at: new Date().toISOString(),
    }).eq('id', videoId)

    return {
      title: parsed.title || project.title,
      description: parsed.description || '',
      tags: parsed.tags || [],
      thumbnailSuggestion: parsed.thumbnailSuggestion || '',
    }
  }

  private async log(action: string, message: string, status = 'success'): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId, command_id: null,
        action: `[VideoEditor] ${action}`, module: 'video_editor', status, message,
      }])
    } catch { /* best effort */ }
  }
}
