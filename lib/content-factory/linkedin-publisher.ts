import { createClient } from '@supabase/supabase-js'

interface LinkedInImagePostResult {
  postUrn: string
  assetId: string
}

/**
 * Publish an image post to a LinkedIn personal profile.
 * Uses registerUpload for image + UGC post with shareMediaCategory=IMAGE.
 */
export async function publishLinkedInImagePost(
  accessToken: string,
  postText: string,
  imageBuffer: Buffer,
  imageTitle?: string,
): Promise<LinkedInImagePostResult> {
  // 1. Resolve profile
  const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!meRes.ok) throw new Error(`/userinfo: ${meRes.status} ${await meRes.text()}`)
  const me = await meRes.json() as any
  const authorUrn = `urn:li:person:${me.sub}`

  // 2. Register image upload
  const regRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: authorUrn,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  })
  if (!regRes.ok) throw new Error(`registerUpload: ${regRes.status} ${await regRes.text()}`)
  const regData = await regRes.json() as any
  const uploadUrl: string = regData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl
  const assetId: string = regData.value?.asset
  if (!uploadUrl || !assetId) throw new Error(`registerUpload: missing uploadUrl or assetId`)

  // 3. Upload image binary
  const upRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: imageBuffer as unknown as BodyInit,
  })
  if (!upRes.ok) throw new Error(`image upload: ${upRes.status} ${await upRes.text()}`)

  // 4. Brief processing wait
  await new Promise(r => setTimeout(r, 3000))

  // 5. Create UGC post with IMAGE
  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: postText },
          shareMediaCategory: 'IMAGE',
          media: [{
            status: 'READY',
            description: { text: imageTitle || '' },
            media: assetId,
            title: { text: imageTitle || '' },
          }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  if (!postRes.ok) throw new Error(`ugcPosts IMAGE: ${postRes.status} ${await postRes.text()}`)

  const location = postRes.headers.get('location') || ''
  return { postUrn: location, assetId }
}
