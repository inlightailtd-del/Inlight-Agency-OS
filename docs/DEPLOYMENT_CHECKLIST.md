# Deployment Checklist — Inlight Agency OS Go-Live

## Current Build Status
| Check | Status |
|-------|--------|
| TypeScript | ✅ 0 errors |
| Tests | ✅ 111/111 passing |
| Lint | ✅ 0 errors |
| Build | ✅ Compiles successfully |

---

## 1. Pre-Flight Checks

### 1.1 Code Quality
- [ ] `npx tsc --noEmit --skipLibCheck` — 0 errors
- [ ] `npx vitest run` — all 111 tests pass
- [ ] `npx next lint` — 0 errors
- [ ] `npx next build` — compiles successfully

### 1.2 Database
- [ ] Run `npx supabase push` to apply all 52 migrations
- [ ] Verify all 107 tables exist in production
- [ ] Verify RLS policies on all tables (154 total)
- [ ] Verify triggers and functions are intact
- [ ] Enable point-in-time recovery in Supabase dashboard
- [ ] Set up daily automated backups in Supabase dashboard
- [ ] Verify `seed.sql` exists or create baseline data

### 1.3 Environment Variables
Create ALL 37 env vars in Vercel project settings:

**Required (18):**
| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard | Database connection |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard | Anonymous client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard | Admin operations |
| `NEXT_PUBLIC_APP_URL` | Your domain | App URL for callbacks |
| `CRON_SECRET` | Generate via `openssl rand -hex 32` | Cron authentication |

**OAuth — 4 providers (8 vars):**
| Variable | Source |
|----------|--------|
| `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` | LinkedIn Developer Portal |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `FACEBOOK_CLIENT_ID` + `FACEBOOK_CLIENT_SECRET` | Meta Developer Portal |
| `CALENDLY_CLIENT_ID` + `CALENDLY_CLIENT_SECRET` | Calendly Developer Portal |

**Content APIs (3):**
| Variable | Source |
|----------|--------|
| `UNSPLASH_ACCESS_KEY` | Unsplash Developer |
| `PEXELS_API_KEY` | Pexels Developer |
| `NEWSAPI_API_KEY` | NewsAPI |

**Automation Providers (8):**
| Variable | Source |
|----------|--------|
| `STRIPE_API_KEY` | Stripe Dashboard |
| `HUBSPOT_API_KEY` | HubSpot Private App |
| `SLACK_BOT_TOKEN` | Slack API |
| `DISCORD_BOT_TOKEN` | Discord Developer |
| `TELEGRAM_BOT_TOKEN` | BotFather |
| `AIRTABLE_API_KEY` | Airtable |
| `N8N_API_KEY` + `N8N_BASE_URL` | n8n instance |
| `MAKE_API_KEY` + `MAKE_BASE_URL` | Make.com |

**Observability (5):**
| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry Dashboard |
| `SENTRY_DSN` | Sentry Dashboard |
| `LANGFUSE_SECRET_KEY` | Langfuse Dashboard |
| `LANGFUSE_PUBLIC_KEY` | Langfuse Dashboard |
| `LANGFUSE_BASE_URL` | Langfuse (default: https://cloud.langfuse.com) |

---

## 2. OAuth Flow Completion

For each provider, run the OAuth flow by visiting:
```
GET /api/integrations/oauth/authorize?provider={provider}
```

- [ ] LinkedIn — authorizes content publishing
- [ ] Gmail — authorizes email sending
- [ ] Facebook — authorizes social posting
- [ ] Instagram — authorizes Instagram posting
- [ ] YouTube — authorizes video publishing
- [ ] Calendly — authorizes meeting booking
- [ ] Salesforce — authorizes CRM sync

---

## 3. CI/CD Pipeline

### GitHub Actions
- [ ] Create `.github/workflows/ci.yml` with:
  - On push to main: `tsc --noEmit`, `vitest run`, `next lint`, `next build`
  - On push to main: deploy to Vercel (via Vercel GitHub integration)
  - Weekly: `supabase db dump` backup

### Manual Steps
- [ ] Enable Vercel GitHub Integration (automatic deploy on push)
- [ ] Configure Vercel Production Domain
- [ ] Set all 37 env vars in Vercel dashboard
- [ ] Verify Vercel deployment succeeds

---

## 4. Cron Jobs

Configure external cron service (cron-job.org, Uptime Robot, or similar) with these endpoints:

| URL | Method | Headers | Frequency | Purpose |
|-----|--------|---------|-----------|---------|
| `https://{domain}/api/cron/daily` | GET | `Authorization: Bearer {CRON_SECRET}` | Every hour | Growth execution + queue drain |
| `https://{domain}/api/queue/process` | GET | `x-cron-secret: {CRON_SECRET}` | Every 5 minutes | Process job queue |
| `https://{domain}/api/night-shift/daemon` | POST | Cookie session | Every 30 minutes | Night shift daemon cycle |

---

## 5. Monitoring Setup

- [ ] Install `@sentry/nextjs` and `langfuse` packages
- [ ] Add Sentry DSN to env vars
- [ ] Add Langfuse keys to env vars
- [ ] Verify `/api/health` returns healthy status
- [ ] Configure Sentry alerts (email/Slack)
- [ ] Set up uptime monitoring on `/api/health`

---

## 6. Backup Strategy

- [ ] Enable Supabase Point-in-Time Recovery (7-day minimum)
- [ ] Create weekly `pg_dump` via GitHub Action
- [ ] Backup `.env.local` to secure location
- [ ] Document recovery procedure in `docs/RECOVERY.md`

---

## 7. Security Verification

- [ ] All API routes require auth (exceptions: `/api/health`, `/api/cron/daily` with CRON_SECRET)
- [ ] Middleware protects `/dashboard/*` routes
- [ ] All Supabase tables have RLS policies
- [ ] Service role key is NOT exposed to client
- [ ] CRON_SECRET is complex (32+ char hex)
- [ ] OAuth state parameter validates CSRF

---

## 8. Rollback Plan

### Vercel Rollback
1. Go to Vercel Dashboard → Deployments
2. Find last known-good deployment
3. Click "..." → Promote to Production
4. Done in < 30 seconds

### Database Rollback
1. Identify the migration to revert
2. Create a down migration
3. Run `supabase migration up` with the fix
4. Or use Supabase Point-in-Time Recovery

### Code Rollback
1. `git revert HEAD`
2. `git push origin main`
3. Vercel auto-deploys the revert

---

## 9. Go-Live Sequence

### Day 1: Foundation
1. Set up all 37 env vars in Vercel
2. Run all Supabase migrations
3. Deploy to Vercel staging
4. Verify `/api/health` returns healthy
5. Run all 111 tests in CI

### Day 2: OAuth & APIs
1. Complete LinkedIn OAuth flow
2. Complete Google/Gmail OAuth flow
3. Complete Facebook/Instagram OAuth flow
4. Verify content publishing pipeline
5. Add Stripe API key and verify

### Day 3: Automation
1. Add automation provider API keys
2. Configure cron jobs
3. Set up Sentry + Langfuse
4. Test night shift daemon
5. Verify autonomous company cycle

### Day 4: Production
1. Point domain to Vercel
2. Run full validation via `/api/validation/run`
3. Execute first content cycle
4. Verify approvals flow
5. Monitor for 24 hours

---

## 10. Sign-Off

| Area | Verified By | Date | Status |
|------|-------------|------|--------|
| Code Quality | | | ❌ |
| Database | | | ❌ |
| Environment | | | ❌ |
| OAuth Flows | | | ❌ |
| Cron Jobs | | | ❌ |
| Monitoring | | | ❌ |
| Security | | | ❌ |
| Rollback | | | ❌ |
