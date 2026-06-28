# NEXT 90 DAYS PLAN — Inlight Agency OS

**Generated**: 2026-06-27
**Goal**: Full production readiness in 12 weeks.

---

## Week 1: Blockers & Critical Fixes

| Metric | Value |
|--------|-------|
| **Priority** | 🔴 Critical |
| **Complexity** | Medium |
| **Estimated Time** | 20–25 hours |
| **Dependencies** | None |
| **ROI** | 🔴 High |

**Breakdown:**
- [ ] Fix TypeScript errors in `lib/voice/interruptions.ts` — resolve type mismatches, missing return types, and any implicit `any` violations
- [ ] Add authentication middleware to `app/api/queue/process/route.ts` — implement Supabase session check or bearer token validation
- [ ] Obtain Calendly OAuth credentials — register OAuth app at `calendly.com/integrations/oauth`, copy client ID/secret
- [ ] Obtain Salesforce OAuth credentials — create connected app in Salesforce Setup, enable OAuth settings, copy consumer key/secret
- [ ] Verify all 107 database tables exist via `SELECT count(*) FROM information_schema.tables`
- [ ] Run `npx tsc --noEmit` and document any pre-existing errors

**Deliverables:**
- Working queue endpoint with auth
- Calendly + Salesforce env vars populated
- Clean TypeScript compilation baseline

---

## Week 2: Complete OAuth Flows

| Metric | Value |
|--------|-------|
| **Priority** | 🔴 Critical |
| **Complexity** | Medium |
| **Estimated Time** | 20–25 hours |
| **Dependencies** | Week 1 (env vars), Google Cloud project, Facebook Developer app, LinkedIn Developer app |
| **ROI** | 🔴 High |

**Breakdown:**
- [ ] Run LinkedIn OAuth flow — navigate to `/api/integrations/oauth/authorize?provider=linkedin`, approve consent, verify token storage in `integration_tokens` table
- [ ] Run Gmail OAuth flow — enable Gmail API in Google Cloud Console, configure OAuth consent screen, run authorize endpoint, verify token storage
- [ ] Run Facebook OAuth flow — configure Facebook Login product, add `pages_manage_posts` scope, run authorize endpoint
- [ ] Run Instagram OAuth flow — configure Instagram Graph API, link Facebook page, run authorize endpoint
- [ ] Add comprehensive error handling for expired/revoked tokens — implement refresh logic in `lib/integrations/oauth/handler.ts`
- [ ] Test end-to-end: authorize → store token → make API call → refresh → make second API call

**Deliverables:**
- All 4 OAuth flows working end-to-end
- Refresh token logic verified
- Integration tests passing for social providers

---

## Week 3: Automation Provider API Keys

| Metric | Value |
|--------|-------|
| **Priority** | 🔴 Critical |
| **Complexity** | Low |
| **Estimated Time** | 8–12 hours |
| **Dependencies** | None (standalone key generation) |
| **ROI** | 🔴 High |

**Breakdown:**
- [ ] Stripe — generate API key at `dashboard.stripe.com/apikeys`, add `STRIPE_API_KEY` to `.env.local`
- [ ] HubSpot — generate private app API key at `developers.hubspot.com`, add `HUBSPOT_API_KEY`
- [ ] Slack — create bot token at `api.slack.com/apps` → OAuth & Permissions, add `SLACK_BOT_TOKEN`
- [ ] Discord — create bot at `discord.com/developers/applications`, copy token, add `DISCORD_BOT_TOKEN`
- [ ] Telegram — create bot via `@BotFather`, copy token, add `TELEGRAM_BOT_TOKEN`
- [ ] Airtable — generate API key at `airtable.com/account`, add `AIRTABLE_API_KEY`
- [ ] n8n — generate API key from n8n settings, add `N8N_API_KEY` + `N8N_BASE_URL`
- [ ] Make (formerly Integromat) — generate API key, add `MAKE_API_KEY` + `MAKE_BASE_URL`
- [ ] Update all provider config schemas to read from env vars
- [ ] Write a validation script that pings each provider's health endpoint

**Deliverables:**
- 8 provider API keys configured
- Validation script confirms all keys are functional
- Provider configs aligned with env vars

---

## Week 4: Real Video Rendering & Telephony

| Metric | Value |
|--------|-------|
| **Priority** | 🟡 High |
| **Complexity** | High |
| **Estimated Time** | 25–30 hours |
| **Dependencies** | Week 3 (API keys generally) |
| **ROI** | 🟡 Medium |

**Breakdown:**
- [ ] Sign up for Runway API at `runwayml.com` — obtain API key, review rate limits
- [ ] Replace mock video rendering in `lib/video/renderer.ts` with real Runway API calls
- [ ] Implement video generation queue with progress polling
- [ ] Add error handling for generation failures, timeouts, content moderation rejects
- [ ] Sign up for Vapi at `vapi.ai` — obtain API key, review WebSocket docs
- [ ] Replace mock telephony in `lib/voice/telephony.ts` with real Vapi/Twilio calls
- [ ] Implement call state machine: dial → ring → connect → conference → hangup
- [ ] Test video rendering with a sample script
- [ ] Test outbound call with a test number

**Deliverables:**
- Real video generation via Runway API
- Real telephony via Vapi/Twilio
- Both with queue, error handling, and status tracking

---

## Week 5: WhatsApp & X/Twitter Publishing

| Metric | Value |
|--------|-------|
| **Priority** | 🟡 High |
| **Complexity** | Medium |
| **Estimated Time** | 15–20 hours |
| **Dependencies** | Week 2 (OAuth patterns), Facebook Business account |
| **ROI** | 🟡 Medium |

**Breakdown:**
- [ ] WhatsApp Business API — register at `developers.facebook.com`, create WhatsApp Business Account
- [ ] Configure webhook for incoming messages
- [ ] Implement send template message, send text message, send media in `lib/integrations/social-providers.ts`
- [ ] X/Twitter API — register at `developer.twitter.com`, create project, obtain API keys
- [ ] Implement tweet, reply, thread, DM in social providers
- [ ] Add OAuth 1.0a support for Twitter (different flow from standard OAuth 2.0)
- [ ] Test WhatsApp message send + receive
- [ ] Test Twitter tweet + reply + thread

**Deliverables:**
- WhatsApp messaging functional (send/receive)
- Twitter/X publishing functional (tweet, reply, thread)
- Both integrated into content publishing pipeline

---

## Week 6: Software Factory & Website Factory

| Metric | Value |
|--------|-------|
| **Priority** | 🟡 High |
| **Complexity** | High |
| **Estimated Time** | 25–30 hours |
| **Dependencies** | Week 1 (auth fixes), GitHub integration ready |
| **ROI** | 🟡 Medium |

**Breakdown:**
- [ ] Software Factory — implement real GitHub API integration (not stubs)
- [ ] Connect `lib/software-factory/generator.ts` to actual repository creation via GitHub
- [ ] Implement Next.js boilerplate generation from templates
- [ ] Add deployment pipeline: generate → push → deploy to Vercel
- [ ] Website Factory — integrate with actual CMS or static site generation
- [ ] Implement client website scaffolding from templates in `lib/website-factory/`
- [ ] Add custom domain configuration via Vercel API
- [ ] Test full cycle: user requests website → system generates → deploys → returns URL

**Deliverables:**
- Software Factory creates real GitHub repos with boilerplate code
- Website Factory deploys real client websites
- Both have progress tracking and error recovery

---

## Week 7: AI Provider Keys & CI/CD Pipeline

| Metric | Value |
|--------|-------|
| **Priority** | 🟡 High |
| **Complexity** | Low |
| **Estimated Time** | 10–15 hours |
| **Dependencies** | GitHub repo, Vercel project |
| **ROI** | 🟡 Medium |

**Breakdown:**
- [ ] OpenAI — generate API key at `platform.openai.com/api-keys`, add to `.env.local` (or UI settings)
- [ ] Anthropic — generate API key at `console.anthropic.com`, add to `.env.local` (or UI settings)
- [ ] Groq — generate API key at `console.groq.com`, add to `.env.local` (or UI settings)
- [ ] Update AI provider selection logic to prioritize providers based on availability
- [ ] Set up GitHub Actions CI pipeline — lint → typecheck → build → test
- [ ] Set up Vercel preview deployments for PRs
- [ ] Add automated DB migration check to CI
- [ ] Verify Ollama fallback works when cloud AI providers are unavailable

**Deliverables:**
- 3 AI provider keys configured
- GitHub Actions CI passing all checks
- Vercel preview deployments working

---

## Week 8: End-to-End Testing

| Metric | Value |
|--------|-------|
| **Priority** | 🟡 High |
| **Complexity** | Medium |
| **Estimated Time** | 20–25 hours |
| **Dependencies** | Weeks 1–7 |
| **ROI** | 🟡 Medium |

**Breakdown:**
- [ ] Write end-to-end test for content factory cycle: idea → research → generate → review → publish
- [ ] Write end-to-end test for growth engine cycle: lead discovery → enrichment → scoring → outreach
- [ ] Write end-to-end test for CEO assessment: gather metrics → analyze → generate assessment → store
- [ ] Write end-to-end test for night shift daemon: trigger → queue tasks → execute → report
- [ ] Write end-to-end test for autonomous company cycle: all subsystems orchestrated
- [ ] Write integration test for queue system with auth
- [ ] Write integration test for OAuth token refresh
- [ ] Run full test suite with `vitest --reporter=verbose`
- [ ] Achieve 90%+ pass rate on all critical paths

**Deliverables:**
- Comprehensive end-to-end test suite
- Test report showing all critical paths pass
- CI pipeline includes E2E tests

---

## Week 9: Dashboard Server Actions & Vector Search

| Metric | Value |
|--------|-------|
| **Priority** | 🟡 High |
| **Complexity** | Medium |
| **Estimated Time** | 20–25 hours |
| **Dependencies** | Week 7 (AI providers), database migrations |
| **ROI** | 🟡 Medium |

**Breakdown:**
- [ ] Implement server actions for dashboard metrics — real Supabase queries replacing mock data
- [ ] Build real-time dashboard updates via Supabase subscriptions
- [ ] Add date range filtering to all dashboard widgets
- [ ] Implement knowledge doc ingestion pipeline — parse MD/PDF/TXT → chunk → embed → store
- [ ] Implement vector search endpoint at `/api/knowledge/search` with pgvector similarity queries
- [ ] Add hybrid search (full-text + vector) for better results
- [ ] Build knowledge doc management UI in dashboard
- [ ] Test search relevance with sample queries

**Deliverables:**
- Dashboard shows real data from database
- Knowledge doc search functional with vector embeddings
- Knowledge management UI for adding/removing docs

---

## Week 10: Lead Enrichment & Content Campaigns

| Metric | Value |
|--------|-------|
| **Priority** | 🟢 Medium |
| **Complexity** | Medium |
| **Estimated Time** | 15–20 hours |
| **Dependencies** | Week 3 (API keys), Week 9 (vector search) |
| **ROI** | 🟢 Low |

**Breakdown:**
- [ ] Sign up for Apollo API at `apollo.io` — obtain API key
- [ ] Implement lead enrichment in `lib/growth/lead-enrichment.ts` — company info, contacts, intent data
- [ ] Build enrichment queue: discover → enrich → score → route to CRM
- [ ] Implement content marketing campaign engine — schedule posts across channels
- [ ] Build campaign calendar UI in dashboard
- [ ] Add campaign analytics: impressions, clicks, conversions
- [ ] Test enrichment with a sample lead list
- [ ] Run a test campaign across 2 channels

**Deliverables:**
- Apollo lead enrichment functional
- Content campaign engine schedulable via dashboard
- Campaign analytics tracking

---

## Week 11: Mobile, Notifications & Rate Limiting

| Metric | Value |
|--------|-------|
| **Priority** | 🟢 Medium |
| **Complexity** | Medium |
| **Estimated Time** | 15–20 hours |
| **Dependencies** | Week 9 (dashboard) |
| **ROI** | 🟢 Low |

**Breakdown:**
- [ ] Audit all dashboard pages for mobile responsiveness — fix layout breakpoints
- [ ] Test on 3 viewports: 375px (mobile), 768px (tablet), 1440px (desktop)
- [ ] Implement notification system — in-app toast notifications + email digests
- [ ] Add notification preferences UI in dashboard settings
- [ ] Implement API rate limiting with upstash/ratelimit or similar
- [ ] Add rate limit headers to API responses
- [ ] Configure different rate limits per endpoint tier
- [ ] Test mobile rendering on all dashboard pages

**Deliverables:**
- Mobile-responsive dashboard
- Notification system with preferences
- API rate limiting configured

---

## Week 12: Final Integration Testing & Production Deployment

| Metric | Value |
|--------|-------|
| **Priority** | 🔴 Critical |
| **Complexity** | High |
| **Estimated Time** | 25–30 hours |
| **Dependencies** | All previous weeks |
| **ROI** | 🔴 High |

**Breakdown:**
- [ ] Run full integration test suite — all 76+ vitest tests must pass
- [ ] Run manual validation at `/api/validation/run` — verify all 35 integrations respond
- [ ] Run end-to-end content factory test — idea to published post
- [ ] Run end-to-end growth engine test — lead to outreach
- [ ] Run CEO assessment end-to-end — metrics to report
- [ ] Run night shift daemon end-to-end — trigger to execution report
- [ ] Run autonomous company cycle — full orchestration
- [ ] Push to GitHub — verify CI passes
- [ ] Deploy to Vercel — configure environment variables in Vercel dashboard
- [ ] Set up CRON job for `/api/cron/daily` — use Vercel Cron Jobs or external cron service
- [ ] Set up CRON job for night shift daemon — schedule for off-peak hours
- [ ] Verify Supabase connection from production environment
- [ ] Post-deployment smoke test — visit production URL, run critical workflows
- [ ] Document any known issues or limitations

**Deliverables:**
- 🚀 **Production deployment live**
- All CRON jobs running
- Smoke tests passed
- Known issues documented

---

## Summary Timeline

| Week | Focus | Hours | Complexity | ROI |
|------|-------|-------|-----------|-----|
| 1 | Blockers & Critical Fixes | 20–25 | Medium | 🔴 High |
| 2 | Complete OAuth Flows | 20–25 | Medium | 🔴 High |
| 3 | Automation Provider API Keys | 8–12 | Low | 🔴 High |
| 4 | Real Video Rendering & Telephony | 25–30 | High | 🟡 Medium |
| 5 | WhatsApp & X/Twitter Publishing | 15–20 | Medium | 🟡 Medium |
| 6 | Software Factory & Website Factory | 25–30 | High | 🟡 Medium |
| 7 | AI Provider Keys & CI/CD Pipeline | 10–15 | Low | 🟡 Medium |
| 8 | End-to-End Testing | 20–25 | Medium | 🟡 Medium |
| 9 | Dashboard Server Actions & Vector Search | 20–25 | Medium | 🟡 Medium |
| 10 | Lead Enrichment & Content Campaigns | 15–20 | Medium | 🟢 Low |
| 11 | Mobile, Notifications & Rate Limiting | 15–20 | Medium | 🟢 Low |
| 12 | Final Integration Testing & Production Deployment | 25–30 | High | 🔴 High |

**Total estimated effort**: 220–280 hours (roughly 18–23 hours per week)
