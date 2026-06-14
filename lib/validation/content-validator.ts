import { BaseValidator, type ValidationResult } from './types'

export class PublishedContentValidator extends BaseValidator {
  get slug() { return 'content-published' }
  get name() { return 'Published Content' }
  get category() { return 'content' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()

    const { data: posts, count: totalPublished } = await this.supabase
      .from('content_requests')
      .select('id, title, platform, status, platform_post_id, published_at, media_url, image_count, carousel_count', { count: 'exact', head: false })
      .eq('user_id', this.userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })

    if (!posts || posts.length === 0) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'warning', message: 'No published content found in database',
        details: { totalPublished: 0 }, durationMs: Date.now() - start,
      }
    }

    // Check for required fields on each post
    const validPosts = posts.filter(p => p.platform_post_id && p.platform_post_id.length > 0)
    const invalidPosts = posts.filter(p => !p.platform_post_id || p.platform_post_id.length === 0)
    const postsWithMedia = posts.filter(p => p.media_url)

    const byPlatform: Record<string, number> = {}
    for (const p of posts) {
      byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1
    }

    const issues: string[] = []
    if (invalidPosts.length > 0) issues.push(`${invalidPosts.length} posts missing platform_post_id`)
    if (postsWithMedia.length === 0) issues.push('no posts have media attachments')

    const postList = posts.map(p => ({
      id: p.id,
      title: p.title,
      platform: p.platform,
      platformPostId: p.platform_post_id?.substring(0, 60),
      publishedAt: p.published_at,
      hasMedia: !!p.media_url,
      imageCount: p.image_count || 0,
      carouselCount: p.carousel_count || 0,
    }))

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: issues.length > 0 ? 'warning' : 'working',
      message: `${totalPublished || posts.length} published posts — ${byPlatform.linkedin || 0} LinkedIn${byPlatform.facebook ? ', ' + byPlatform.facebook + ' Facebook' : ''}${byPlatform.instagram ? ', ' + byPlatform.instagram + ' Instagram' : ''}`,
      details: {
        totalPublished: totalPublished || posts.length,
        validPostsWithPlatformId: validPosts.length,
        postsMissingPlatformId: invalidPosts.length,
        postsWithMedia: postsWithMedia.length,
        byPlatform,
        posts: postList,
      },
      durationMs: Date.now() - start,
    }
  }
}

export class ContentFactoryValidator extends BaseValidator {
  get slug() { return 'content-factory' }
  get name() { return 'Content Factory' }
  get category() { return 'content' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()

    // Check factory execution logs
    const { data: logs } = await this.supabase
      .from('execution_logs')
      .select('id, action, status, message, created_at')
      .filter('action', 'ilike', '%[ContentFactory]%')
      .order('created_at', { ascending: false })
      .limit(10)

    // Count total generated content
    const { count: totalGenerated } = await this.supabase
      .from('content_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', this.userId)

    if (!logs || logs.length === 0) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: totalGenerated && totalGenerated > 0 ? 'working' : 'warning',
        message: totalGenerated && totalGenerated > 0
          ? `No factory execution logs found, but ${totalGenerated} content items exist in DB`
          : 'No content factory execution history found',
        details: { totalContentItems: totalGenerated || 0, factoryLogs: [] },
        durationMs: Date.now() - start,
      }
    }

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: 'working',
      message: `Content factory ran ${logs.length} times — ${totalGenerated || '?'} total content items in database`,
      details: {
        totalContentItems: totalGenerated || 0,
        recentLogs: logs.map(l => ({
          id: l.id,
          action: l.action,
          status: l.status,
          message: l.message?.substring(0, 120),
          createdAt: l.created_at,
        })),
      },
      durationMs: Date.now() - start,
    }
  }
}
