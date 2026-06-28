/**
 * Publishing Activation — Verify + Test + Publish
 * Tests OAuth tokens, creates posts, publishes to LinkedIn and Facebook.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wvintltwxydmlyvcmcis.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const USER_ID = process.env.USER_ID || '964b0cbe-cb92-40e0-9693-b9aaabf629ce'

const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const LINKEDIN_ID = process.env.LINKEDIN_CLIENT_ID || ''
const LINKEDIN_SECRET = process.env.LINKEDIN_CLIENT_SECRET || ''
const FACEBOOK_ID = process.env.FACEBOOK_CLIENT_ID || ''
const FACEBOOK_SECRET = process.env.FACEBOOK_CLIENT_SECRET || ''

const report = { auth: {}, tokens: {}, posting: {}, fixes: [] }

const H = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

async function json(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { ok: res.ok, status: res.status, data, text: text.slice(0, 500) }
}

// ═══════════════════════════ 1. MIGRATION 039 ═══════════════
async function checkMigration039() {
  console.log('\n🔍 1. Checking Migration 039 (agent_approval_requests)')
  const r = await json(`${SUPABASE_URL}/rest/v1/agent_approval_requests?limit=1&select=id`, { headers: H })
  report.migration039 = { exists: r.ok, status: r.status }
  console.log(`  Table exists: ${r.ok ? '✅ YES' : '❌ NO (HTTP ${r.status})'}`)
  if (r.ok) {
    // Try inserting an approval
    const ins = await json(`${SUPABASE_URL}/rest/v1/agent_approval_requests`, {
      method: 'POST', headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify([{
        user_id: USER_ID, agent_id: null, action: 'content_action',
        target_type: 'content_request', target_id: '00000000-0000-0000-0000-000000000000',
        summary: 'Migration 039 verification test', justification: 'Testing table write permissions.',
        impact: 'low', proposed_change: {}, current_state: {}, task_id: null, status: 'pending',
      }]),
    })
    report.migration039.canInsert = ins.ok
    console.log(`  Can insert: ${ins.ok ? '✅ YES' : '❌ NO'}`)

    // Clean up test row
    if (ins.ok && ins.data?.[0]?.id) {
      await json(`${SUPABASE_URL}/rest/v1/agent_approval_requests?id=eq.${ins.data[0].id}`, { method: 'DELETE', headers: H })
      console.log('  Test row cleaned up')
    }
  }
}

// ═══════════════════════════ 2. OAUTH TOKENS ════════════════
async function checkLinkedInToken() {
  console.log('\n🔑 2a. LinkedIn Token Verification')

  const cred = await json(`${SUPABASE_URL}/rest/v1/integration_credentials?user_id=eq.${USER_ID}&provider=eq.linkedin&select=id,credentials,expires_at,is_expired&order=created_at.desc&limit=1`, { headers: H })
  if (!cred.ok || !cred.data?.[0]) {
    report.linkedin = { tokenExists: false }
    console.log('  ❌ No LinkedIn credentials found in database')
    return
  }

  const token = cred.data[0].credentials.access_token
  const expires = cred.data[0].expires_at
  const expired = cred.data[0].is_expired
  const now = new Date()
  const expDate = new Date(expires)

  console.log(`  Token exists: ✅ (expires ${expDate.toISOString()})`)
  console.log(`  Expired flag: ${expired ? '⚠️ YES' : '✅ NO'}`)

  // Test via userinfo endpoint
  const info = await json('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } })
  report.linkedin = {
    tokenExists: true, expired, expiresAt: expires,
    userinfoOk: info.ok, userinfoData: info.ok ? info.data : null,
  }
  console.log(`  API test: ${info.ok ? '✅ VALID' : '❌ FAILED'} (HTTP ${info.status})`)
  if (info.ok) console.log(`  User: ${info.data.name} (${info.data.email})`)
}

async function checkGmailToken() {
  console.log('\n🔑 2b. Gmail Token Verification')
  const cred = await json(`${SUPABASE_URL}/rest/v1/integration_credentials?user_id=eq.${USER_ID}&provider=eq.gmail&select=id,credentials,expires_at,is_expired&order=created_at.desc&limit=1`, { headers: H })
  if (!cred.ok || !cred.data?.[0]) {
    report.gmail = { tokenExists: false }
    console.log('  ❌ No Gmail credentials found in database')
    return
  }

  const token = cred.data[0].credentials.access_token
  const refresh = cred.data[0].credentials.refresh_token
  const expires = cred.data[0].expires_at
  const expired = cred.data[0].is_expired
  const now = new Date()
  const expDate = new Date(expires)

  console.log(`  Token exists: ✅ (expired ${now > expDate ? '⚠️ YES' : '✅ NO'})`)

  // Test via Gmail API
  const gmail = await json('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1', { headers: { Authorization: `Bearer ${token}` } })
  report.gmail = { tokenExists: true, expired: now > expDate, apiOk: gmail.ok }

  if (!gmail.ok && refresh) {
    console.log('  ⚠️ Token expired — attempting refresh...')
    const ref = await json('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET,
        refresh_token: refresh, grant_type: 'refresh_token',
      }),
    })
    report.gmail.refreshOk = ref.ok
    console.log(`  Token refresh: ${ref.ok ? '✅ SUCCESS' : '❌ FAILED (HTTP ' + ref.status + ')'}`)
    if (ref.ok) {
      const newToken = ref.data.access_token
      // Test with new token
      const retry = await json('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1', { headers: { Authorization: `Bearer ${newToken}` } })
      report.gmail.refreshedApiOk = retry.ok
      console.log(`  After refresh API test: ${retry.ok ? '✅ VALID' : '❌ FAILED'}`)
      if (retry.ok) {
        const count = retry.data?.resultSizeEstimate || 0
        console.log(`  Gmail accessible: ${count} messages in inbox`)
      }
    }
  } else if (gmail.ok) {
    console.log(`  Gmail accessible: ${gmail.data?.resultSizeEstimate || 0} messages`)
  }
}

async function checkFacebookToken() {
  console.log('\n🔑 2c. Facebook Token Verification')
  // Facebook requires a user token from OAuth flow — no stored credentials
  const cred = await json(`${SUPABASE_URL}/rest/v1/integration_credentials?user_id=eq.${USER_ID}&provider=eq.facebook&select=id&limit=1`, { headers: H })
  report.facebook = { tokenExists: cred.ok && cred.data?.[0] ? true : false }
  console.log(`  Stored credentials: ${report.facebook.tokenExists ? '✅ FOUND' : '❌ NONE'}`)
  if (!report.facebook.tokenExists) {
    report.fixes.push('Facebook OAuth flow has not been completed. User must authenticate via the integrations UI.')
  }
}

// ═══════════════════════════ 3. POSTING TESTS ════════════════
async function publishLinkedIn() {
  console.log('\n📤 3a. Publishing LinkedIn Post')
  const cred = await json(`${SUPABASE_URL}/rest/v1/integration_credentials?user_id=eq.${USER_ID}&provider=eq.linkedin&select=credentials&order=created_at.desc&limit=1`, { headers: H })
  if (!cred.ok || !cred.data?.[0]) {
    console.log('  ❌ No LinkedIn token available')
    report.posting.linkedin = { published: false, error: 'No token' }
    return
  }
  const token = cred.data[0].credentials.access_token
  const idToken = cred.data[0].credentials.id_token

  // Parse user ID from id_token (JWT) or from direct API
  let personId
  const info = await json('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } })
  if (info.ok) personId = info.data.sub

  if (!personId) {
    console.log('  ❌ Could not resolve LinkedIn profile ID')
    report.posting.linkedin = { published: false, error: 'Could not resolve profile' }
    return
  }

  const authorUrn = `urn:li:person:${personId}`
  const postBody = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: '🤖 Inlight Agency OS just generated and published this post autonomously.\n\nWe built an AI-powered content pipeline that researches trends, generates ideas, writes copy, selects stock photos, schedules a calendar, and queues approvals — all without human intervention.\n\nThe future of agency operations is autonomous.\n\nWhat repetitive task would you automate first?\n\n#AIAgency #Automation #InlightOS #DigitalAgency' },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  }

  const post = await json('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(postBody),
  })

  report.posting.linkedin = {
    published: post.ok, status: post.status,
    postId: post.ok ? post.data?.id || 'success' : null,
    error: post.ok ? null : post.text,
  }
  console.log(`  Publish result: ${post.ok ? '✅ PUBLISHED' : '❌ FAILED'} (HTTP ${post.status})`)
  if (!post.ok) console.log(`  Error: ${post.text.slice(0, 300)}`)
}

async function publishFacebook() {
  console.log('\n📤 3b. Publishing Facebook Post')
  // Facebook requires a page-scoped token from OAuth flow + page selection
  const cred = await json(`${SUPABASE_URL}/rest/v1/integration_credentials?user_id=eq.${USER_ID}&provider=eq.facebook&select=credentials&limit=1`, { headers: H })
  if (!cred.ok || !cred.data?.[0]) {
    console.log('  ❌ No Facebook token available')
    report.posting.facebook = { published: false, error: 'No token — OAuth flow not completed' }
    return
  }

  const token = cred.data[0].credentials.access_token

  // Get pages
  const pages = await json(`https://graph.facebook.com/v22.0/me/accounts?fields=name,id,access_token&access_token=${token}`)
  if (!pages.ok || !pages.data?.data?.length) {
    console.log(`  ❌ No Facebook pages found: ${pages.text.slice(0, 200)}`)
    report.posting.facebook = { published: false, error: 'No pages or bad token' }
    return
  }

  const page = pages.data.data[0]
  const pageToken = page.access_token

  const fbpost = await json(`https://graph.facebook.com/v22.0/${page.id}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '🤖 Inlight Agency OS — First autonomous Facebook post!\n\nOur AI content pipeline just went live. We\'re generating, scheduling, and publishing content without manual effort.\n\nFollow along as we build the future of agency automation.',
      access_token: pageToken,
    }),
  })

  report.posting.facebook = {
    published: fbpost.ok, status: fbpost.status,
    postId: fbpost.ok ? fbpost.data?.id : null,
    error: fbpost.ok ? null : fbpost.text,
  }
  console.log(`  Publish result: ${fbpost.ok ? '✅ PUBLISHED' : '❌ FAILED'} (HTTP ${fbpost.status})`)
  if (fbpost.ok) console.log(`  Post ID: ${fbpost.data.id}`)
  else console.log(`  Error: ${fbpost.text.slice(0, 300)}`)
}

// ═══════════════════════════ MAIN ════════════════════════════
async function main() {
  console.log('='.repeat(60))
  console.log('📢 PUBLISHING ACTIVATION REPORT')
  console.log('='.repeat(60))
  console.log(`User: ${USER_ID}\nDate: ${new Date().toISOString()}`)

  // 1. Migration 039
  await checkMigration039()

  // 2. OAuth Tokens
  await checkLinkedInToken()
  await checkGmailToken()
  await checkFacebookToken()

  // 3. Posting
  if (report.linkedin?.userinfoOk) {
    await publishLinkedIn()
  } else {
    console.log('\n📤 3a. Skipping LinkedIn post — no valid token')
    report.posting = report.posting || {}
    report.posting.linkedin = { published: false, error: 'No valid token' }
  }

  if (report.facebook?.tokenExists) {
    await publishFacebook()
  } else {
    console.log('\n📤 3b. Skipping Facebook post — no token (OAuth flow needed)')
    report.posting = report.posting || {}
    report.posting.facebook = { published: false, error: 'OAuth flow not completed - user must authenticate via UI' }
  }

  // 4. Summary
  console.log('\n' + '='.repeat(60))
  console.log('📋 VERIFICATION SUMMARY')
  console.log('='.repeat(60))

  const p = (label, ok) => console.log(`  ${ok ? '✅' : '❌'} ${label}`)

  p('Migration 039 (agent_approval_requests)', report.migration039?.exists)
  p('LinkedIn — token valid + userinfo', report.linkedin?.userinfoOk)
  p('Gmail — token valid + API accessible', report.gmail?.apiOk || report.gmail?.refreshedApiOk)
  p('Facebook — stored credentials', report.facebook?.tokenExists)
  p('LinkedIn post published', report.posting?.linkedin?.published)
  p('Facebook post published', report.posting?.facebook?.published)

  console.log('\n⚠️  Required fixes:', report.fixes.length)
  for (const f of report.fixes) console.log(`  • ${f}`)

  // Save report to agent_memory
  await json(`${SUPABASE_URL}/rest/v1/agent_memory`, {
    method: 'POST', headers: H,
    body: JSON.stringify([{
      user_id: USER_ID, agent_id: null,
      category: 'publishing_verification',
      content: { report, timestamp: new Date().toISOString() },
      tags: ['publishing', 'verification'],
    }]),
  }).catch(() => {})

  console.log('\n✅ Publishing verification complete')
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1) })
