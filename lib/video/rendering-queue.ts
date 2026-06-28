import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { enqueueJob } from '@/lib/queue/queue'
import { generateStoryboard } from './storyboard-engine'
import { generateSubtitlesFromScript, formatSubtitles, storeSubtitles } from './subtitle-engine'

export type RenderTask = {
  id: string
  video_project_id: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  provider: string
  prompt: string
  duration: number
  output_url: string | null
  thumbnail_url: string | null
  error_msg: string | null
  progress: number
  created_at: string
}

export type RenderJobType = 'voiceover' | 'video_generation' | 'thumbnail' | 'subtitles' | 'storyboard' | 'b_roll' | 'final_assembly'

export async function enqueueRenderJob(
  supabase: SupabaseClient,
  userId: string,
  videoProjectId: string,
  jobType: RenderJobType,
  provider: string,
  params: Record<string, any>
): Promise<string> {
  const jobId = await enqueueJob(supabase, userId, 'video_render', {
    video_project_id: videoProjectId,
    job_type: jobType,
    provider,
    params,
  }, { priority: params.priority || 5 })

  await supabase.from('video_render_queue').insert([{
    user_id: userId,
    video_project_id: videoProjectId,
    job_type: jobType,
    provider,
    params,
    status: 'queued',
    progress: 0,
  }])

  return jobId
}

export async function processRenderJob(
  supabase: SupabaseClient,
  userId: string,
  jobType: RenderJobType,
  provider: string,
  params: Record<string, any>
): Promise<any> {
  switch (jobType) {
    case 'voiceover': {
      const { ElevenLabsProvider } = await import('@/lib/integrations/voice-providers')
      const provider = new ElevenLabsProvider(supabase, userId, 'elevenlabs')
      await provider.loadCredentials()
      return provider.executeAction('generate_speech', {
        text: params.script,
        voiceId: params.voiceId,
        speed: params.speed,
      })
    }

    case 'video_generation': {
      const providerMap: Record<string, any> = {
        runway: () => import('@/lib/integrations/video-providers').then(m => new m.RunwayProvider(supabase, userId, 'runway')),
        veo: () => import('@/lib/integrations/video-providers').then(m => new m.VeoProvider(supabase, userId, 'veo')),
        pika: () => import('@/lib/integrations/video-providers').then(m => new m.PikaProvider(supabase, userId, 'pika')),
        kling: () => import('@/lib/integrations/video-providers').then(m => new m.KlingProvider(supabase, userId, 'kling')),
      }
      const instance = await providerMap[provider]()
      await instance.loadCredentials()
      return instance.executeAction('generate_video', {
        prompt: params.prompt || params.script,
        duration: params.duration || 10,
        aspectRatio: params.aspectRatio || '16:9',
      })
    }

    case 'subtitles': {
      const subtitle = await generateSubtitlesFromScript(supabase, userId, params.script, params.language || 'en', params.format || 'srt')
      if (params.videoProjectId) {
        await storeSubtitles(supabase, userId, params.videoProjectId, subtitle)
      }
      return subtitle
    }

    case 'storyboard': {
      return generateStoryboard(supabase, userId, params.script, params.title || 'Video', params.contentType || 'short')
    }

    case 'thumbnail': {
      const systemPrompt = 'You are a Thumbnail Designer. Describe a high-CTR video thumbnail. Return JSON: {"description": "detailed description", "colors": ["c1", "c2", "c3"], "text_overlay": "short text", "style": "minimalist|bold|educational|curiosity"}'
      const result = await executeAgentTask(supabase, userId, null,
        `Design a thumbnail for "${params.title}"${params.hook ? ` (hook: ${params.hook})` : ''}`,
        { systemPrompt }
      )
      let thumbnail: any = {}
      try { thumbnail = JSON.parse(result.response || '{}') } catch { thumbnail.description = result.response }
      return thumbnail
    }

    case 'b_roll': {
      const systemPrompt = 'Generate b-roll footage descriptions for a video. Return JSON: {"clips": [{"description": "b-roll visual", "duration_seconds": number, "source": "stock|ai_generated|captured", "mood": "string"}]}'
      const result = await executeAgentTask(supabase, userId, null,
        `Generate ${params.clipCount || 5} b-roll clips for "${params.title}" (${params.script?.slice(0, 200) || 'video'})`,
        { systemPrompt }
      )
      let clips: any[] = []
      try { clips = JSON.parse(result.response || '{}').clips || [] } catch {}
      return clips
    }

    case 'final_assembly': {
      await storeMemory(supabase, userId, {
        category: 'video_assembly',
        tags: ['final_assembly', params.videoProjectId],
        content: { videoProjectId: params.videoProjectId, assets: params.assets, assembledAt: new Date().toISOString() },
      })
      return { status: 'assembled', videoProjectId: params.videoProjectId, assets: params.assets }
    }

    default:
      throw new Error(`Unknown render job type: ${jobType}`)
  }
}

export async function getRenderQueue(
  supabase: SupabaseClient,
  userId: string
): Promise<{ queued: RenderTask[]; rendering: RenderTask[]; completed: RenderTask[]; failed: RenderTask[] }> {
  const { data } = await supabase
    .from('video_render_queue')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  const all = (data ?? []) as RenderTask[]
  return {
    queued: all.filter((r) => r.status === 'queued'),
    rendering: all.filter((r) => r.status === 'rendering'),
    completed: all.filter((r) => r.status === 'completed'),
    failed: all.filter((r) => r.status === 'failed'),
  }
}

export async function getRenderQueueStats(supabase: SupabaseClient, userId: string): Promise<{
  total: number; queued: number; rendering: number; completed: number; failed: number
}> {
  const queue = await getRenderQueue(supabase, userId)
  return {
    total: queue.queued.length + queue.rendering.length + queue.completed.length + queue.failed.length,
    queued: queue.queued.length,
    rendering: queue.rendering.length,
    completed: queue.completed.length,
    failed: queue.failed.length,
  }
}
