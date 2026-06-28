# GO_LIVE CHECKLIST — Inlight Agency OS

**Generated**: 2026-06-27
**Status**: 🟡 Pre-Production — 14/31 env vars configured, 0/5 OAuth flows completed

---

## Pre-Flight Checks

- [ ] Fix TypeScript errors in `lib/voice/interruptions.ts` — run `npx tsc --noEmit` and resolve all errors in that file
- [ ] Add authentication middleware to `app/api/queue/process/route.ts` — verify Supabase session or bearer token is validated on every request
- [ ] Verify all 107 database tables exist — run `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'` in Supabase SQL Editor
- [ ] Run `npx tsc --noEmit` — only pre-existing errors are acceptable (no new errors introduced)
- [ ] Verify `NEXT_PUBLIC_APP_URL` points to production URL (not localhost)
- [ ] Confirm Supabase project is on at least Free tier with pgvector extension enabled

---

## API Key Setup

### OAuth App Registration
- [ ] **Calendly** — register OAuth app at `calendly.com/integrations/oauth`, copy Client ID → `CALENDLY_CLIENT_ID`, Client Secret → `CALENDLY_CLIENT_SECRET`
- [ ] **Salesforce** — create Connected App in Salesforce Setup → Apps → Connected Apps, enable OAuth Settings, copy Consumer Key → `SALESFORCE_CLIENT_ID`, Consumer Secret → `SALESFORCE_CLIENT_SECRET`

### Automation Provider Keys
- [ ] **Stripe** — go to `dashboard.stripe.com/apikeys`, create secret key → `STRIPE_API_KEY`
- [ ] **HubSpot** — go to `developers.hubspot.com` → Private Apps → Create Private App, copy access token → `HUBSPOT_API_KEY`
- [ ] **Slack** — go to `api.slack.com/apps` → Create New App → OAuth & Permissions, install to workspace, copy Bot Token → `SLACK_BOT_TOKEN`
- [ ] **Discord** — go to `discord.com/developers/applications` → New Application → Bot, copy token → `DISCORD_BOT_TOKEN`
- [ ] **Telegram** — open Telegram, search `@BotFather`, send `/newbot`, copy the HTTP API token → `TELEGRAM_BOT_TOKEN`
- [ ] **Airtable** — go to `airtable.com/account`, generate API key → `AIRTABLE_API_KEY`
- [ ] **n8n** — go to n8n instance → Settings → API, copy API Key → `N8N_API_KEY`, set instance URL → `N8N_BASE_URL`
- [ ] **Make (Integromat)** — go to `make.com` → Account → API, copy API Key → `MAKE_API_KEY`, set region URL → `MAKE_BASE_URL`

### AI Provider Keys (Optional but Recommended)
- [ ] **OpenAI** — `platform.openai.com/api-keys` → Create secret key → `OPENAI_API_KEY`
- [ ] **Anthropic** — `console.anthropic.com` → API Keys → Create key → `ANTHROPIC_API_KEY`
- [ ] **Groq** — `console.groq.com` → API Keys → Create key → `GROQ_API_KEY`

---

## OAuth Flow Completion

- [ ] **LinkedIn** — visit `/api/integrations/oauth/authorize?provider=linkedin` in browser → approve consent → verify token stored in `integration_tokens` table
- [ ] **Google/Gmail** — visit `/api/integrations/oauth/authorize?provider=gmail` → approve consent → verify token stored
- [ ] **Facebook** — visit `/api/integrations/oauth/authorize?provider=facebook` → approve consent → verify token stored
- [ ] **Instagram** — visit `/api/integrations/oauth/authorize?provider=instagram` → approve consent → verify token stored
- [ ] **YouTube** — visit `/api/integrations/oauth/authorize?provider=youtube` → approve consent → verify token stored
- [ ] **Calendly** — visit `/api/integrations/oauth/authorize?provider=calendly` → approve consent → verify token stored
- [ ] **Salesforce** — visit `/api/integrations/oauth/authorize?provider=salesforce` → approve consent → verify token stored

---

## Testing

### Automated Tests
- [ ] Run `npx vitest run` — all 76+ tests must pass
- [ ] Run `npx tsc --noEmit` — zero new TypeScript errors

### Manual Validation
- [ ] Visit `/api/validation/run` in browser — verify all 35 integrations report green status
- [ ] Check Supabase `integration_tokens` table — all 7 OAuth providers have valid tokens

### Critical Path Tests
- [ ] **Content factory cycle** — trigger from dashboard → verify idea generation → research → content creation → review → publish flow completes
- [ ] **Growth engine cycle** — trigger from dashboard → verify lead discovery → enrichment → scoring → outreach flow completes
- [ ] **CEO assessment** — trigger from dashboard → verify metrics gathering → analysis → report generation → storage completes
- [ ] **Night shift daemon** — hit `/api/cron/daily` with `CRON_SECRET` header → verify queue processes all pending tasks
- [ ] **Autonomous company cycle** — trigger full orchestration → verify all subsystems execute in sequence

---

## Environment Variables (Vercel Production)

Copy these into Vercel Project → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=✅ Needed
NEXT_PUBLIC_SUPABASE_ANON_KEY=✅ Needed
NEXT_PUBLIC_APP_URL=https://your-production-url.com
SUPABASE_SERVICE_ROLE_KEY=✅ Needed
LINKEDIN_CLIENT_ID=✅ Configured
LINKEDIN_CLIENT_SECRET=✅ Configured
GOOGLE_CLIENT_ID=✅ Configured
GOOGLE_CLIENT_SECRET=✅ Configured
FACEBOOK_CLIENT_ID=✅ Configured
FACEBOOK_CLIENT_SECRET=✅ Configured
CRON_SECRET=✅ Configured
UNSPLASH_ACCESS_KEY=✅ Configured
PEXELS_API_KEY=✅ Configured
NEWSAPI_API_KEY=✅ Configured
CALENDLY_CLIENT_ID=🔴 Missing
CALENDLY_CLIENT_SECRET=🔴 Missing
SALESFORCE_CLIENT_ID=🔴 Missing
SALESFORCE_CLIENT_SECRET=🔴 Missing
STRIPE_API_KEY=🔴 Missing
HUBSPOT_API_KEY=🔴 Missing
SLACK_BOT_TOKEN=🔴 Missing
DISCORD_BOT_TOKEN=🔴 Missing
TELEGRAM_BOT_TOKEN=🔴 Missing
AIRTABLE_API_KEY=🔴 Missing
N8N_API_KEY=🔴 Missing
N8N_BASE_URL=🔴 Missing
MAKE_API_KEY=🔴 Missing
MAKE_BASE_URL=🔴 Missing
```

---

## Deployment

- [ ] Push latest code to GitHub `main` branch
- [ ] Verify GitHub Actions CI passes (if configured)
- [ ] Deploy to Vercel — connect GitHub repo → Vercel auto-deploys on push to `main`
- [ ] Configure all 28 environment variables in Vercel dashboard
- [ ] Set up CRON job for `/api/cron/daily` — use Vercel Cron Jobs (pro plan) or `cron-job.org` (free):
  ```json
  {
    "path": "/api/cron/daily",
    "schedule": "0 6 * * *",
    "headers": { "x-cron-secret": "your-cron-secret" }
  }
  ```
- [ ] Set up CRON job for night shift daemon:
  ```json
  {
    "path": "/api/cron/daily",
    "schedule": "0 2 * * *",
    "headers": { "x-cron-secret": "your-cron-secret" }
  }
  ```
- [ ] Verify Supabase connection from production — check Vercel Function logs for successful DB connection
- [ ] Run smoke test: visit production URL → login → verify dashboard loads → run one validation

---

## Post-Deployment

- [ ] Monitor Vercel Function logs for errors for first 24 hours
- [ ] Verify CRON jobs run on schedule — check `execution_logs` table in Supabase
- [ ] Test email delivery (if Gmail OAuth configured)
- [ ] Test social publishing on at least one channel
- [ ] Document any known issues in GitHub Issues

---

## Rollback Plan

If production deployment has critical issues:
1. **Vercel**: Go to Deployment → select previous successful deploy → ⋮ → Promote to Production
2. **Supabase**: Point to backup project or restore from backup
3. **Env vars**: Revert any changed environment variables to previous values
4. **Git**: `git revert HEAD` on main and force push if needed

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Product Owner | | | |
