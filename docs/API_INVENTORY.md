# Inlight Agency OS — Complete API Inventory

> Last updated: 2026-06-27  
> Total APIs catalogued: **36**

---

## Status Legend

| Status | Meaning |
|--------|---------|
| ✅ **Connected** | Fully operational — keys present, real API calls made |
| 🟡 **Configured** | Code written, provider registered — but key(s) missing from `.env.local` |
| 🔴 **Key Missing** | Requires API key or OAuth credentials — none found in `.env.local` |
| ⚫ **Not Implemented** | Stub / simulated provider — returns mock data, no real HTTP calls |

---

## AI PROVIDERS

### 1. Ollama

| Field | Value |
|-------|-------|
| **Status** | ✅ Connected |
| **Provider** | ollama |
| **Key Present in `.env.local`?** | N/A (local, no key needed) |
| **OAuth?** | No |
| **Health** | 🟢 Running on `localhost:11434` |
| **Cost** | Free (local) |
| **Free Tier Limits** | Unlimited (hardware-dependent) |
| **Model** | `llama3.1` (default) |
| **Endpoint** | `http://localhost:11434/api/chat` |
| **Purpose** | Default AI execution for all agents, swarms, brain, embeddings, content factory |
| **Used By** | `lib/ai/provider.ts` (primary provider), `lib/ai/execution.ts` (fallback), `lib/brain/embeddings.ts` (embedding gen), entire agent system defaults |

---

### 2. OpenAI

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | openai |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Paid (per-token) |
| **Free Tier Limits** | None |
| **Purpose** | Chat completions via `ai_provider_configs` table (configurable model) |
| **Used By** | `lib/ai/provider.ts:89-109` (`callOpenAI`), `lib/ai/execution.ts:14` (config lookup), `lib/dev-v2/swarm-engine.ts:150` (referenced) |

---

### 3. Anthropic

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | anthropic |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Paid (per-token) |
| **Free Tier Limits** | None |
| **Purpose** | Chat completions via `ai_provider_configs` table (configurable model) |
| **Used By** | `lib/ai/provider.ts:111-142` (`callAnthropic`), `lib/ai/execution.ts:14` (config lookup) |

---

### 4. OpenRouter

| Field | Value |
|-------|-------|
| **Status** | ✅ Connected |
| **Provider** | openrouter |
| **Key Present in `.env.local`?** | ✅ Yes (`OPENROUTER_API_KEY`) |
| **OAuth?** | No |
| **Health** | 🟢 Verified (339 models, 22 free, working chat completion) |
| **Cost** | Free tier available (rate-limited) |
| **Free Tier Limits** | Rate-limited per model, no hard daily cap |
| **Model** | `cohere/north-mini-code:free` (DB config, switchable) |
| **Endpoint** | `https://openrouter.ai/api/v1/chat/completions` |
| **Purpose** | Primary AI execution for all 10 autonomous agents (replaces [Error] responses with real content) |
| **Used By** | `lib/ai/provider.ts:166-192` (`callOpenRouter` — added 2026-06-27), `lib/ai/execution.ts:14` (config lookup), all agents via `ai_provider_configs` table |
| **Setup Date** | 2026-06-27 |

---

### 5. Groq

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | groq |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Mixed (free tier available, rate-limited) |
| **Free Tier Limits** | 30 req/min, 14,400 req/day, token limits apply |
| **Purpose** | Fast inference via `ai_provider_configs` table |
| **Used By** | `lib/ai/provider.ts:144-164` (`callGroq`), `lib/ai/execution.ts:14` (config lookup) |

---

## OAUTH APIs (configured in `oauth-config.ts`)

### 6. Gmail / Google

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | Google (Gmail) |
| **Key Present in `.env.local`?** | ✅ Yes (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) |
| **OAuth?** | Yes — Google |
| **Health** | 🟢 Keys present, needs user OAuth grant |
| **Cost** | Free (15 GB storage, daily sending limits) |
| **Free Tier Limits** | 500 emails/day for Google Workspace trials, 100 recipients/day for regular accounts |
| **Library / Endpoint** | `gmail.googleapis.com` (`/gmail/v1/users/me/messages/send`) |
| **Purpose** | Email outreach, campaign sending, inbox management |
| **Used By** | `lib/integrations/oauth-config.ts:15-26` (config), `lib/integrations/providers.ts:77-131` (`GmailProvider` — real API calls) |

---

### 7. LinkedIn

| Field | Value |
|-------|-------|
| **Status** | ✅ Connected |
| **Provider** | LinkedIn |
| **Key Present in `.env.local`?** | ✅ Yes (`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`) |
| **OAuth?** | Yes — LinkedIn |
| **Health** | 🟢 Fully operational |
| **Cost** | Free |
| **Free Tier Limits** | Rate-limited by LinkedIn API (100 req/day for certain endpoints) |
| **Library / Endpoint** | `api.linkedin.com/v2` |
| **Purpose** | Social publishing — create UGC posts to LinkedIn feed |
| **Used By** | `lib/integrations/oauth-config.ts:27-34` (config), `lib/integrations/providers.ts:29-74` (`LinkedInProvider` — real API calls), `lib/content-factory/linkedin-publisher.ts`, `lib/content-factory/publishing.ts` |

---

### 8. Facebook

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | Facebook (Graph API) |
| **Key Present in `.env.local`?** | ✅ Yes (`FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`) |
| **OAuth?** | Yes — Facebook |
| **Health** | 🟢 Keys present, needs user OAuth + page token |
| **Cost** | Free |
| **Free Tier Limits** | Standard Graph API rate limits |
| **Library / Endpoint** | `graph.facebook.com/v22.0` |
| **Purpose** | Social publishing — feed posts, photos, videos, carousels, reels, stories, page insights |
| **Used By** | `lib/integrations/oauth-config.ts:43-50` (config), `lib/integrations/social-providers.ts:82-243` (`FacebookProvider` — real API calls), `lib/content-factory/publishing.ts` |

---

### 9. Instagram

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | Facebook (Graph API — Instagram Business Account) |
| **Key Present in `.env.local`?** | ✅ Uses `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` |
| **OAuth?** | Yes — Facebook (IG Business Account via Facebook page) |
| **Health** | 🟡 Dependent on Facebook page + IG Business Account setup |
| **Cost** | Free |
| **Free Tier Limits** | Standard Graph API rate limits |
| **Library / Endpoint** | `graph.facebook.com/v22.0` (via IG Business Account) |
| **Purpose** | Social publishing — images, videos, reels, stories, carousels, insights |
| **Used By** | `lib/integrations/oauth-config.ts:51-58` (config), `lib/integrations/social-providers.ts:247-442` (`InstagramProvider` — real API calls), `lib/content-factory/publishing.ts` |

---

### 10. YouTube

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | Google (YouTube Data API v3) |
| **Key Present in `.env.local`?** | ✅ Uses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| **OAuth?** | Yes — Google (YouTube scopes) |
| **Health** | 🟢 Keys present, needs user OAuth grant |
| **Cost** | Free (quota-based) |
| **Free Tier Limits** | 10,000 quota units/day |
| **Library / Endpoint** | `youtube.googleapis.com` (`/upload/youtube/v3/videos`, `/youtube/v3/videos`) |
| **Purpose** | Video publishing — upload, metadata update, thumbnails, analytics |
| **Used By** | `lib/integrations/oauth-config.ts:59-71` (config), `lib/integrations/social-providers.ts:456-602` (`YouTubeProvider` — real API calls), `lib/video/engine.ts`, `lib/content-factory/publishing.ts` |

---

### 11. Calendly

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | Calendly |
| **Key Present in `.env.local`?** | ❌ No (`CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET` missing) |
| **OAuth?** | Yes — Calendly |
| **Health** | 🔴 Non-functional (no credentials) |
| **Cost** | Mixed (free tier exists) |
| **Free Tier Limits** | 1 event type, basic availability |
| **Library / Endpoint** | `api.calendly.com` |
| **Purpose** | Scheduling — create/cancel events, manage availability, event types |
| **Used By** | `lib/integrations/oauth-config.ts:35-42` (config), `lib/integrations/automation-providers.ts:220-295` (`CalendlyProvider` — real API calls), `lib/integrations/providers.ts:178` (registered) |

---

### 12. Salesforce

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | Salesforce |
| **Key Present in `.env.local`?** | ❌ No (`SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` missing) |
| **OAuth?** | Yes — Salesforce (OAuth 2.0 + client credentials) |
| **Health** | 🔴 Non-functional (no credentials) |
| **Cost** | Paid |
| **Free Tier Limits** | None (Developer Edition available with limits) |
| **Library / Endpoint** | `login.salesforce.com` / `yourInstance.salesforce.com` (REST API v60.0) |
| **Purpose** | CRM sync — leads, contacts, opportunities, SOQL queries |
| **Used By** | `lib/integrations/oauth-config.ts:72-80` (config), `lib/integrations/automation-providers.ts:298-445` (`SalesforceProvider` — real API calls), `lib/integrations/providers.ts:178` (registered) |

---

## API KEY PROVIDERS (configured in `automation-providers.ts`)

### 13. Stripe

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | Stripe |
| **Key Present in `.env.local`?** | ❌ No (`STRIPE_API_KEY` missing) |
| **OAuth?** | No (API key) |
| **Health** | 🔴 Non-functional (no key) |
| **Cost** | Free (pay per transaction: 2.9% + $0.30) |
| **Free Tier Limits** | No monthly fee |
| **Library / Endpoint** | `api.stripe.com/v1` |
| **Purpose** | Payment processing — payment intents, invoices, customers, balance |
| **Used By** | `lib/integrations/automation-providers.ts:8-92` (`StripeProvider` — real API calls), `lib/integrations/providers.ts:181` (registered) |

---

### 14. HubSpot

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | HubSpot |
| **Key Present in `.env.local`?** | ❌ No (`HUBSPOT_API_KEY` missing) |
| **OAuth?** | No (API key / access token) |
| **Health** | 🔴 Non-functional (no key) |
| **Cost** | Mixed (free tier exists) |
| **Free Tier Limits** | 1,000 contacts, 5 users, basic CRM features |
| **Library / Endpoint** | `api.hubapi.com` (`/crm/v3/objects`) |
| **Purpose** | CRM — contact management, deal tracking, sync |
| **Used By** | `lib/integrations/automation-providers.ts:95-217` (`HubSpotProvider` — real API calls), `lib/integrations/providers.ts:178` (registered) |

---

### 15. Slack

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | Slack |
| **Key Present in `.env.local`?** | ❌ No (`SLACK_BOT_TOKEN` missing) |
| **OAuth?** | No (bot token) |
| **Health** | 🔴 Non-functional (no token) |
| **Cost** | Free |
| **Free Tier Limits** | 10,000 messages, 5 GB storage, 10 apps |
| **Library / Endpoint** | `slack.com/api` |
| **Purpose** | Messaging — send messages, manage channels, file uploads, reactions |
| **Used By** | `lib/integrations/automation-providers.ts:448-545` (`SlackProvider` — real API calls), `lib/integrations/providers.ts:171` (registered) |

---

### 16. Discord

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | Discord |
| **Key Present in `.env.local`?** | ❌ No (`DISCORD_BOT_TOKEN` missing) |
| **OAuth?** | No (bot token) |
| **Health** | 🔴 Non-functional (no token) |
| **Cost** | Free |
| **Free Tier Limits** | Standard Discord bot limits |
| **Library / Endpoint** | `discord.com/api/v10` |
| **Purpose** | Messaging — send messages, manage channels, roles, guild info |
| **Used By** | `lib/integrations/automation-providers.ts:548-670` (`DiscordProvider` — real API calls), `lib/integrations/providers.ts:172` (registered) |

---

### 17. Telegram

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | Telegram |
| **Key Present in `.env.local`?** | ❌ No (`TELEGRAM_BOT_TOKEN` missing) |
| **OAuth?** | No (bot token) |
| **Health** | 🔴 Non-functional (no token) |
| **Cost** | Free |
| **Free Tier Limits** | Unlimited messaging, 2 GB file storage per bot |
| **Library / Endpoint** | `api.telegram.org/bot{token}/` |
| **Purpose** | Messaging — send messages, photos, documents, manage webhooks |
| **Used By** | `lib/integrations/automation-providers.ts:673-773` (`TelegramProvider` — real API calls), `lib/integrations/providers.ts:172` (registered) |

---

### 18. Airtable

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | Airtable |
| **Key Present in `.env.local`?** | ❌ No (`AIRTABLE_API_KEY` missing) |
| **OAuth?** | No (API key / personal access token) |
| **Health** | 🔴 Non-functional (no key) |
| **Cost** | Mixed (free tier exists) |
| **Free Tier Limits** | 1,200 records/base, 2 GB attachments/base, 2-week revision history |
| **Library / Endpoint** | `api.airtable.com/v0` |
| **Purpose** | Database — CRUD records, list bases/tables, meta operations |
| **Used By** | `lib/integrations/automation-providers.ts:776-885` (`AirtableProvider` — real API calls), `lib/integrations/providers.ts:183` (registered) |

---

### 19. n8n

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | n8n |
| **Key Present in `.env.local`?** | ❌ No (`N8N_API_KEY`, `N8N_BASE_URL` missing) |
| **OAuth?** | No (API key) |
| **Health** | 🔴 Non-functional (no key) |
| **Cost** | Free (self-hosted) |
| **Free Tier Limits** | Unlimited (self-hosted), 2,000 executions/mo (n8n cloud) |
| **Library / Endpoint** | `{base_url}/api/v1` |
| **Purpose** | Workflow automation — trigger, create webhooks, manage workflows |
| **Used By** | `lib/integrations/automation-providers.ts:888-1020` (`N8nProvider` — real API calls), `lib/integrations/providers.ts:197` (registered) |

---

### 20. Make (formerly Integromat)

| Field | Value |
|-------|-------|
| **Status** | 🔴 Key Missing |
| **Provider** | Make |
| **Key Present in `.env.local`?** | ❌ No (`MAKE_API_KEY`, `MAKE_BASE_URL` missing) |
| **OAuth?** | No (API key) |
| **Health** | 🔴 Non-functional (no key) |
| **Cost** | Mixed (free tier exists) |
| **Free Tier Limits** | 1,000 ops/month, 2 scenarios, 15 min schedule |
| **Library / Endpoint** | `eu1.make.com/api/v2` / `hook.eu1.make.com` |
| **Purpose** | Scenario automation — trigger scenarios, send webhooks, manage scenarios |
| **Used By** | `lib/integrations/automation-providers.ts:1023-1131` (`MakeProvider` — real API calls), `lib/integrations/providers.ts:197` (registered) |

---

## CONTENT APIS

### 21. Unsplash

| Field | Value |
|-------|-------|
| **Status** | ✅ Connected |
| **Provider** | Unsplash |
| **Key Present in `.env.local`?** | ✅ Yes (`UNSPLASH_ACCESS_KEY`) |
| **OAuth?** | No (API key) |
| **Health** | 🟢 Fully operational |
| **Cost** | Free |
| **Free Tier Limits** | 50 requests/hour |
| **Library / Endpoint** | `api.unsplash.com` (`/search/photos`) |
| **Purpose** | Stock photography for content factory |
| **Used By** | `lib/integrations/image-sources.ts:26-66` (`searchUnsplash`), `lib/integrations/image-sources.ts:72-99` (`getUnsplashPhotosForTopic`), `lib/content-factory/image.ts` |

---

### 22. Pexels

| Field | Value |
|-------|-------|
| **Status** | ✅ Connected |
| **Provider** | Pexels |
| **Key Present in `.env.local`?** | ✅ Yes (`PEXELS_API_KEY`) |
| **OAuth?** | No (API key) |
| **Health** | 🟢 Fully operational |
| **Cost** | Free |
| **Free Tier Limits** | 200 requests/hour, 16,000 requests/month |
| **Library / Endpoint** | `api.pexels.com/v1` (`/search`) |
| **Purpose** | Stock photography for content factory |
| **Used By** | `lib/integrations/image-sources.ts:110-149` (`searchPexels`), `lib/integrations/image-sources.ts:154-179` (`getPexelsPhotosForTopic`), `lib/content-factory/image.ts` |

---

### 23. NewsAPI

| Field | Value |
|-------|-------|
| **Status** | ✅ Connected |
| **Provider** | NewsAPI.org |
| **Key Present in `.env.local`?** | ✅ Yes (`NEWSAPI_API_KEY`) |
| **OAuth?** | No (API key) |
| **Health** | 🟢 Fully operational |
| **Cost** | Free |
| **Free Tier Limits** | 100 requests/day, 7-day article history |
| **Library / Endpoint** | `newsapi.org/v2` (`/top-headlines`, `/everything`) |
| **Purpose** | Market research, content ideation, competitive intelligence |
| **Used By** | `lib/integrations/news-sources.ts:27-65` (`fetchNewsHeadlines`), `lib/integrations/news-sources.ts:70-104` (`searchNews`), `lib/integrations/news-sources.ts:110-135` (`fetchMultiCategoryNews`), `lib/integrations/news-sources.ts:141-163` (`getNewsForContentResearch`), `lib/content-factory/idea-generator.ts` |

---

## SIMULATED / STUB PROVIDERS

### 24. Twilio

| Field | Value |
|-------|-------|
| **Status** | ⚫ Not Implemented (simulated) |
| **Provider** | Twilio |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Returns mock data only |
| **Cost** | Paid ($0.0145/min voice, $0.0079/SMS) |
| **Free Tier Limits** | None |
| **Purpose** | Voice calling and SMS (simulated) |
| **Used By** | `lib/integrations/providers.ts:18-27` (`TwilioProvider` — stub), `lib/voice/engine.ts` (references), `lib/validation/voice-validator.ts` (validation) |

---

### 25. Vapi

| Field | Value |
|-------|-------|
| **Status** | ⚫ Not Implemented (simulated) |
| **Provider** | Vapi |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Returns mock data only |
| **Cost** | Paid ($0.05/min for voice AI) |
| **Free Tier Limits** | None |
| **Purpose** | Voice AI agents (simulated) |
| **Used By** | `lib/integrations/providers.ts:134-143` (`VapiProvider` — stub), `lib/validation/voice-validator.ts` (validation) |

---

### 26. BlandAI

| Field | Value |
|-------|-------|
| **Status** | ⚫ Not Implemented (simulated) |
| **Provider** | Bland AI |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Returns mock data only |
| **Cost** | Paid |
| **Free Tier Limits** | None |
| **Purpose** | Voice AI calling (simulated) |
| **Used By** | `lib/integrations/providers.ts:146-154` (`BlandAIProvider` — stub), `lib/validation/voice-validator.ts` (validation) |

---

### 27. Apollo

| Field | Value |
|-------|-------|
| **Status** | ⚫ Not Implemented (simulated) |
| **Provider** | Apollo.io |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Returns mock data only |
| **Cost** | Paid |
| **Free Tier Limits** | None (free tier removed) |
| **Purpose** | Lead enrichment, company data (simulated) |
| **Used By** | `lib/integrations/providers.ts:157-165` (`ApolloProvider` — stub), `lib/outreach/engine.ts` (references `apollo` in skills), `lib/growth/execution.ts:207` (simulated `executeAction('apollo', ...)`) |

---

### 28. X / Twitter

| Field | Value |
|-------|-------|
| **Status** | ⚫ Not Implemented (stub) |
| **Provider** | X (Twitter) |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | Yes — X API (OAuth 1.0a / 2.0) |
| **Health** | ⚫ Returns mock data only |
| **Cost** | Mixed (basic tier free, pro tier $100/mo) |
| **Free Tier Limits** | 1,500 tweets/mo (basic tier), 3,000 RPM |
| **Purpose** | Social publishing — post tweets, get insights (stub) |
| **Used By** | `lib/integrations/social-providers.ts:445-453` (`XProvider` — stub), `lib/integrations/providers.ts:176` (registered) |

---

### 29. Outlook

| Field | Value |
|-------|-------|
| **Status** | ⚫ Not Implemented (stub) |
| **Provider** | Microsoft (Outlook / Exchange) |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | Yes — Microsoft Graph |
| **Health** | ⚫ Returns mock data only |
| **Cost** | Free |
| **Free Tier Limits** | N/A (tied to Microsoft account) |
| **Purpose** | Email — send, list, draft (stub) |
| **Used By** | `lib/integrations/social-providers.ts:605-614` (`OutlookProvider` — stub), `lib/integrations/providers.ts:171` (registered) |

---

### 30. Clay

| Field | Value |
|-------|-------|
| **Status** | ⚫ Not Implemented (stub) |
| **Provider** | Clay.com |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Returns mock data only |
| **Cost** | Paid |
| **Free Tier Limits** | None (no free tier) |
| **Purpose** | Lead enrichment — company/person data (stub) |
| **Used By** | `lib/integrations/social-providers.ts:617-625` (`ClayProvider` — stub), `lib/outreach/engine.ts` (references `clay` in skills), `lib/integrations/providers.ts:179` (registered) |

---

## VIDEO GENERATION APIS

### 31. ElevenLabs

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | ElevenLabs |
| **Key Present in `.env.local`?** | ❌ No (`ELEVENLABS_API_KEY` missing) |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Mixed (free tier exists) |
| **Free Tier Limits** | 10,000 characters/month, 3 voice clones |
| **Library / Endpoint** | `api.elevenlabs.io/v1` |
| **Purpose** | Voice generation — TTS, voice cloning, dubbing, sound effects, streaming |
| **Used By** | `lib/integrations/voice-providers.ts:20-467` (`ElevenLabsProvider` — 20+ actions), `lib/video/rendering-queue.ts:62` (voiceover rendering), `lib/video/engine.ts:157` (voiceover enqueue), `lib/voice/engine.ts:97`, `lib/validation/ai-validator.ts`, `lib/validation/voice-validator.ts` |

---

### 32. Runway

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | Runway ML |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Mixed (free tier exists) |
| **Free Tier Limits** | 25 generations/month (Gen 3) |
| **Library / Endpoint** | `api.runwayml.com/v1` |
| **Purpose** | Video generation — text-to-video, status polling |
| **Used By** | `lib/integrations/video-providers.ts:3-43` (`RunwayProvider`), `lib/video/rendering-queue.ts:73` (registered), `lib/integrations/providers.ts:187` (registered) |

---

### 33. Pika

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | Pika Labs |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Mixed (free tier exists) |
| **Free Tier Limits** | 30 generations/month (free tier) |
| **Library / Endpoint** | `api.pika.art/v1` |
| **Purpose** | Video generation — text-to-video, status polling |
| **Used By** | `lib/integrations/video-providers.ts:83-120` (`PikaProvider`), `lib/video/rendering-queue.ts:75` (registered), `lib/integrations/providers.ts:187` (registered) |

---

### 34. Kling

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | Kling AI (Kuaishou) |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Paid (credit-based) |
| **Free Tier Limits** | None |
| **Library / Endpoint** | `api.klingai.com/v1` |
| **Purpose** | Video generation — text-to-video, status polling |
| **Used By** | `lib/integrations/video-providers.ts:122-158` (`KlingProvider`), `lib/video/rendering-queue.ts:76` (registered), `lib/integrations/providers.ts:187` (registered) |

---

### 35. Veo

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | Google Veo (via Gemini API) |
| **Key Present in `.env.local`?** | ❌ No |
| **OAuth?** | No (API key via Google AI Studio) |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Free (Google AI Studio) |
| **Free Tier Limits** | Limited free requests (rate-limited) |
| **Library / Endpoint** | `generativelanguage.googleapis.com/v1beta/models/veo:generateVideo` |
| **Purpose** | Video generation — text-to-video, status polling |
| **Used By** | `lib/integrations/video-providers.ts:45-81` (`VeoProvider`), `lib/video/rendering-queue.ts:74` (registered), `lib/integrations/providers.ts:187` (registered) |

---

### 36. Whisper (OpenAI)

| Field | Value |
|-------|-------|
| **Status** | 🟡 Configured |
| **Provider** | OpenAI Whisper (via OpenAI API) |
| **Key Present in `.env.local`?** | ❌ No (requires `OPENAI_API_KEY`) |
| **OAuth?** | No (API key) |
| **Health** | ⚫ Untested (no key) |
| **Cost** | Free (local via `whisper.cpp`) / Paid ($0.006/min via OpenAI API) |
| **Free Tier Limits** | Unlimited (self-hosted local) |
| **Library / Endpoint** | `api.openai.com/v1/audio/transcriptions` / `api.openai.com/v1/audio/translations` |
| **Purpose** | Speech-to-text — transcription, translation, diarization, local inference |
| **Used By** | `lib/integrations/voice-providers.ts:491-777` (`WhisperProvider` — 10+ actions), `lib/integrations/providers.ts:186` (registered) |

---

## SUMMARY TABLE

| Status | Count | APIs |
|--------|-------|------|
| ✅ **Connected** (keys present) | **6** | Ollama, LinkedIn, Unsplash, Pexels, NewsAPI, Gmail/Google |
| 🟡 **Configured** (no keys in `.env.local`) | **14** | OpenAI, Anthropic, Groq, Facebook, Instagram, YouTube, ElevenLabs, Runway, Pika, Kling, Veo, Whisper, Stripe (via config), Calendly (OAuth exists) |
| 🔴 **Key Missing** (keys absent from `.env.local`) | **8** | Calendly OAuth, Salesforce, Stripe, HubSpot, Slack, Discord, Telegram, Airtable, n8n, Make |
| ⚫ **Not Implemented** (stub / simulated) | **7** | Twilio, Vapi, BlandAI, Apollo, X/Twitter, Outlook, Clay |

## LEGACY / UNUSED API KEYS

- **Calendly** — OAuth config exists in `oauth-config.ts` (`CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`) but both keys are **missing** from `.env.local`.
- **Salesforce** — OAuth config exists in `oauth-config.ts` (`SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`) but both keys are **missing** from `.env.local`.
- **All automation providers** (Stripe, HubSpot, Slack, Discord, Telegram, Airtable, n8n, Make) — full provider implementations exist in `automation-providers.ts` with real API calls but **every single one** is missing its required API key in `.env.local`.

## NOTES

- **Environment file**: `.env.local` contains 14 key-value pairs. Only **6 external APIs** have all required keys.
- **OAuth note**: Gmail, LinkedIn, Facebook, Instagram, YouTube all have their OAuth client credentials present. They become fully operational once a user completes the OAuth grant flow.
- **Simulated providers**: Twilio, Vapi, BlandAI, Apollo, X, Outlook, and Clay do NOT make real HTTP calls — they return placeholder/mock data and need provider-specific implementation work to become functional.
- **Video / voice providers**: ElevenLabs, Runway, Pika, Kling, Veo, and Whisper all have real API call implementations but are gated behind API keys that are not yet in `.env.local`.
