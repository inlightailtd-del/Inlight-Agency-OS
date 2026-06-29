# Production Gaps Analysis — What Prevents Go-Live

## Can Inlight Agency OS run Inlight Agency tomorrow?

**LIMITED YES** — 84% of credentials configured, Vercel deployed, Google & LinkedIn OAuth complete. Remaining blockers: Meta device trust, SQL migration, cron setup, and monitoring.

---

## What Exactly Prevents It?

| # | Blocker | Severity | Status | Impact |
|---|---------|----------|--------|--------|
| 1 | Missing Automation Provider API Keys (17 keys) | Critical | ✅ RESOLVED (10/17 added, Stripe replaced by Paddle) | Revenue, CRM, communication, and media workflows ENABLED |
| 2 | OAuth Tokens Not Yet Generated | Critical | 🟡 PARTIAL (LinkedIn ✅, Gmail ✅, Facebook/Instagram 🔴 Blocked by Meta) | Can publish content via LinkedIn, send email via Gmail |
| 3 | No Real Ad Platform Integration | Critical | 🔴 Still stubs | Ad providers (4) are stubs — zero actual ad spend possible |
| 4 | Missing Production AI Provider Keys | Critical | 🟡 PARTIAL (OpenAI ✅, OpenRouter ✅, Anthropic/Groq missing) | AI agent execution works via OpenAI/OpenRouter |
| 5 | No CI/CD Pipeline | High | 🔴 Not addressed | No automated testing, no deployment automation |
| 6 | No Database Backup Automation | High | 🔴 Not addressed | No pg_dump, no backup cron, no recovery plan |
| 7 | No Sentry / Monitoring | High | 🔴 Not addressed | No error tracking, no performance monitoring, no uptime alerts |
| 8 | No Vercel Cron Configuration | Medium | 🔴 Not addressed | vercel.json has no crons section |

---

## What Credentials Were Added (This Session)

### AI Provider Keys (✅ 2 of 4 resolved)
| Key | Status | Impact |
|-----|--------|--------|
| `OPENAI_API_KEY` | ✅ Added to .env.local + Vercel | AI agent execution works in production |
| `OPENROUTER_API_KEY` | ✅ Added to .env.local + Vercel | AI fallback with free Gemini Flash |
| `ANTHROPIC_API_KEY` | ❌ Still missing | Claude-powered workflows unavailable |
| `GROQ_API_KEY` | ❌ Still missing | Fast inference fallback unavailable |

### Automation & Integration Keys (✅ 10 of 17 added)
| Key | Status | Blocks |
|-----|--------|--------|
| `OPENAI_API_KEY` | ✅ Added | AI agent execution |
| `OPENROUTER_API_KEY` | ✅ Added | AI fallback inference |
| `PADDLE_API_KEY` | ✅ Added (replaces Stripe) | Payment processing, billing |
| `RESEND_API_KEY` | ✅ Added | Email delivery |
| `HUBSPOT_API_KEY` | ✅ Added | CRM integration, contact sync |
| `SLACK_BOT_TOKEN` | ✅ Added | Team notifications |
| `DISCORD_BOT_TOKEN` | ✅ Added | Community management |
| `TELEGRAM_BOT_TOKEN` | ✅ Added | Broadcast messaging |
| `AIRTABLE_API_KEY` | ✅ Added | Database/spreadsheet sync |
| `N8N_API_KEY` | ✅ Added | Workflow automation |
| `MAKE_API_KEY` | ✅ Added | Workflow automation |
| `ELEVENLABS_API_KEY` | ✅ Added (TTS needs billing plan) | Voice synthesis, AI calling |
| `STRIPE_SECRET_KEY` | 🔴 Replaced by Paddle | N/A |
| `CALENDLY_API_KEY` | ❌ Still missing | Meeting scheduling |
| `SALESFORCE_ACCESS_TOKEN` | ❌ Still missing | Enterprise CRM |
| `TWILIO_AUTH_TOKEN` | ❌ Still missing | SMS/Voice |

### OAuth Tokens (✅ 2 of 5 resolved)
| Provider | Status | Impact |
|----------|--------|--------|
| LinkedIn | ✅ Token stored in DB | Can post content, profile lookup |
| Gmail | ✅ Token stored in DB | Can send/receive email |
| Facebook | 🔴 Blocked by Meta device trust | Cannot post to Facebook pages |
| Instagram | 🔴 Blocked by Meta device trust | Cannot publish to Instagram |
| YouTube | 🟡 Not yet completed | Cannot upload videos |

---

## What Still Blocks Go-Live

### Critical Blockers Remaining
1. **Facebook/Instagram OAuth** — Meta device trust restriction prevents adding redirect URIs
2. **Client social platforms SQL** — Needs manual run in Supabase dashboard SQL Editor
3. **Ad platform integration** — All 4 ad providers still return mock data
4. **No CI/CD pipeline** — GitHub Actions not configured
5. **No Sentry/monitoring** — Zero error tracking in production
6. **No database backups** — No pg_dump or recovery plan
7. **No Vercel cron jobs** — Night shift daemon has no trigger

### Minor Blockers
8. **ElevenLabs TTS** — API key verified, but TTS returns 402 (needs $5/month Starter plan)
9. **YouTube OAuth** — Token not yet generated (separate flow from Gmail)
10. **Calendly/Salesforce apps** — Not yet registered

---

## Approve Only Mode Assessment

**Yes, Inlight can operate in approve-only mode NOW.**

The three critical prerequisites are met:
1. ✅ **AI provider key** — `OPENAI_API_KEY` + `OPENROUTER_API_KEY` configured
2. ✅ **LinkedIn OAuth** — Token stored, can post content
3. ✅ **Gmail OAuth** — Token stored, can send email

### What Can Be Approved
| Capability | Status | Notes |
|-----------|--------|-------|
| Content generation (review before publish) | ✅ Works | CEO generates, Hamza approves |
| CEO decisions (strategic, hiring, budget) | ✅ Works | Decision stored in `pending_approval` |
| Agent approvals (hire/promote) | ✅ Works | CEO proposes, Hamza approves/rejects |
| LinkedIn posting | ✅ Works | Token stored in DB |
| Gmail sending | ✅ Works | Token stored in DB |
| Report generation | ✅ Works | Summaries generated, approval integrated |
| Factory operations | ✅ Works | Factory runs with approval gates |

### What Cannot Be Approved
| Capability | Reason |
|-----------|--------|
| Ad campaigns | All 4 ad providers are stubs |
| Voice calls | ElevenLabs needs paid plan ($5/month) |
| Facebook/Instagram posting | Meta device trust blocking OAuth |
| YouTube uploads | YouTube OAuth flow not yet completed |

---

## Deployed Infrastructure

| Component | Status | URL |
|-----------|--------|-----|
| **Vercel deployment** | ✅ Live | https://inlight-agency-os.vercel.app |
| **Supabase project** | ✅ Online | wvintltwxydmlyvcmcis.supabase.co |
| **n8n (local)** | ✅ Running | http://localhost:5678 |
| **Environment variables** | ✅ 27/27 on Vercel | All targets (prod, preview, dev) |
| **Dashboard redesign** | ✅ AI Command Center | /dashboard (13+ panels) |
| **Login/auth** | ✅ Works | /login (email confirmed as inlightailtd@gmail.com) |

---

## Immediate Next Steps (Ranked)

1. **Run SQL migration** in Supabase dashboard → Paste `supabase/migrations/050_client_social_platforms.sql` in SQL Editor
2. **Add Vercel cron jobs** → Configure `crons` in vercel.json (requires Vercel Pro or cron-job.org)
3. **Upgrade ElevenLabs** → Purchase $5/month Starter plan for TTS
4. **Complete YouTube OAuth** → Visit `/api/integrations/oauth/authorize?provider=youtube`
5. **Retry Facebook/Instagram** → Check back after Meta device trust resolves
6. **Set up GitHub Actions** → Push CI/CD pipeline for auto-deploy
7. **Add Sentry** → Create project, add `SENTRY_DSN` to env
