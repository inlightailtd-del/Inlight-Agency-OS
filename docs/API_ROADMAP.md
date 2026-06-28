# API Integration Roadmap — Provider by Provider

## Provider Status Overview

| Provider | Type | Status | Auth Method | Actions | Priority | Effort | Key Needed |
|----------|------|--------|-------------|---------|----------|--------|------------|
| Gmail | Email | OAuth configured, no token | OAuth 2.0 | Send/receive email | P1 | Low | OAuth token |
| LinkedIn | Social | OAuth configured, no token | OAuth 2.0 | Post, profile, search | P1 | Low | OAuth token |
| Facebook | Social | OAuth configured, no token | OAuth 2.0 | Page post, insights | P1 | Low | OAuth token |
| Instagram | Social | OAuth configured, no token | OAuth 2.0 | Media publish, stories | P1 | Low | OAuth token |
| YouTube | Video | OAuth configured, no token | OAuth 2.0 | Upload, manage | P1 | Low | OAuth token |
| Stripe | Payments | Missing key | API Key | Payments, billing, subscriptions | P1 | Low | `STRIPE_SECRET_KEY` |
| Calendly | Scheduling | Missing config | OAuth 2.0 | Meeting booking | P1 | Medium | CLIENT_ID, SECRET, token |
| Twilio | Messaging | Not implemented | API Key | SMS, voice | P1 | Medium | API Key |
| WhatsApp | Messaging | Not implemented | API Key | Messaging | P1 | Medium | API Key |
| HubSpot | CRM | Missing key | OAuth 2.0 | Contact/deal sync | P2 | Medium | `HUBSPOT_ACCESS_TOKEN` |
| Salesforce | CRM | Missing config | OAuth 2.0 | Enterprise CRM | P2 | Medium | CLIENT_ID, SECRET, token |
| Slack | Comms | Missing key | OAuth 2.0 | Notifications, messages | P2 | Low | `SLACK_BOT_TOKEN` |
| Discord | Comms | Missing key | Bot Token | Community management | P2 | Low | `DISCORD_BOT_TOKEN` |
| Telegram | Comms | Missing key | Bot Token | Broadcast | P2 | Low | `TELEGRAM_BOT_TOKEN` |
| Airtable | Database | Missing key | PAT | DB sync | P2 | Low | `AIRTABLE_PAT` |
| n8n | Workflow | Missing key | API Key | Workflow automation | P2 | Medium | `N8N_API_KEY` |
| Make | Workflow | Missing key | API Key | Workflow automation | P2 | Medium | `MAKE_API_KEY` |
| Apollo | Data | Not implemented | API Key | Lead gen, enrichment | P3 | High | API Key |
| Clay | Data | Not implemented | API Key | Data enrichment | P3 | High | API Key |
| ElevenLabs | Voice | Missing key | API Key | Voice synthesis | P3 | Low | `ELEVENLABS_API_KEY` |
| Whisper/OpenAI | AI | Missing key | API Key | Transcription | P3 | Low | `OPENAI_API_KEY` |
| Runway | Video | Missing key | API Key | Video generation | P3 | Low | `RUNWAY_API_KEY` |
| Veo | Video | Missing key | API Key | Video generation | P3 | Low | API Key |
| Pika | Video | Missing key | API Key | Video generation | P3 | Low | `PIKA_API_KEY` |
| Kling | Video | Missing key | API Key | Video generation | P3 | Low | `KLING_API_KEY` |
| Facebook Ads | Ads | Stub | Access Token | Ad campaigns | P4 | High | Access Token + Ad Account |
| Google Ads | Ads | Stub | OAuth 2.0 | Ad campaigns | P4 | High | OAuth + Dev Token |
| LinkedIn Ads | Ads | Stub | Access Token | Ad campaigns | P4 | High | Access Token + Account |
| TikTok Ads | Ads | Stub | Access Token | Ad campaigns | P4 | High | Access Token + Account |
| Figma | Design | Not implemented | OAuth 2.0 | Design files | P4 | Medium | OAuth token |
| Canva | Design | Not implemented | API Key | Design automation | P4 | Medium | API Key |
| Vercel | Deploy | Not implemented | Token | Deploy automation | P4 | Low | Token |
| Cloudflare | Deploy | Not implemented | API Key | DNS, CDN | P4 | Low | API Key |
| GitHub | Git | Not implemented | OAuth 2.0 | Repo management | P4 | Low | OAuth token |
| GitLab | Git | Not implemented | OAuth 2.0 | Repo management | P4 | Low | OAuth token |
| Outlook | Email | Not implemented | OAuth 2.0 | Email | P4 | Low | OAuth token |
| X/Twitter | Social | Not implemented | OAuth 2.0 | Posting | P4 | Low | OAuth token |
| Vapi | Voice | Not implemented | API Key | Voice AI | P4 | Medium | API Key |
| Bland AI | Voice | Not implemented | API Key | Voice AI calling | P4 | Medium | API Key |

---

## Priority 1: Detailed Connection Steps

### Gmail

1. **Obtain credentials:** Go to Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application). Add authorized redirect URI `https://yourdomain.com/api/auth/gmail/callback`.
2. **Register OAuth app:** Already done — client ID and secret are in `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. **First endpoint to call:** `GET /api/auth/gmail` — redirects user to Google consent screen with `https://www.googleapis.com/auth/gmail.send` and `gmail.readonly` scopes.
4. **Verify:** After completing the flow, call `GET /api/gmail/profile` — should return the authenticated user's email address and label list.

### LinkedIn

1. **Obtain credentials:** Go to LinkedIn Developer Portal → Create app. Add redirect URL `https://yourdomain.com/api/auth/linkedin/callback`. Request `w_member_social` and `r_liteprofile` scopes.
2. **Register OAuth app:** Already done — client ID and secret in `.env.local`.
3. **First endpoint to call:** `GET /api/auth/linkedin` — redirects user to LinkedIn authorization.
4. **Verify:** After flow, call `POST /api/linkedin/post` with test content — should create a LinkedIn post on the authenticated user's profile.

### Facebook

1. **Obtain credentials:** Go to Facebook Developers → Create App → Add Facebook Login. Add redirect URI.
2. **Register OAuth app:** Already done — `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` configured.
3. **First endpoint to call:** `GET /api/auth/facebook` — redirects user with `pages_manage_posts` and `pages_read_engagement` scopes.
4. **Verify:** After flow, call `GET /api/facebook/pages` — should return list of managed pages.

### Instagram

1. **Obtain credentials:** Same Facebook App — Instagram Graph API requires Facebook Login + `instagram_basic`, `instagram_content_publish` permissions.
2. **Register OAuth app:** Facebook/Instagram OAuth is configured.
3. **First endpoint to call:** `GET /api/auth/instagram` — redirects through Facebook to Instagram permissions.
4. **Verify:** After flow, call `GET /api/instagram/media` — should return recent media from the connected Instagram Business account.

### YouTube

1. **Obtain credentials:** Google Cloud Console → Enable YouTube Data API v3. Same OAuth client as Gmail can be used with additional scope.
2. **Register OAuth app:** Same Google OAuth client used for Gmail.
3. **First endpoint to call:** `GET /api/auth/youtube` — redirects user with `https://www.googleapis.com/auth/youtube.upload` and `youtube.readonly` scopes.
4. **Verify:** After flow, call `GET /api/youtube/channels` — should return the authenticated user's channel info.

### Stripe

1. **Obtain credentials:** Go to Stripe Dashboard → Developers → API Keys. Copy Publishable Key (pk_live_xxx) and Secret Key (sk_live_xxx).
2. **Register:** No OAuth app needed — Stripe uses API key auth. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` in env.
3. **First endpoint to call:** `GET /api/stripe/products` — should return product list from Stripe.
4. **Verify:** Call `POST /api/stripe/checkout` with a test price ID — should return a checkout session URL.

### Calendly

1. **Obtain credentials:** Go to Calendly Developer Portal → Create OAuth App. Set redirect URI. Note Client ID and Secret.
2. **Register:** Add `CALENDLY_CLIENT_ID` and `CALENDLY_CLIENT_SECRET` to `.env.local` (currently missing entirely).
3. **First endpoint to call:** `GET /api/auth/calendly` — redirects user to Calendly authorization.
4. **Verify:** After flow, call `GET /api/calendly/events` — should return scheduled events.

### Twilio

1. **Obtain credentials:** Go to Twilio Console → Account → API Keys. Create API Key and note SID, Secret, and Account SID.
2. **Register:** Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` to env.
3. **First endpoint to call:** `POST /api/twilio/sms` with a test phone number — should send an SMS.
4. **Verify:** The test phone receives the SMS.

### WhatsApp

1. **Obtain credentials:** Go to Meta Developer Portal → WhatsApp → Setup. Get Permanent Token and Phone Number ID.
2. **Register:** Add `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` to env.
3. **First endpoint to call:** `POST /api/whatsapp/send` with a test number — should send a WhatsApp message.
4. **Verify:** The test number receives the WhatsApp message.

---

## Quick Start: Minimum 10 Steps to Production

### Prerequisites
1. **OpenAI API Key** — `OPENAI_API_KEY` in `.env.local`. Without this, the autonomous company cannot run.

### Complete OAuth Flows (Core Social + Email)
2. **Gmail** — Visit `/api/auth/gmail`, complete Google consent, verify with `/api/gmail/profile`.
3. **LinkedIn** — Visit `/api/auth/linkedin`, complete LinkedIn auth, verify with a test post.
4. **Facebook** — Visit `/api/auth/facebook`, complete Facebook login, verify with page list.
5. **Instagram** — Visit `/api/auth/instagram`, connect Instagram Business, verify with media list.
6. **YouTube** — Visit `/api/auth/youtube`, complete Google consent, verify with channel info.

### Connect Payments
7. **Stripe** — Add `STRIPE_SECRET_KEY`, verify with product list endpoint.

### Add Missing OAuth Config
8. **Calendly** — Register OAuth app, add `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`, complete flow.

### Infrastructure
9. **CI/CD** — Create `.github/workflows/deploy.yml` with lint, test, build, deploy to Vercel.
10. **Monitoring** — Add `SENTRY_DSN` env var, configure `@sentry/nextjs`, deploy with error tracking active.

### Bonus
- Add `STRIPE_WEBHOOK_SECRET` for payment event handling
- Add `HUBSPOT_ACCESS_TOKEN` for CRM sync
- Add `SLACK_BOT_TOKEN` for team notifications
