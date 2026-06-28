import { BaseProvider } from './provider'

const FB_API = 'https://graph.facebook.com/v22.0'

// ─── Shared helpers ───────────────────────────────────────

async function fbPost(url: string, body: Record<string, any>, description: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${description} failed: ${data.error?.message || res.status}`)
  return data
}

async function fbGet(url: string, description: string) {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(`${description} failed: ${data.error?.message || res.status}`)
  return data
}

async function uploadToFacebook(token: string, pageId: string, fileUrl: string, fileBuffer: number[] | undefined, filename: string): Promise<string> {
  const formData = new FormData()
  if (fileBuffer) {
    const blob = new Blob([new Uint8Array(fileBuffer)])
    formData.append('source', blob, filename)
  } else if (fileUrl) {
    const dlRes = await fetch(fileUrl)
    const blob = await dlRes.blob()
    formData.append('source', blob, filename)
  } else {
    throw new Error('Facebook: no file data')
  }
  formData.append('access_token', token)
  const res = await fetch(`${FB_API}/${pageId}/photos?published=false`, { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(`Facebook photo upload failed: ${data.error?.message || res.status}`)
  return data.id
}

async function uploadVideoToFacebook(token: string, pageId: string, videoUrl: string, videoBuffer: number[] | undefined, title: string, description: string): Promise<string> {
  const formData = new FormData()
  if (videoBuffer) {
    const blob = new Blob([new Uint8Array(videoBuffer)], { type: 'video/mp4' })
    formData.append('source', blob, `${title || 'video'}.mp4`)
  } else if (videoUrl) {
    const dlRes = await fetch(videoUrl)
    if (!dlRes.ok) throw new Error(`Facebook: failed to fetch video from URL: ${dlRes.status}`)
    const blob = await dlRes.blob()
    formData.append('source', blob, `${title || 'video'}.mp4`)
  } else {
    throw new Error('Facebook: no video data')
  }
  formData.append('access_token', token)
  formData.append('title', title || 'Video')
  formData.append('description', description || '')
  const res = await fetch(`${FB_API}/${pageId}/videos?published=false`, { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(`Facebook video upload failed: ${data.error?.message || res.status}`)
  return data.id
}

function getPageToken(creds: Record<string, any>): string {
  return creds?.page_access_token || creds?.access_token
}

function getPageId(creds: Record<string, any>): string {
  return creds?.selected_page_id || 'me'
}

function getIgUserId(creds: Record<string, any>): string {
  const id = creds?.instagram_business_id || creds?.ig_user_id
  if (!id) throw new Error('Instagram: no Instagram Business Account ID. Link Instagram to your Facebook page first.')
  return id
}

// ─── Facebook (Enhanced) ──────────────────────────────────

export class FacebookProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const token = getPageToken(this.credentials)
    const pageId = getPageId(this.credentials)
    if (!token) throw new Error('Facebook: no access token — select a page first')

    switch (action) {
      // ── Text / link feed post ──────────────────────────
      case 'publish_post': {
        const body: Record<string, any> = { message: params.content || params.message || '', access_token: token }
        if (params.link) body.link = params.link
        const data = await fbPost(`${FB_API}/${pageId}/feed`, body, 'Facebook post')
        return { postId: data.id, status: 'published', url: `https://facebook.com/${data.id}` }
      }

      // ── Photo post ─────────────────────────────────────
      case 'publish_photo': {
        const photoId = await uploadToFacebook(token, pageId, params.fileUrl || params.imageUrl, params.fileBuffer, params.filename || 'photo.jpg')
        const body: Record<string, any> = { access_token: token }
        if (params.caption || params.content) body.message = params.caption || params.content
        const data = await fbPost(`${FB_API}/${photoId}`, body, 'Facebook photo publish')
        return { postId: data.id, status: 'published', url: `https://facebook.com/${data.id}`, photoId }
      }

      // ── Video post ─────────────────────────────────────
      case 'publish_video': {
        const videoId = await uploadVideoToFacebook(token, pageId, params.videoUrl, params.videoBuffer, params.title || 'Video', params.description || params.content || '')
        const body: Record<string, any> = { access_token: token, published: true }
        const data = await fbPost(`${FB_API}/${videoId}`, body, 'Facebook video publish')
        return { postId: data.id, status: 'published', url: `https://facebook.com/${data.id}`, videoId }
      }

      // ── Carousel post ──────────────────────────────────
      case 'publish_carousel': {
        const mediaIds: string[] = []
        for (const item of (params.mediaItems || [])) {
          const id = await uploadToFacebook(token, pageId, item.url || item.fileUrl, item.fileBuffer, item.filename || 'carousel.jpg')
          mediaIds.push(id)
        }
        const body: Record<string, any> = {
          access_token: token,
          attached_media: mediaIds.map(id => ({ media_fbid: id })),
          message: params.content || params.caption || '',
        }
        const data = await fbPost(`${FB_API}/${pageId}/feed`, body, 'Facebook carousel')
        return { postId: data.id, status: 'published', url: `https://facebook.com/${data.id}`, mediaCount: mediaIds.length }
      }

      // ── Reel / video to Reels section ──────────────────
      case 'publish_reel': {
        const formData = new FormData()
        if (params.videoBuffer) {
          formData.append('source', new Blob([new Uint8Array(params.videoBuffer)], { type: 'video/mp4' }), `${params.title || 'reel'}.mp4`)
        } else if (params.videoUrl) {
          const dlRes = await fetch(params.videoUrl)
          const blob = await dlRes.blob()
          formData.append('source', blob, `${params.title || 'reel'}.mp4`)
        } else {
          throw new Error('Facebook Reel: no video data')
        }
        formData.append('access_token', token)
        formData.append('title', params.title || 'Reel')
        formData.append('description', params.description || params.content || '')
        if (params.is_reel !== undefined) formData.append('is_reel', params.is_reel ? 'true' : 'false')
        const res = await fetch(`${FB_API}/${pageId}/videos`, { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(`Facebook Reel failed: ${data.error?.message || res.status}`)
        return { postId: data.id, status: 'published', url: `https://facebook.com/reel/${data.id}`, videoId: data.id }
      }

      // ── Story ──────────────────────────────────────────
      case 'publish_story': {
        const storyType = params.mediaType === 'video' ? 'videos' : 'photos'
        const formData = new FormData()
        if (storyType === 'videos') {
          if (params.videoBuffer) {
            formData.append('source', new Blob([new Uint8Array(params.videoBuffer)], { type: 'video/mp4' }), 'story.mp4')
          } else if (params.videoUrl) {
            const dlRes = await fetch(params.videoUrl)
            const blob = await dlRes.blob()
            formData.append('source', blob, 'story.mp4')
          }
        } else {
          if (params.fileBuffer) {
            formData.append('source', new Blob([new Uint8Array(params.fileBuffer)]), 'story.jpg')
          } else if (params.imageUrl || params.fileUrl) {
            const dlRes = await fetch(params.imageUrl || params.fileUrl)
            const blob = await dlRes.blob()
            formData.append('source', blob, 'story.jpg')
          }
        }
        formData.append('access_token', token)
        const res = await fetch(`${FB_API}/${pageId}/${storyType}`, { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(`Facebook Story failed: ${data.error?.message || res.status}`)
        return { storyId: data.id, status: 'published', mediaType: params.mediaType || 'image' }
      }

      // ── Page insights ──────────────────────────────────
      case 'get_insights': {
        const metrics = (params.metrics || ['page_impressions', 'page_engaged_users', 'page_fans', 'page_reactions_total']).join(',')
        const since = params.since || '90daysago'
        const until = params.until || 'today'
        const data = await fbGet(`${FB_API}/${pageId}/insights?metric=${metrics}&since=${since}&until=${until}&period=day&access_token=${token}`, 'Facebook insights')
        const insights: Record<string, any> = {}
        for (const d of (data.data || [])) {
          insights[d.name] = {
            title: d.title,
            values: d.values?.map((v: any) => ({ date: v.end_time, value: v.value })),
            total: d.values?.reduce((s: number, v: any) => s + (typeof v.value === 'number' ? v.value : 0), 0) || 0,
          }
        }
        return { pageId, insights, period: { since, until } }
      }

      // ── Post insights ──────────────────────────────────
      case 'get_post_insights': {
        if (!params.postId) throw new Error('Facebook: postId required')
        const metrics = (params.metrics || ['post_impressions', 'post_engaged_users', 'post_reactions_by_type_total', 'post_clicks']).join(',')
        const data = await fbGet(`${FB_API}/${params.postId}/insights?metric=${metrics}&access_token=${token}`, 'Facebook post insights')
        return { postId: params.postId, insights: data.data || [] }
      }

      // ── Get page info ──────────────────────────────────
      case 'get_page': {
        const fields = params.fields || 'name,id,followers_count,fan_count,picture,about'
        return fbGet(`${FB_API}/${pageId}?fields=${fields}&access_token=${token}`, 'Facebook get page')
      }

      // ── Health check ───────────────────────────────────
      case 'check_health': {
        const userToken = this.credentials?.access_token
        const t = userToken || token
        const res = await fetch(`${FB_API}/me?fields=name&access_token=${t}`)
        const data = await res.json()
        return { valid: res.ok, name: data.name || '', error: data.error?.message || null }
      }

      // ── List pages ─────────────────────────────────────
      case 'get_pages': {
        const userToken = this.credentials?.access_token
        if (!userToken) throw new Error('Facebook: no user access token')
        const data = await fbGet(`${FB_API}/me/accounts?fields=name,id,picture,category,access_token&access_token=${userToken}`, 'Facebook pages')
        return { pages: data.data || [] }
      }

      // ── Get linked Instagram account ───────────────────
      case 'get_linked_instagram': {
        const data = await fbGet(`${FB_API}/${pageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${token}`, 'Facebook linked Instagram')
        const ig = data.instagram_business_account
        return {
          igUserId: ig?.id,
          username: ig?.username,
          profilePictureUrl: ig?.profile_picture_url,
        }
      }

      default:
        throw new Error(`Facebook: unknown action ${action}`)
    }
  }
}

// ─── Instagram (Real Graph API) ───────────────────────────

export class InstagramProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const token = getPageToken(this.credentials)
    const igUserId = getIgUserId(this.credentials)

    switch (action) {
      // ── Publish image ──────────────────────────────────
      case 'publish_post':
      case 'publish_image': {
        const creationId = await this.createMediaContainer(igUserId, token, {
          mediaType: 'IMAGE',
          mediaUrl: params.imageUrl || params.mediaUrl || params.fileUrl,
          caption: params.caption || params.content || '',
        })
        const publish = await fbPost(
          `${FB_API}/${igUserId}/media_publish`,
          { creation_id: creationId, access_token: token },
          'Instagram image publish'
        )
        return { mediaId: publish.id, status: 'published', url: `https://instagram.com/p/${publish.id}` }
      }

      // ── Publish video ──────────────────────────────────
      case 'publish_video': {
        const creationId = await this.createMediaContainer(igUserId, token, {
          mediaType: 'VIDEO',
          mediaUrl: params.videoUrl,
          caption: params.caption || params.content || '',
          thumbOffset: params.thumbOffset,
        })
        const publish = await fbPost(
          `${FB_API}/${igUserId}/media_publish`,
          { creation_id: creationId, access_token: token },
          'Instagram video publish'
        )
        return { mediaId: publish.id, status: 'published', url: `https://instagram.com/p/${publish.id}` }
      }

      // ── Publish reel ───────────────────────────────────
      case 'publish_reel': {
        const creationId = await this.createMediaContainer(igUserId, token, {
          mediaType: 'REELS',
          mediaUrl: params.videoUrl || params.mediaUrl,
          caption: params.caption || params.content || '',
          thumbOffset: params.thumbOffset,
          shareToFeed: params.shareToFeed ?? true,
        })
        const publish = await fbPost(
          `${FB_API}/${igUserId}/media_publish`,
          { creation_id: creationId, access_token: token },
          'Instagram Reel publish'
        )
        return { mediaId: publish.id, status: 'published', url: `https://instagram.com/reel/${publish.id}` }
      }

      // ── Publish story ──────────────────────────────────
      case 'publish_story': {
        const isVideo = params.mediaType === 'video' || !!params.videoUrl
        const creationId = await this.createMediaContainer(igUserId, token, {
          mediaType: isVideo ? 'STORIES_VIDEO' : 'STORIES_IMAGE',
          mediaUrl: isVideo ? params.videoUrl : (params.imageUrl || params.fileUrl),
          caption: '',
        })
        const publish = await fbPost(
          `${FB_API}/${igUserId}/media_publish`,
          { creation_id: creationId, access_token: token },
          'Instagram Story publish'
        )
        return { mediaId: publish.id, status: 'published', mediaType: isVideo ? 'video' : 'image' }
      }

      // ── Publish carousel ───────────────────────────────
      case 'publish_carousel': {
        const childrenIds: string[] = []
        for (const item of (params.mediaItems || [])) {
          const childId = await this.createMediaContainer(igUserId, token, {
            mediaType: item.isVideo ? 'VIDEO' : 'IMAGE',
            mediaUrl: item.url || item.mediaUrl || item.fileUrl,
            isCarouselItem: true,
          })
          childrenIds.push(childId)
        }
        const carouselBody: Record<string, any> = {
          media_type: 'CAROUSEL',
          children: childrenIds,
          caption: params.caption || params.content || '',
          access_token: token,
        }
        const carousel = await fbPost(`${FB_API}/${igUserId}/media`, carouselBody, 'Instagram carousel container')
        const publish = await fbPost(
          `${FB_API}/${igUserId}/media_publish`,
          { creation_id: carousel.id, access_token: token },
          'Instagram carousel publish'
        )
        return { mediaId: publish.id, status: 'published', url: `https://instagram.com/p/${publish.id}`, childCount: childrenIds.length }
      }

      // ── Get media insights ─────────────────────────────
      case 'get_media_insights': {
        if (!params.mediaId) throw new Error('Instagram: mediaId required')
        const metrics = (params.metrics || ['impressions', 'reach', 'engagement', 'saved', 'comments']).join(',')
        return fbGet(`${FB_API}/${params.mediaId}/insights?metric=${metrics}&access_token=${token}`, 'Instagram media insights')
      }

      // ── Get account insights ───────────────────────────
      case 'get_insights': {
        const metrics = (params.metrics || ['impressions', 'reach', 'profile_views', 'follower_count', 'email_contacts', 'get_directions_clicks', 'website_clicks']).join(',')
        const period = params.period || 'day'
        const since = params.since || '90daysago'
        const until = params.until || 'today'
        const data = await fbGet(`${FB_API}/${igUserId}/insights?metric=${metrics}&period=${period}&since=${since}&until=${until}&access_token=${token}`, 'Instagram insights')
        const insights: Record<string, any> = {}
        for (const d of (data.data || [])) {
          insights[d.name] = {
            title: d.title,
            values: d.values?.map((v: any) => ({ date: v.end_time, value: v.value })),
            total: d.values?.reduce((s: number, v: any) => s + (typeof v.value === 'number' ? v.value : 0), 0) || 0,
          }
        }
        return { igUserId, insights, period: { since, until }, description: data.description }
      }

      // ── Get media list ─────────────────────────────────
      case 'get_media': {
        const limit = params.limit || 25
        const data = await fbGet(`${FB_API}/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count&limit=${limit}&access_token=${token}`, 'Instagram media')
        return {
          media: (data.data || []).map((m: any) => ({
            id: m.id, caption: m.caption, mediaType: m.media_type,
            mediaUrl: m.media_url, permalink: m.permalink,
            thumbnailUrl: m.thumbnail_url, timestamp: m.timestamp,
            likes: m.like_count, comments: m.comments_count,
          })),
          paging: data.paging || null,
        }
      }

      // ── Get followers count ────────────────────────────
      case 'get_followers': {
        return fbGet(`${FB_API}/${igUserId}?fields=followers_count,follows_count,media_count&access_token=${token}`, 'Instagram followers')
      }

      // ── Get profile info ───────────────────────────────
      case 'get_profile': {
        return fbGet(`${FB_API}/${igUserId}?fields=id,username,account_type,profile_picture_url,name&access_token=${token}`, 'Instagram profile')
      }

      // ── Check IG connection ────────────────────────────
      case 'check_health': {
        try {
          const data = await fbGet(`${FB_API}/${igUserId}?fields=id,username&access_token=${token}`, 'Instagram health')
          return { valid: true, username: data.username, id: data.id }
        } catch (e: any) {
          return { valid: false, error: e.message }
        }
      }

      // ── Find IG business account from page ─────────────
      case 'get_linked_business_account': {
        const pageId = getPageId(this.credentials)
        const data = await fbGet(`${FB_API}/${pageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${token}`, 'Instagram linked account')
        const ig = data.instagram_business_account
        if (!ig) throw new Error('No Instagram Business Account linked to this Facebook page')
        return {
          id: ig.id,
          username: ig.username,
          profilePictureUrl: ig.profile_picture_url,
        }
      }

      default:
        throw new Error(`Instagram: unknown action ${action}`)
    }
  }

  private async createMediaContainer(
    igUserId: string,
    token: string,
    opts: { mediaType: string; mediaUrl: string; caption?: string; isCarouselItem?: boolean; thumbOffset?: number; shareToFeed?: boolean }
  ): Promise<string> {
    const body: Record<string, any> = {
      media_type: opts.mediaType,
      [opts.mediaType === 'IMAGE' || opts.mediaType === 'STORIES_IMAGE' ? 'image_url' : 'video_url']: opts.mediaUrl,
      access_token: token,
    }
    if (opts.caption && !opts.isCarouselItem && !opts.mediaType.startsWith('STORIES')) {
      body.caption = opts.caption
    }
    if (opts.thumbOffset !== undefined) body.thumb_offset = opts.thumbOffset
    if (opts.shareToFeed !== undefined && opts.mediaType === 'REELS') body.share_to_feed = opts.shareToFeed
    if (opts.isCarouselItem) body.is_carousel_item = true

    const data = await fbPost(`${FB_API}/${igUserId}/media`, body, `Instagram ${opts.mediaType} container`)
    return data.id
  }
}

// ─── X (Twitter) ──────────────────────────────────────────
export class XProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'publish_post': return { tweetId: 'x_' + Date.now(), status: 'published', url: `https://x.com/status/${Date.now()}` }
      case 'get_insights': return { impressions: 3400, likes: 89, retweets: 23, replies: 12, date: new Date().toISOString() }
      default: throw new Error(`X: unknown action ${action}`)
    }
  }
}

// ─── YouTube (Real YouTube Data API v3) ───────────────────
export class YouTubeProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const token = this.credentials?.access_token
    if (!token) throw new Error('YouTube: no access_token in credentials')

    switch (action) {

      case 'upload_video': {
        const { title, description, videoUrl, videoBuffer, tags, categoryId, isShort, privacyStatus, publishAt } = params
        if (!title) throw new Error('YouTube: title is required')
        if (!videoUrl && !videoBuffer) throw new Error('YouTube: videoUrl or videoBuffer is required')

        const snippet: Record<string, any> = {
          title,
          description: description || '',
          tags: tags || [],
          categoryId: categoryId || '22',
          defaultLanguage: 'en',
        }
        const status: Record<string, any> = {
          privacyStatus: privacyStatus || 'private',
          selfDeclaredMadeForKids: false,
        }
        if (publishAt) {
          status.privacyStatus = 'private'
          status.publishAt = new Date(publishAt).toISOString()
        }
        const body = { snippet, status }

        const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,recordingDetails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': 'video/*',
          },
          body: JSON.stringify(body),
        })
        if (!initRes.ok) {
          const err = await initRes.text()
          throw new Error(`YouTube upload init failed: ${initRes.status} ${err.slice(0, 300)}`)
        }
        const uploadUrl = initRes.headers.get('Location')
        if (!uploadUrl) throw new Error('YouTube: no upload URL returned')

        let videoBytes: Uint8Array
        if (videoBuffer) {
          videoBytes = videoBuffer instanceof Uint8Array ? videoBuffer : new Uint8Array(videoBuffer as any)
        } else {
          const dlRes = await fetch(videoUrl!, { signal: AbortSignal.timeout(120000) })
          if (!dlRes.ok) throw new Error(`YouTube: failed to fetch video: ${dlRes.status}`)
          videoBytes = new Uint8Array(await dlRes.arrayBuffer() as any)
        }

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/*' },
          body: videoBytes as any,
          signal: AbortSignal.timeout(300000),
        })
        if (!uploadRes.ok) {
          const err = await uploadRes.text()
          throw new Error(`YouTube upload failed: ${uploadRes.status} ${err.slice(0, 300)}`)
        }
        const uploadData = await uploadRes.json()
        return { videoId: uploadData.id, status: publishAt ? 'scheduled' : 'published', url: `https://youtube.com/watch?v=${uploadData.id}`, scheduledAt: publishAt || null, title }
      }

      case 'update_metadata': {
        const { videoId, title, description, tags, categoryId } = params
        if (!videoId) throw new Error('YouTube: videoId required')
        const updateBody: any = { id: videoId, snippet: {}, status: {} }
        if (title || description) { updateBody.snippet.title = title; updateBody.snippet.description = description || '' }
        if (tags) updateBody.snippet.tags = tags
        if (categoryId) updateBody.snippet.categoryId = categoryId
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        })
        if (!res.ok) { const err = await res.text(); throw new Error(`YouTube metadata update failed: ${res.status} ${err.slice(0, 300)}`) }
        const data = await res.json()
        return { videoId: data.id, title: data.snippet?.title, status: 'updated' }
      }

      case 'upload_thumbnail': {
        const { videoId, thumbnailUrl, thumbnailBuffer } = params
        if (!videoId) throw new Error('YouTube: videoId required')
        let thumbBytes: Uint8Array
        if (thumbnailBuffer) {
          thumbBytes = thumbnailBuffer instanceof Uint8Array ? thumbnailBuffer : new Uint8Array(thumbnailBuffer)
        } else {
          const dlRes = await fetch(thumbnailUrl!, { signal: AbortSignal.timeout(30000) })
          if (!dlRes.ok) throw new Error(`YouTube: thumbnail fetch failed: ${dlRes.status}`)
          thumbBytes = new Uint8Array(await dlRes.arrayBuffer())
        }
        const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
          body: thumbBytes as any,
          signal: AbortSignal.timeout(60000),
        })
        if (!res.ok) { const err = await res.text(); throw new Error(`YouTube thumbnail failed: ${res.status} ${err.slice(0, 300)}`) }
        const data = await res.json()
        return { videoId, thumbnailUrl: data.items?.[0]?.default?.url || '', status: 'uploaded' }
      }

      case 'set_privacy': {
        const { videoId, privacyStatus, publishAt } = params
        if (!videoId) throw new Error('YouTube: videoId required')
        const updateBody: any = { id: videoId, status: { privacyStatus: privacyStatus || 'private' } }
        if (publishAt) updateBody.status.publishAt = new Date(publishAt).toISOString()
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        })
        if (!res.ok) { const err = await res.text(); throw new Error(`YouTube privacy update failed: ${res.status} ${err.slice(0, 300)}`) }
        return { videoId, privacyStatus: privacyStatus || 'private', publishAt: publishAt || null, status: 'updated' }
      }

      case 'get_analytics': {
        const { videoId } = params
        if (!videoId) throw new Error('YouTube: videoId required')
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) { const err = await res.text(); throw new Error(`YouTube analytics failed: ${res.status} ${err.slice(0, 300)}`) }
        const data = await res.json()
        const item = data.items?.[0]
        const stats = item?.statistics || {}
        const snippet = item?.snippet || {}
        return { videoId, title: snippet.title, publishedAt: snippet.publishedAt, views: parseInt(stats.viewCount || '0'), likes: parseInt(stats.likeCount || '0'), comments: parseInt(stats.commentCount || '0'), shares: parseInt(stats.shareCount || '0'), tags: snippet.tags || [], categoryId: snippet.categoryId }
      }

      case 'list_videos': {
        const { maxResults, pageToken } = params
        const sp = new URLSearchParams({ part: 'snippet,statistics', mine: 'true', maxResults: String(maxResults || 10), order: 'date' })
        if (pageToken) sp.set('pageToken', pageToken)
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${sp}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) { const err = await res.text(); throw new Error(`YouTube list failed: ${res.status} ${err.slice(0, 300)}`) }
        const data = await res.json()
        return { videos: (data.items || []).map((v: any) => ({ videoId: v.id, title: v.snippet?.title, publishedAt: v.snippet?.publishedAt, views: parseInt(v.statistics?.viewCount || '0'), likes: parseInt(v.statistics?.likeCount || '0'), comments: parseInt(v.statistics?.commentCount || '0') })), nextPageToken: data.nextPageToken || null, totalResults: data.pageInfo?.totalResults || 0 }
      }

      default: throw new Error(`YouTube: unknown action ${action}`)
    }
  }
}

// ─── Outlook ──────────────────────────────────────────────
export class OutlookProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'send_email': return { messageId: 'out_' + Date.now(), to: params.to, subject: params.subject, status: 'sent' }
      case 'get_messages': return { messages: [], total: 0 }
      case 'create_draft': return { draftId: 'out_draft_' + Date.now(), status: 'draft' }
      default: throw new Error(`Outlook: unknown action ${action}`)
    }
  }
}

// ─── Clay ─────────────────────────────────────────────────
export class ClayProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'enrich_company': return { domain: params.domain, employees_estimate: 120, industry: params.industry || 'technology', funding: '$5M' }
      case 'enrich_person': return { name: params.name || 'Unknown', role: params.role || 'CTO', linkedin: `https://linkedin.com/in/${Date.now()}` }
      case 'search': return { results: [], total: params.limit || 10 }
      default: throw new Error(`Clay: unknown action ${action}`)
    }
  }
}
