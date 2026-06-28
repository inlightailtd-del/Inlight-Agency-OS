# ENVIRONMENT REPORT — Inlight Agency OS

**Generated**: 2026-06-27
**Source**: `.env.local` vs `.env.example` comparison + runtime audit

---

## Present Keys

Keys currently configured in `.env.local`.

| Variable | Status | Source | Used By |
|----------|--------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Present | Supabase project settings | Auth, database, storage, real-time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Present | Supabase project settings | Client-side Supabase access |
| `NEXT_PUBLIC_APP_URL` | ✅ Present | Deployment URL | OAuth callbacks, redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Present | Supabase project settings | Server-side admin DB access |
| `LINKEDIN_CLIENT_ID` | ✅ Present | LinkedIn Developer App | LinkedIn OAuth flow |
| `LINKEDIN_CLIENT_SECRET` | ✅ Present | LinkedIn Developer App | LinkedIn OAuth flow |
| `GOOGLE_CLIENT_ID` | ✅ Present | Google Cloud Console | Gmail OAuth flow |
| `GOOGLE_CLIENT_SECRET` | ✅ Present | Google Cloud Console | Gmail OAuth flow |
| `FACEBOOK_CLIENT_ID` | ✅ Present | Facebook Developer App | Facebook/Instagram OAuth flow |
| `FACEBOOK_CLIENT_SECRET` | ✅ Present | Facebook Developer App | Facebook/Instagram OAuth flow |
| `CRON_SECRET` | ✅ Present | Generated random string | Cron job authentication |
| `UNSPLASH_ACCESS_KEY` | ✅ Present | Unsplash Developer API | Content image selection |
| `PEXELS_API_KEY` | ✅ Present | Pexels API | Content image/video selection |
| `NEWSAPI_API_KEY` | ✅ Present | News API | Content research & trend detection |

**Total present**: 14 / 31 required

---

## Missing Keys

Keys defined in `.env.example` but absent from `.env.local`.

| Variable | Status | Where to Obtain | Features Blocked |
|----------|--------|----------------|------------------|
| `CALENDLY_CLIENT_ID` | 🔴 Missing | calendly.com/integrations/oauth | Meeting scheduling, calendar sync |
| `CALENDLY_CLIENT_SECRET` | 🔴 Missing | calendly.com/integrations/oauth | Meeting scheduling, calendar sync |
| `SALESFORCE_CLIENT_ID` | 🔴 Missing | Salesforce Setup → Create Connected App | CRM sync, lead management |
| `SALESFORCE_CLIENT_SECRET` | 🔴 Missing | Salesforce Setup → Create Connected App | CRM sync, lead management |
| `STRIPE_API_KEY` | 🔴 Missing | dashboard.stripe.com/apikeys | Payment processing, billing |
| `HUBSPOT_API_KEY` | 🔴 Missing | developers.hubspot.com → Private Apps | CRM automation, marketing hub |
| `SLACK_BOT_TOKEN` | 🔴 Missing | api.slack.com/apps → OAuth & Permissions | Team notifications, collaboration |
| `DISCORD_BOT_TOKEN` | 🔴 Missing | discord.com/developers/applications | Community management, alerts |
| `TELEGRAM_BOT_TOKEN` | 🔴 Missing | @BotFather on Telegram | Bot messaging, notifications |
| `AIRTABLE_API_KEY` | 🔴 Missing | airtable.com/account | Database integration, content CMS |
| `N8N_API_KEY` | 🔴 Missing | n8n instance → Settings → API | Workflow automation |
| `N8N_BASE_URL` | 🔴 Missing | n8n instance URL | Workflow automation |
| `MAKE_API_KEY` | 🔴 Missing | make.com → Account → API | Workflow automation |
| `MAKE_BASE_URL` | 🔴 Missing | make.com account region URL | Workflow automation |

**Total missing**: 14 / 31 required

---

## Optional Keys (Not Yet Added to env)

Keys needed for production AI reliability but not yet in `.env.example`.

| Variable | Purpose | Where to Obtain | Priority |
|----------|---------|----------------|----------|
| `OPENAI_API_KEY` | Production AI inference | platform.openai.com/api-keys | 🟡 Medium |
| `ANTHROPIC_API_KEY` | Long-context AI reasoning | console.anthropic.com | 🟢 Low |
| `GROQ_API_KEY` | Fast free LLM inference | console.groq.com | 🟡 Medium |

These are currently configurable via the dashboard UI at `/dashboard/settings/ai` but should be promoted to env vars for production deployment consistency.

---

## Unused Keys

Present keys that have no corresponding provider configuration in the codebase.

| Variable | Status | Notes |
|----------|--------|-------|
| — | ✅ None found | All present keys have corresponding provider configs or utility code |

---

## OAuth Token Status

OAuth tokens stored in the `integration_tokens` database table after authorization.

| Provider | Token Status | Action Required |
|----------|-------------|-----------------|
| **LinkedIn** | 🟡 No tokens | Run OAuth flow via `/api/integrations/oauth/authorize?provider=linkedin` |
| **Google/Gmail** | 🟡 No tokens | Run OAuth flow via `/api/integrations/oauth/authorize?provider=gmail` |
| **Facebook** | 🟡 No tokens | Run OAuth flow via `/api/integrations/oauth/authorize?provider=facebook` |
| **Instagram** | 🟡 No tokens | Run OAuth flow via `/api/integrations/oauth/authorize?provider=instagram` |
| **YouTube** | 🟡 No tokens | Run OAuth flow via `/api/integrations/oauth/authorize?provider=youtube` |
| **Calendly** | 🔴 Cannot proceed | Requires `CALENDLY_CLIENT_ID` and `CALENDLY_CLIENT_SECRET` |
| **Salesforce** | 🔴 Cannot proceed | Requires `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET` |

---

## Recommendations

### Immediate (Week 1)
1. **Register Calendly OAuth app** at calendly.com/integrations/oauth — add `CALENDLY_CLIENT_ID` and `CALENDLY_CLIENT_SECRET` to `.env.local`
2. **Register Salesforce connected app** in Salesforce Setup → Create → Apps → Connected Apps — add `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET`
3. **Run all 5 OAuth flows** via `/api/integrations/oauth/authorize` — LinkedIn, Gmail, Facebook, Instagram, YouTube

### Short-term (Week 2-3)
4. **Generate automation provider keys** — Stripe, HubSpot, Slack, Discord, Telegram, Airtable, n8n, Make (8 providers, ~2 hours total)
5. **Add OpenAI/Anthropic/Groq API keys** to `.env.local` for production AI reliability

### Medium-term (Week 7-9)
6. **Add all 14 missing env vars to Vercel environment** when deploying to production
7. **Remove any hardcoded test/mock values** that duplicate env var functionality

---

## Environment Health Score

| Category | Score | Status |
|----------|-------|--------|
| Required keys present | 14/28 | 🟡 50% |
| OAuth flows completed | 0/5 | 🔴 0% |
| Automation provider keys | 0/8 | 🔴 0% |
| AI provider keys | 0/3 | 🔴 0% |
| **Overall** | **14/44** | **🔴 32%** |
