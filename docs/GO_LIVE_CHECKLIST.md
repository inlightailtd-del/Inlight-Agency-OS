# GO_LIVE CHECKLIST — Inlight Agency OS

**Generated**: 2026-06-28
**Status**: 🟢 Near-Production — 27/31 env vars configured, 2/5 OAuth flows completed, Vercel deployed

---

## Pre-Flight Checks

- [x] Vercel deployment live at https://inlight-agency-os.vercel.app
- [x] 27 env vars configured on Vercel (all targets: prod, preview, dev)
- [x] NEXT_PUBLIC_APP_URL set to https://inlight-agency-os.vercel.app
- [x] OpenAI + OpenRouter API keys configured (AI execution works)
- [x] LinkedIn OAuth token stored in DB
- [x] Gmail OAuth token stored in DB
- [ ] Fix TypeScript errors in `lib/voice/interruptions.ts` — run `npx tsc --noEmit` and resolve all errors in that file
- [ ] Run SQL migration for client social platforms — execute `supabase/migrations/050_client_social_platforms.sql` in Supabase SQL Editor
- [ ] Verify all 107+ database tables exist — run `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'`
- [ ] Run `npx tsc --noEmit` — only pre-existing errors are acceptable

---

## API Key Setup

### OAuth App Registration
- [ ] **Calendly** — register OAuth app at `calendly.com/integrations/oauth`, copy Client ID → `CALENDLY_CLIENT_ID`, Client Secret → `CALENDLY_CLIENT_SECRET`
- [ ] **Salesforce** — create Connected App in Salesforce Setup → Apps → Connected Apps, enable OAuth Settings, copy Consumer Key → `SALESFORCE_CLIENT_ID`, Consumer Secret → `SALESFORCE_CLIENT_SECRET`

### Automation Provider Keys (✅ 10 of 13 added)
- [x] **HubSpot** — `HUBSPOT_API_KEY` added to .env.local + Vercel
- [x] **Slack** — `SLACK_BOT_TOKEN` added to .env.local + Vercel
- [x] **Discord** — `DISCORD_BOT_TOKEN` added to .env.local + Vercel
- [x] **Telegram** — `TELEGRAM_BOT_TOKEN` added to .env.local + Vercel
- [x] **Airtable** — `AIRTABLE_API_KEY` added to .env.local + Vercel
- [x] **n8n** — `N8N_API_KEY` added to .env.local + Vercel (n8n running on localhost:5678)
- [x] **Make** — `MAKE_API_KEY` added to .env.local + Vercel
- [x] **Paddle** — `PADDLE_API_KEY` added (replaces Stripe — Pakistan issue)
- [ ] **Stripe** — Skipped (replaced by Paddle, not available in Pakistan)
- [ ] **Calendly** — `CALENDLY_CLIENT_ID` + `CALENDLY_CLIENT_SECRET` still missing
- [ ] **Salesforce** — `SALESFORCE_CLIENT_ID` + `SALESFORCE_CLIENT_SECRET` still missing

### AI Provider Keys (✅ 2 of 4 added)
- [x] **OpenAI** — `OPENAI_API_KEY` added to .env.local + Vercel
- [x] **OpenRouter** — `OPENROUTER_API_KEY` + `OPENROUTER_DEFAULT_MODEL` added
- [ ] **Anthropic** — `ANTHROPIC_API_KEY` still missing (low priority)
- [ ] **Groq** — `GROQ_API_KEY` still missing (low priority)

---

## OAuth Flow Completion

- [x] **LinkedIn** — Token stored in DB (3 tokens generated, duplicates deactivated)
- [x] **Google/Gmail** — New Google Cloud project created, OAuth consent completed, token stored
- [ ] **Facebook** — 🔴 Blocked by Meta device trust (cannot add redirect URIs)
- [ ] **Instagram** — 🔴 Blocked by Meta device trust (shares Facebook restriction)
- [ ] **YouTube** — 🟡 Not yet completed (uses Google scope, needs separate flow)
- [ ] **Calendly** — Cannot proceed until OAuth app is registered
- [ ] **Salesforce** — Cannot proceed until connected app is created

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

## Environment Variables (Vercel Production) ✅ COMPLETE

All 27 environment variables configured on Vercel (production, preview, and development targets):

```
NEXT_PUBLIC_SUPABASE_URL=🟢 Configured
NEXT_PUBLIC_SUPABASE_ANON_KEY=🟢 Configured
NEXT_PUBLIC_APP_URL=https://inlight-agency-os.vercel.app
SUPABASE_SERVICE_ROLE_KEY=🟢 Configured
LINKEDIN_CLIENT_ID=🟢 Configured
LINKEDIN_CLIENT_SECRET=🟢 Configured
GOOGLE_CLIENT_ID=🟢 Configured
GOOGLE_CLIENT_SECRET=🟢 Configured
FACEBOOK_CLIENT_ID=🟢 Configured
FACEBOOK_CLIENT_SECRET=🟢 Configured
CRON_SECRET=🟢 Configured
UNSPLASH_ACCESS_KEY=🟢 Configured
PEXELS_API_KEY=🟢 Configured
NEWSAPI_API_KEY=🟢 Configured
OPENAI_API_KEY=🟢 Configured
OPENROUTER_API_KEY=🟢 Configured
OPENROUTER_DEFAULT_MODEL=🟢 Configured
PADDLE_API_KEY=🟢 Configured
RESEND_API_KEY=🟢 Configured
HUBSPOT_API_KEY=🟢 Configured
SLACK_BOT_TOKEN=🟢 Configured
DISCORD_BOT_TOKEN=🟢 Configured
TELEGRAM_BOT_TOKEN=🟢 Configured
AIRTABLE_API_KEY=🟢 Configured
N8N_API_KEY=🟢 Configured
MAKE_API_KEY=🟢 Configured
ELEVENLABS_API_KEY=🟢 Configured
```

---

## Deployment ✅ COMPLETE

- [x] Code pushed to GitHub `main` branch
- [x] Deployed to Vercel — https://inlight-agency-os.vercel.app
- [x] All 27 environment variables configured in Vercel dashboard
- [x] Landing page loads (200), login page loads (200)
- [x] Dashboard redesigned as AI Command Center (13+ panels)
- [x] `export const dynamic = 'force-dynamic'` added to dashboard layout
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
