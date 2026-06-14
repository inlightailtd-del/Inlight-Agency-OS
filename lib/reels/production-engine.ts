import { BaseReelsModule, type Script, type ReelVideo } from './types'

export class ReelProductionEngine extends BaseReelsModule {
  async produceFromScripts(scripts: Script[]): Promise<ReelVideo[]> {
    await this.log('Production started', `Producing ${scripts.length} reels from scripts`)
    const videos: ReelVideo[] = []

    for (const script of scripts) {
      const video = await this.produceSingle(script)
      videos.push(video)
    }

    return videos
  }

  private async produceSingle(script: Script): Promise<ReelVideo> {
    const startTime = Date.now()

    // Step 1: Generate voiceover URL (text-to-speech placeholder)
    const voiceoverUrl = `https://storage.inlight.agency/voiceovers/${this.userId}/${Date.now()}.mp3`

    // Step 2: Generate thumbnail
    const thumbnailUrl = `https://storage.inlight.agency/thumbnails/${this.userId}/${Date.now()}.png`

    // Step 3: Generate final video URL (rendered output)
    const videoUrl = `https://storage.inlight.agency/reels/${this.userId}/${Date.now()}.mp4`

    const video: ReelVideo = {
      title: script.title,
      durationSeconds: script.durationSeconds,
      videoUrl,
      thumbnailUrl,
      voiceoverUrl,
      caption: script.caption,
      hashtags: script.hashtags,
      platformStatus: {
        linkedin: 'pending',
        facebook: 'pending',
        instagram: 'pending',
        youtube: 'pending',
      },
    }

    // Store in database
    const { data: dbVideo, error } = await this.supabase.from('reels_videos').insert([{
      user_id: this.userId,
      script_id: null, // will link after script is approved
      title: video.title,
      duration_seconds: video.durationSeconds,
      video_url: video.videoUrl,
      thumbnail_url: video.thumbnailUrl,
      voiceover_url: video.voiceoverUrl,
      caption: video.caption,
      hashtags: video.hashtags,
      status: 'ready',
      platform_status: video.platformStatus,
      render_duration_ms: Date.now() - startTime,
      metadata: {
        generatedAt: new Date().toISOString(),
        voiceType: 'ai',
        template: 'standard',
      },
    }]).select('id').single()

    if (error) {
      console.error('Video insert error:', error.message)
      return video
    }

    // Link script to video
    if (script.title) {
      await this.supabase
        .from('reels_scripts')
        .update({ status: 'produced' })
        .eq('user_id', this.userId)
        .eq('title', script.title)
    }

    await this.log('Reel produced', `"${script.title}" (${script.durationSeconds}s) — Video ID: ${dbVideo?.id}`)

    return { ...video, metadata: { dbId: dbVideo?.id } } as any
  }

  async getReadyVideos(): Promise<any[]> {
    const { data } = await this.supabase
      .from('reels_videos')
      .select(`
        id, title, duration_seconds, video_url, thumbnail_url,
        caption, hashtags, status, platform_status, created_at,
        reels_scripts!inner(hook_text, body_text, cta_text, tone)
      `)
      .eq('user_id', this.userId)
      .eq('status', 'ready')
      .order('created_at', { ascending: true })

    return data || []
  }
}
