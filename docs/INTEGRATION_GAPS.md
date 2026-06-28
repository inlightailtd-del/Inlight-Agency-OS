# INTEGRATION GAPS — Inlight Agency OS

**Generated**: 2026-06-16
**Scope**: What is already solved, partially solved, and completely missing in terms of integrations, external APIs, and data sources.

---

## 1. WHAT IS ALREADY SOLVED (Built & Working)

### Real API Integrations

| Provider | Capability | Evidence |
|----------|-----------|----------|
| **LinkedIn** | OAuth 2.0 flow, UGC post creation via `/v2/ugcPosts`, user profile resolution | `lib/integrations/providers.ts` — LinkedInProvider with real fetch calls |
| **Gmail** | OAuth 2.0 flow, send email via Gmail API RFC 2822, list messages | `lib/integrations/providers.ts` — GmailProvider with real fetch calls |
| **Facebook** | OAuth 2.0 flow, feed post via Graph API v22.0, page listing, health check | `lib/integrations/social-providers.ts` — FacebookProvider with real fetch calls |
| **OAuth Framework** | Full OAuth 2.0 authorization, callback, token refresh, credential management | `lib/integrations/oauth-config.ts`, `oauth-handler.ts` |
| **Provider Registry** | 20 providers registered in database with metadata | `migrations/027` integration_registry table |
| **Rate Limiting** | Per-provider rate limit windows and max requests defined | `lib/integrations/provider.ts` — RATE_LIMITS constant |
| **Health Logging** | Per-action health logging with status, duration, and error tracking | `lib/integrations/provider.ts` — logHealth() |
| **Connection Management** | Connect/disconnect/refresh, credential lifecycle, expiration detection | `lib/integrations/provider.ts` — loadCredentials(), refreshCredentials() |
| **AI Provider Layer** | 4 AI providers (Ollama, OpenAI, Anthropic, Groq) with config UI | `lib/ai/provider.ts`, `/dashboard/settings/ai` |

### Internal Capabilities

| Capability | Status | Notes |
|-----------|--------|-------|
| Content Generation | ✅ Complete | Blog, social, ad, email, landing page |
| Lead Scoring | ✅ Complete | AI-powered via LLM |
| CEO Assessment | ✅ Complete | System-wide analysis + autonomous decisions |
| Project Monitoring | ✅ Complete | 5 risk categories, task creation |
| Department Swarms | ✅ Complete | Marketing, Sales, Operations |
| Vector Search | ✅ Complete | pgvector embeddings + RAG context |
| OAuth Infrastructure | ✅ Complete | Full auth code flow with PKCE |
| Approval System | ✅ Complete | 12 action types, 4 autonomy levels |
| Job Queue | ✅ Complete | Background processing with retries |
| Night Shift | ✅ Complete | Offline batch processing |

---

## 2. WHAT IS PARTIALLY SOLVED

### Integrations with Stub Implementations

| Provider | What Exists | What's Missing | Impact |
|----------|------------|----------------|--------|
| **HubSpot** | Provider class with mock CRUD actions | No real HubSpot API calls | Cannot sync contacts/deals automatically |
| **Stripe** | Provider class with mock payment actions | No real Stripe API calls | Cannot process real payments |
| **Twilio** | Provider class with mock SMS/call actions | No real Twilio API calls | Cannot send SMS or make calls |
| **Vapi** | Provider class with mock call actions | No real Vapi API calls | No AI voice calling |
| **Bland AI** | Provider class with mock call actions | No real Bland AI API calls | No voice calling alternative |
| **Apollo** | Provider class with mock enrich actions | No real Apollo API calls | Cannot enrich leads with external data |
| **Clay** | Provider class with mock enrich actions | No real Clay API calls | Cannot enrich company/people data |
| **Instagram** | Provider class with mock publish/insights | No real Instagram Graph API calls | Cannot publish to Instagram |
| **X (Twitter)** | Provider class with mock publish/insights | No real X API calls | Cannot post to X/Twitter |
| **YouTube** | Provider class with mock publish/analytics | No real YouTube API calls | Cannot upload or analyze videos |
| **Outlook** | Provider class with mock email actions | No real Microsoft Graph API calls | Cannot send through Outlook |
| **Calendly** | OAuth flow configured | Provider returns mock data | Cannot schedule real meetings |

### Agent Runtime Automation

| Area | What's Built | What's Missing | Gap |
|------|-------------|----------------|-----|
| Cron trigger | `/api/cron/daily` endpoint exists, AgentRuntime.tick() wired | No external cron service configured (cron-job.org) | Runtime never executes autonomously |
| Event-driven | `runtime.on()` implemented | No database triggers or webhooks wired to call it | Events never trigger agent execution |
| Schedule loop | `runtime.schedule()` stores schedules | No dispatcher loop that reads and fires schedules | Scheduled agents never run automatically |

### Company Brain V2

| Area | Status | Gap |
|------|--------|-----|
| Vector search | ✅ RPC exists in migration 040 | Chat UI not built for interactive Q&A |
| Knowledge indexing | ✅ Auto-indexes on create/edit | No Supabase trigger for direct DB inserts |
| Embedding generation | ✅ Works with Ollama | Falls back to zero vector if Ollama unavailable |

### UI/UX

| Area | Status | Gap |
|------|--------|-----|
| Brain Chat UI | ❌ Missing | No human-facing chat interface for vector search |
| Department Run Triggers | ❌ Missing | No buttons in orchestrator UI to trigger department cycles |
| Skill Selector UI | ❌ Missing | No UI to assign marketing skills to agents |
| Loading States | ⚠️ Partial | Some forms lack loading indicators |
| Pagination | ❌ Missing | All list pages load full datasets |

---

## 3. WHAT IS COMPLETELY MISSING

### Lead Generation & Data Enrichment

| Capability | Need | Priority |
|-----------|------|----------|
| Real-time lead sourcing from external platforms | Leads must be manually entered | P1 |
| Company/person data enrichment | Apollo + Clay are stubbed | P1 |
| Social media listening | No integration for Twitter/X, Reddit monitoring | P2 |

### Marketing & Content

| Capability | Need | Priority |
|-----------|------|----------|
| Social media publishing (real) | Instagram, X, YouTube are stubbed | P1 |
| Email marketing campaigns | Gmail works for 1:1, no campaign/bulk tool | P2 |
| SEO analytics | No integration with Google Search Console, Ahrefs, etc. | P2 |
| Ad platform integration | Facebook Ads, Google Ads, LinkedIn Ads | P3 |

### Sales & CRM

| Capability | Need | Priority |
|-----------|------|----------|
| Advanced CRM sync | HubSpot is stubbed | P2 |
| Calendar scheduling | Calendly is stubbed | P2 |
| Payment processing | Stripe is stubbed | P3 |

### Voice & Communication

| Capability | Need | Priority |
|-----------|------|----------|
| AI voice calling | Vapi, Bland AI are stubbed | P2 |
| SMS notifications | Twilio is stubbed | P2 |
| Meeting scheduling automation | Calendly is stubbed | P2 |

### Data & Analytics

| Capability | Need | Priority |
|-----------|------|----------|
| Website analytics | No Google Analytics/Mixpanel integration | P2 |
| Social media analytics | No native analytics dashboards | P2 |
| SEO rank tracking | No external rank tracking | P3 |
| Business intelligence | No Looker/Metabase/Tableau integration | P3 |

### Development & Infrastructure

| Capability | Need | Priority |
|-----------|------|----------|
| Error tracking | No Sentry/Datadog integration | P2 |
| CI/CD integration | No GitHub Actions monitoring | P3 |
| Performance monitoring | No Vercel Analytics/dashboard | P3 |

### Missing Env Configuration

| Variable | Status | Impact |
|----------|--------|--------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ❌ Not set | Gmail integration won't work |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | ❌ Not set | LinkedIn publishing won't work |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | ❌ Not set | Facebook posting won't work |
| `CALENDLY_CLIENT_ID` / `CALENDLY_CLIENT_SECRET` | ❌ Not set | Calendly scheduling won't work |
| `CRON_SECRET` | ❌ Not set | Cron endpoint is unauthenticated |

---

## 4. GAP SUMMARY BY CATEGORY

| Category | Solved | Stubbed | Missing | Priority |
|----------|--------|---------|---------|----------|
| **AI / LLM** | 4 providers ✓ | — | — | ✅ Complete |
| **Email** | Gmail (real) | Outlook | Campaign/bulk | ⚠️ Partial |
| **Social Media** | LinkedIn (real), Facebook (real) | Instagram, X, YouTube | Social listening | ⚠️ Partial |
| **CRM** | Internal CRM | HubSpot | 2-way sync | ⚠️ Partial |
| **Lead Gen** | Internal scoring | Apollo, Clay | Real-time sourcing | ❌ Gap |
| **Voice** | — | Twilio, Vapi, Bland AI, ElevenLabs | Real calling | ❌ Gap |
| **Payment** | — | Stripe | Real processing | ❌ Gap |
| **Calendar** | — | Calendly | Real scheduling | ❌ Gap |
| **Analytics** | Internal KPIs | — | External analytics | ❌ Gap |
| **SEO / Search** | — | — | Search Console, Ahrefs | ❌ Gap |
| **Ads** | — | — | Facebook/LinkedIn/Google Ads | ❌ Gap |
| **Content** | Internal generation | — | RSS, news, trends | ❌ Gap |
| **DevOps** | — | — | Sentry, CI/CD | ❌ Gap |
