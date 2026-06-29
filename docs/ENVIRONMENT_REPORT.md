# ENVIRONMENT REPORT — Inlight Agency OS

**Generated**: 2026-06-28
**Source**: `.env.local` vs `.env.example` comparison + Vercel deployment audit

---

## Present Keys

Keys currently configured in `.env.local` and deployed to Vercel.

| Variable | Status | Source | Used By |
|----------|--------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | 🟢 Env + Vercel | Supabase project settings | Auth, database, storage, real-time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🟢 Env + Vercel | Supabase project settings | Client-side Supabase access |
| `NEXT_PUBLIC_APP_URL` | 🟢 Env + Vercel | Vercel production URL | OAuth callbacks, redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | 🟢 Env + Vercel | Supabase project settings | Server-side admin DB access |
| `LINKEDIN_CLIENT_ID` | 🟢 Env + Vercel | LinkedIn Developer App | LinkedIn OAuth flow |
| `LINKEDIN_CLIENT_SECRET` | 🟢 Env + Vercel | LinkedIn Developer App | LinkedIn OAuth flow |
| `GOOGLE_CLIENT_ID` | 🟢 Env + Vercel | Google Cloud Console | Gmail OAuth flow |
| `GOOGLE_CLIENT_SECRET` | 🟢 Env + Vercel | Google Cloud Console | Gmail OAuth flow |
| `FACEBOOK_CLIENT_ID` | 🟢 Env + Vercel | Facebook Developer App | Facebook/Instagram OAuth flow |
| `FACEBOOK_CLIENT_SECRET` | 🟢 Env + Vercel | Facebook Developer App | Facebook/Instagram OAuth flow |
| `CRON_SECRET` | 🟢 Env + Vercel | Generated random string | Cron job authentication |
| `UNSPLASH_ACCESS_KEY` | 🟢 Env + Vercel | Unsplash Developer API | Content image selection |
| `PEXELS_API_KEY` | 🟢 Env + Vercel | Pexels API | Content image/video selection |
| `NEWSAPI_API_KEY` | 🟢 Env + Vercel | News API | Content research & trend detection |
| `OPENAI_API_KEY` | 🟢 Env + Vercel | platform.openai.com | AI agent inference, content generation |
| `OPENROUTER_API_KEY` | 🟢 Env + Vercel | openrouter.ai | AI fallback provider |
| `OPENROUTER_DEFAULT_MODEL` | 🟢 Env + Vercel | openrouter.ai | Default AI model config |
| `PADDLE_API_KEY` | 🟢 Env + Vercel | paddle.com | Payment processing (Stripe replacement) |
| `RESEND_API_KEY` | 🟢 Env + Vercel | resend.com | Email delivery |
| `HUBSPOT_API_KEY` | 🟢 Env + Vercel | developers.hubspot.com | CRM automation, marketing hub |
| `SLACK_BOT_TOKEN` | 🟢 Env + Vercel | api.slack.com | Team notifications, collaboration |
| `DISCORD_BOT_TOKEN` | 🟢 Env + Vercel | discord.com/developers | Community management, alerts |
| `TELEGRAM_BOT_TOKEN` | 🟢 Env + Vercel | @BotFather on Telegram | Bot messaging, notifications |
| `AIRTABLE_API_KEY` | 🟢 Env + Vercel | airtable.com/account | Database integration, content CMS |
| `N8N_API_KEY` | 🟢 Env + Vercel | n8n instance → Settings → API | Workflow automation |
| `MAKE_API_KEY` | 🟢 Env + Vercel | make.com → Account → API | Workflow automation |
| `ELEVENLABS_API_KEY` | 🟢 Env + Vercel | elevenlabs.io → Profile | Voice synthesis, AI calling |

**Total present**: 27 / 31 required (🔴 Stripe, Calendly, Salesforce, Twilio missing)

---

## Missing Keys

Keys still missing from `.env.local`.

| Variable | Status | Where to Obtain | Features Blocked |
|----------|--------|----------------|------------------|
| `STRIPE_API_KEY` | 🔴 Missing (Replaced by Paddle) | dashboard.stripe.com/apikeys | Payment processing (Paddle handles this) |
| `CALENDLY_CLIENT_ID` | 🔴 Missing | calendly.com/integrations/oauth | Meeting scheduling, calendar sync |
| `CALENDLY_CLIENT_SECRET` | 🔴 Missing | calendly.com/integrations/oauth | Meeting scheduling, calendar sync |
| `SALESFORCE_CLIENT_ID` | 🔴 Missing | Salesforce Setup → Create Connected App | CRM sync, lead management |
| `SALESFORCE_CLIENT_SECRET` | 🔴 Missing | Salesforce Setup → Create Connected App | CRM sync, lead management |
| `TWILIO_ACCOUNT_SID` | 🔴 Missing | twilio.com | SMS, voice |
| `TWILIO_AUTH_TOKEN` | 🔴 Missing | twilio.com | SMS, voice |
| `WHATSAPP_ACCESS_TOKEN` | 🔴 Missing | Meta Developer Portal | WhatsApp messaging |

**Total missing (critical)**: 6 / 27 remaining (excluding Twilio/WhatsApp)

---

## Optional Keys (Not Yet Added)

| Variable | Purpose | Where to Obtain | Priority |
|----------|---------|----------------|----------|
| `ANTHROPIC_API_KEY` | Long-context AI reasoning | console.anthropic.com | 🟢 Low |
| `GROQ_API_KEY` | Fast free LLM inference | console.groq.com | 🟢 Low |
| `UNSPLASH_SECRET` | Unsplash webhook auth | unsplash.com/developers | 🟢 Low |
| `N8N_BASE_URL` | n8n instance URL | n8n instance | 🟢 Low |
| `MAKE_BASE_URL` | Make region URL | make.com account | 🟢 Low |
| `SLACK_SIGNING_SECRET` | Slack event verification | api.slack.com/apps | 🟢 Low |
| `DISCORD_CLIENT_ID` | Discord app identifier | discord.com/developers | 🟢 Low |

---

## OAuth Token Status

OAuth tokens stored in the `integration_tokens` database table after authorization.

| Provider | Token Status | Action Required |
|----------|-------------|-----------------|
| **LinkedIn** | ✅ Tokens stored (3, latest kept) | Duplicates deactivated |
| **Google/Gmail** | ✅ Token stored | OAuth consent completed |
| **Facebook** | 🔴 Blocked by Meta device trust | Retry when Meta lifts restriction |
| **Instagram** | 🔴 Blocked by Meta device trust | Retry when Meta lifts restriction |
| **YouTube** | 🟡 Not yet completed | Uses Google scope — needs separate flow |
| **Calendly** | 🔴 Cannot proceed | Requires `CALENDLY_CLIENT_ID` and `CALENDLY_CLIENT_SECRET` |
| **Salesforce** | 🔴 Cannot proceed | Requires `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET` |

---

## Environment Health Score

| Category | Score | Status |
|----------|-------|--------|
| Required keys present | 27/31 | 🟢 87% |
| OAuth flows completed | 2/5 | 🟡 40% |
| Automation provider keys | 10/13 | 🟢 77% |
| AI provider keys | 2/4 | 🟡 50% |
| Deployed to Vercel | 27/27 | 🟢 100% |
| **Overall** | **41/49** | **🟢 84%** |
