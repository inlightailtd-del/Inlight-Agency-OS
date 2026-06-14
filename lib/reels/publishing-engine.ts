import { IntegrationSDK } from '@/lib/integrations/sdk'
import { BaseReelsModule, type ReelVideo, type PublishResult } from './types'

export class PublishingEngine extends BaseReelsModule {
  private sdk: IntegrationSDK

  constructor(supabase: any, userId: string) {
    super(supabase, userId)
    this.sdk = new IntegrationSDK(supabase, userId)
  }

  async publishVideo(video: ReelVideo & { id?: string }): Promise<PublishResult[]> {
    const results: PublishResult[] = []

    // Check which platforms are connected
    const [linkedinConnected, facebookConnected] = await Promise.all([
      this.sdk.getProviderStatus('linkedin').then(s => s.connected).catch(() => false),
      this.sdk.getProviderStatus('facebook').then(s => s.connected).catch(() => false),
    ])

    const content = video.caption || `${video.title}\n\n${video.hashtags?.join(' ') || ''}`

    // LinkedIn
    if (linkedinConnected) {
      try {
        const result = await this.sdk.executeAction('linkedin', 'create_post', {
          content,
          text: content,
          title: video.title,
          mediaUrl: video.videoUrl,
          platform: 'linkedin',
        })

        if (result.success) {
          results.push({
            platform: 'linkedin',
            success: true,
            platformPostId: result.data?.postId,
            platformUrl: result.data?.url,
          })
        } else {
          results.push({ platform: 'linkedin', success: false, error: result.error })
        }
      } catch (e: any) {
        results.push({ platform: 'linkedin', success: false, error: e.message })
      }
    }

    // Facebook
    if (facebookConnected) {
      try {
        const result = await this.sdk.executeAction('facebook', 'publish_post', {
          content,
          title: video.title,
          videoUrl: video.videoUrl,
          platform: 'facebook',
        })

        if (result.success) {
          results.push({
            platform: 'facebook',
            success: true,
            platformPostId: result.data?.postId,
            platformUrl: result.data?.url,
          })
        } else {
          results.push({ platform: 'facebook', success: false, error: result.error })
        }
      } catch (e: any) {
        results.push({ platform: 'facebook', success: false, error: e.message })
      }
    }

    // Update video platform_status and status
    if (video.id) {
      const platformStatus: Record<string, string> = {
        linkedin: linkedinConnected ? (results.find(r => r.platform === 'linkedin')?.success ? 'published' : 'failed') : 'unavailable',
        facebook: facebookConnected ? (results.find(r => r.platform === 'facebook')?.success ? 'published' : 'failed') : 'unavailable',
        instagram: 'unavailable',
        youtube: 'unavailable',
      }

      const anySuccess = results.some(r => r.success)
      await this.supabase
        .from('reels_videos')
        .update({
          status: anySuccess ? 'published' : 'failed',
          platform_status: platformStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', video.id)

      // Store analytics placeholder
      for (const result of results.filter(r => r.success)) {
        await this.supabase.from('reels_analytics').upsert({
          user_id: this.userId,
          video_id: video.id,
          platform: result.platform,
          platform_post_id: result.platformPostId,
          platform_url: result.platformUrl,
          views: 0,
          snapshot_date: new Date().toISOString().split('T')[0],
        }, { onConflict: 'user_id, video_id, platform, snapshot_date', ignoreDuplicates: false })
      }

      // Log
      const published = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)
      await this.log(
        published.length > 0 ? 'Reel published' : 'Reel publish failed',
        `"${video.title}": ${published.length} published (${published.map(r => r.platform).join(', ')}), ${failed.length} failed (${failed.map(r => r.platform).join(', ')})`,
        failed.length > 0 ? 'failed' : 'success'
      )
    }

    return results
  }

  async publishFromQueue(): Promise<PublishResult[]> {
    const { data: videos } = await this.supabase
      .from('reels_videos')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'ready')
      .order('created_at', { ascending: true })
      .limit(3)

    if (!videos?.length) return []

    const allResults: PublishResult[] = []
    for (const video of videos) {
      const results = await this.publishVideo(video)
      allResults.push(...results)
    }

    return allResults
  }
}
