# EXTERNAL DEPENDENCIES PLAN — Inlight Agency OS

**Generated**: 2026-06-16
**Source**: [keploy/public-apis-collection](https://github.com/keploy/public-apis-collection)
**Scope**: Only APIs useful for Inlight Agency OS. Irrelevant categories (animals, anime, games, jokes, sports) excluded.

**Inlight OS Context**: Next.js 14 monolith, Supabase PostgreSQL + pgvector, 4 AI providers (Ollama/OpenAI/Anthropic/Groq), existing OAuth for LinkedIn/Gmail/Facebook, 15 stub providers.

---

## SCORING LEGEND

Each API is scored 1-5 (worst-best) on:

| Criteria | What It Measures |
|----------|-----------------|
| **Free Tier** | Generosity of free usage without paying |
| **Reliability** | Uptime, maturity, SLA quality |
| **Documentation** | Clarity, examples, SDK quality |
| **Commercial Use** | License terms for agency/client work |
| **Integration** | Ease of OAuth/API key setup, SDK availability |

**Overall** = Average of all 5 scores.

### PRIORITY LEVELS

| Level | Meaning | Action |
|-------|---------|--------|
| **P1** | Must Integrate Now | Critical gap. Blocks core workflows. |
| **P2** | Integrate Later | Important but not blocking. Add in next sprint. |
| **P3** | Optional | Nice-to-have. Add when capacity allows. |
| **P4** | Ignore | Not relevant for agency operations. |

---

## 1. AI / LLM

Inlight already has 4 AI providers. These are supplementary or specialized.

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Hugging Face Inference** | ✅ 30K tokens/mo | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P3 | Already have 4 LLM providers. HF useful for specialized models (classification, embedding alternatives) but not urgent. |
| **Together AI** | ✅ $1 free credit | 4/5 | 4/5 | 5/5 | 4/5 | **4.4** | P3 | Open-source model hosting. Redundant with existing providers. |
| **OpenRouter** | ✅ Free tier | 4/5 | 5/5 | 5/5 | 5/5 | **4.8** | P2 | Single endpoint to 100+ models. Useful for benchmarking and fallback. Easy to integrate. |
| **Mistral AI** | ✅ Free API | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P3 | Another LLM provider. Low priority since we have coverage. |
| **Cohere** | ✅ 100 calls/min | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P3 | RAG, embeddings, classification. We already use pgvector + Ollama embeddings. |
| **DeepAI** | ✅ Free tier | 3/5 | 4/5 | 4/5 | 5/5 | **4.0** | P3 | General AI APIs. Redundant. |

### AI / LLM Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| OpenRouter | 4.8 | P2 — Add as model fallback/benchmark hub |
| Hugging Face | 4.6 | P3 — Add for specialized classification models |
| Mistral AI | 4.6 | P3 — Already covered by existing providers |
| Together AI | 4.4 | P4 — Redundant |
| Cohere | 4.6 | P4 — Redundant with pgvector + Ollama |
| DeepAI | 4.0 | P4 — Not needed |

---

## 2. IMAGE GENERATION

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Stability AI** | ✅ Free credits | 4/5 | 5/5 | 4/5 | 4/5 | **4.4** | P2 | Stable Diffusion for content creation. Useful for social media visuals, blog images. |
| **Unsplash** | ✅ 50 req/hr | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P1 | Free stock photos for blog posts, social media. Essential for content factory. |
| **Pexels** | ✅ 200 req/hr | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P1 | Free stock photos and videos. Alternative to Unsplash. |
| **Pixabay** | ✅ 500 req/day | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P2 | Free images/vectors/videos. Backup to Unsplash/Pexels. |
| **Cloudinary** | ✅ 25GB storage | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P1 | Image optimization, CDN, transformations. Critical for agency client websites. |
| **Lorem Picsum** | ✅ Unlimited | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P3 | Placeholder images for mockups. Nice-to-have. |
| **OCR.space** | ✅ 500/mo free | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P3 | OCR for invoices/documents. Useful for finance automation. |

### Image Generation Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| **Unsplash** | 5.0 | **P1** — Must integrate for content factory visuals |
| **Cloudinary** | 4.8 | **P1** — Must integrate for media management |
| **Pexels** | 5.0 | **P1** — Must integrate for stock video/photos |
| **Stability AI** | 4.4 | **P2** — Add for AI-generated visuals |
| Pixabay | 4.6 | P3 — Redundant with Unsplash+Pexels |
| Lorem Picsum | 4.6 | P3 — Nice-to-have for dev |
| OCR.space | 4.6 | P3 — Finance automation |

---

## 3. VIDEO GENERATION

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **YouTube Data API** | ✅ 10K units/day | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Already stubbed. Make real for reels/video publishing. |
| **Vimeo** | ✅ Free tier | 4/5 | 4/5 | 5/5 | 4/5 | **4.4** | P3 | Alternative to YouTube. Low priority. |
| **Daily.co** | ✅ 10K min/mo | 4/5 | 5/5 | 4/5 | 4/5 | **4.4** | P3 | Video calling API. Not needed for agency OS. |

### Video Generation Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| YouTube Data API | 4.8 | P2 — Upgrade stub to real integration |
| Vimeo | 4.4 | P4 — Not needed |
| Daily.co | 4.4 | P4 — Not needed |

---

## 4. VOICE GENERATION

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **ElevenLabs** | ✅ 10K chars/mo | 4/5 | 5/5 | 4/5 | 4/5 | **4.4** | P2 | Already in registry (stubbed). Real integration for voiceovers/narration. |
| **Deepgram** | ✅ $200 free credit | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P3 | Speech-to-text. Useful for call transcription but not urgent. |
| **AssemblyAI** | ✅ Free tier | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P3 | Audio intelligence. Same as Deepgram. |
| **Twilio** | ✅ Free credits | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Already in registry (stubbed). Real SMS/voice for outreach. |

### Voice Generation Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| **Twilio** | 4.8 | **P2** — Upgrade stub to real for SMS/call outreach |
| **ElevenLabs** | 4.4 | **P2** — Upgrade stub for voice content |
| Deepgram | 4.6 | P3 — Add for transcription |
| AssemblyAI | 4.6 | P3 — Add for audio analysis |

---

## 5. SOCIAL MEDIA

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **LinkedIn** | ✅ 100 posts/user | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | ✅ Integrated | Already real. OAuth + UGC posts working. |
| **Facebook** | ✅ Free tier | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | ✅ Integrated | Already real. Graph API v22.0 working. |
| **Instagram (Graph)** | ✅ Free tier | 4/5 | 4/5 | 4/5 | 4/5 | **4.0** | P2 | Upgrade stub. Instagram publishing for content factory. |
| **X / Twitter API v2** | ✅ Free tier (1,500 tweets/mo) | 4/5 | 4/5 | 4/5 | 3/5 | **3.8** | P3 | Replace stub. Low priority for agency ops. |
| **Reddit** | ✅ Free | 4/5 | 4/5 | 5/5 | 3/5 | **4.0** | P2 | Social listening, lead gen, content research. |
| **BlueSky** | ✅ Free | 3/5 | 4/5 | 5/5 | 3/5 | **3.6** | P4 | Too small. Ignore. |
| **Discord** | ✅ Free | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P3 | Community management. Not core to agency OS. |
| **Slack** | ✅ Free tier | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Internal notifications, approval alerts, agent messaging. |

### Social Media Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| **LinkedIn** | 4.8 | ✅ **Already integrated** |
| **Facebook** | 4.8 | ✅ **Already integrated** |
| **Instagram** | 4.0 | **P2** — Upgrade stub for content factory |
| **Reddit** | 4.0 | **P2** — Social listening + lead gen |
| **Slack** | 4.8 | **P2** — Internal notifications |
| X / Twitter | 3.8 | P3 — Upgrade stub |
| Discord | 4.8 | P3 — Community |
| BlueSky | 3.6 | P4 — Ignore |

---

## 6. EMAIL

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Gmail** | ✅ Free | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | ✅ Integrated | Already real. Sending + listing working. |
| **SendGrid** | ✅ 100 emails/day | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P1 | Transactional emails, newsletters, campaigns. Missing capability. |
| **Mailgun** | ✅ 5K emails/mo | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P2 | Alternative to SendGrid for email delivery. |
| **Mailjet** | ✅ 6K emails/mo | 4/5 | 4/5 | 5/5 | 4/5 | **4.4** | P3 | Email campaigns. Lower priority. |
| **Brevo (Sendinblue)** | ✅ 300 emails/day | 4/5 | 4/5 | 5/5 | 4/5 | **4.4** | P3 | Email + SMS. Lower priority. |
| **Outlook** | ✅ Free tier | 4/5 | 4/5 | 5/5 | 4/5 | **4.4** | P3 | Upgrade stub. Microsoft email. |
| **EmailJS** | ✅ 200/mo free | 3/5 | 4/5 | 4/5 | 5/5 | **4.0** | P4 | Client-side only. Not needed. |
| **Instantly** | ❌ Paid | 3/5 | 3/5 | 4/5 | 4/5 | **3.4** | P3 | Already in registry. Email warmup. |
| **Smartlead** | ❌ Paid | 3/5 | 3/5 | 4/5 | 4/5 | **3.4** | P3 | Already in registry. Multi-channel outreach. |

### Email Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| **Gmail** | 4.8 | ✅ **Already integrated** |
| **SendGrid** | 5.0 | **P1** — Missing capability for campaigns/newsletters |
| Mailgun | 5.0 | P2 — Backend email delivery |
| Instantly | 3.4 | P3 — Upgrade stub for email warmup |
| Smartlead | 3.4 | P3 — Upgrade stub for outreach |
| Outlook | 4.4 | P4 — Low demand |
| Brevo | 4.4 | P4 — Redundant with SendGrid |
| Mailjet | 4.4 | P4 — Redundant |
| EmailJS | 4.0 | P4 — Not needed |

---

## 7. SEARCH

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Algolia** | ✅ 10K records, 10K searches/mo | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Instant search for dashboard data. Better than raw SQL for list pages. |
| **Google Custom Search** | ✅ 100 queries/day | 5/5 | 5/5 | 4/5 | 4/5 | **4.6** | P2 | Programmatic web search for market research, competitive intel. |
| **SerpAPI** | ✅ 100 queries/mo | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P3 | Search engine results API. Useful but paid. |
| **SearchAPI.io** | ✅ 100 queries/mo | 3/5 | 4/5 | 5/5 | 4/5 | **4.0** | P3 | Google scraping. Useful for SEO tools. |

### Search Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| **Algolia** | 4.8 | **P2** — Search for dashboard UX |
| **Google Custom Search** | 4.6 | **P2** — Market research / competitive intel |
| SerpAPI | 4.6 | P3 — SEO tooling |
| SearchAPI.io | 4.0 | P3 — SEO tooling |

---

## 8. LEAD GENERATION

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Apollo** | ✅ 10 credits/day | 4/5 | 4/5 | 4/5 | 4/5 | **4.0** | P2 | Already in registry (stubbed). Real integration for lead enrichment. |
| **Clay** | ✅ 30 credits/mo | 3/5 | 4/5 | 4/5 | 4/5 | **3.8** | P2 | Already in registry (stubbed). Data enrichment + multi-source. |
| **Clearbit (via API)** | ✅ Limited free | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P2 | Company/person enrichment. Strong fit for lead scoring. |
| **Reddit API** | ✅ Free | 4/5 | 4/5 | 5/5 | 3/5 | **4.0** | P2 | Lead sourcing via subreddit monitoring. |
| **SearchAPI.io** | ✅ 100 queries/mo | 3/5 | 4/5 | 5/5 | 4/5 | **4.0** | P3 | Web scraping for lead research. |
| **IPinfo** | ✅ 50K req/mo | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P3 | IP → company for anonymous web traffic. Good for lead detection. |

### Lead Generation Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| **Apollo** | 4.0 | **P2** — Upgrade stub for lead enrichment |
| **Clay** | 3.8 | **P2** — Upgrade stub for multi-source enrichment |
| **Clearbit** | 4.6 | **P2** — Add for company/person data |
| **Reddit** | 4.0 | **P2** — Lead sourcing + social listening |
| IPinfo | 5.0 | P3 — Anonymous traffic lead detection |

---

## 9. CRM

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **HubSpot** | ✅ Free CRM | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Already in registry (stubbed). Real integration for 2-way CRM sync. |
| **Airtable** | ✅ 1K records/base | 4/5 | 5/5 | 5/5 | 5/5 | **4.8** | P3 | Useful as flexible data store for client projects. |
| **Notion** | ✅ Free tier | 4/5 | 5/5 | 5/5 | 3/5 | **4.4** | P3 | Client documentation, project wikis. |

### CRM Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| HubSpot | 4.8 | P2 — Upgrade stub for 2-way CRM sync |
| Airtable | 4.8 | P3 — Client project data |
| Notion | 4.4 | P3 — Client documentation |

---

## 10. MARKETING

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **SendGrid** | ✅ 100 emails/day | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P1 | Email campaigns, newsletters, drip sequences. |
| **Facebook Ads** | ❌ Paid | 4/5 | 5/5 | 4/5 | 3/5 | **4.0** | P3 | Ad management. Paid-only. |
| **LinkedIn Ads** | ❌ Paid | 4/5 | 4/5 | 4/5 | 3/5 | **3.8** | P3 | LinkedIn advertising. Paid-only. |
| **Google Trends** | ✅ Free | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P1 | Trend data for content strategy, keyword research. |
| **News API** | ✅ 100 req/day | 4/5 | 5/5 | 5/5 | 5/5 | **4.8** | P1 | News monitoring, content research, competitive intel. |
| **Guardian API** | ✅ Free | 4/5 | 5/5 | 5/5 | 5/5 | **4.8** | P3 | News content. Alternative to News API. |
| **GNews** | ✅ 100 req/day | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P3 | News aggregation. Lower priority. |

### Marketing Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| **SendGrid** | 5.0 | **P1** — Email campaigns (missing) |
| **Google Trends** | 4.6 | **P1** — Content strategy + research |
| **News API** | 4.8 | **P1** — News monitoring + competitive intel |
| Google Guardian | 4.8 | P3 — Alternative news source |
| GNews | 4.6 | P3 — Alternative news |
| Facebook Ads | 4.0 | P4 — Paid only |
| LinkedIn Ads | 3.8 | P4 — Paid only |

---

## 11. AUTOMATION

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Calendly** | ✅ Free tier | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Already configured (OAuth). Real integration for meeting scheduling. |
| **Zapier** | ✅ 100 tasks/mo | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P3 | 5K+ app integration. Useful but Zapier is for non-technical users. |
| **GitHub API** | ✅ Free | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Automate repo management, code reviews, CI/CD for agency dev work. |
| **Slack** | ✅ Free | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Agent notifications, approval alerts, internal comms. |
| **Uptime Robot** | ✅ 50 monitors | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P2 | Client website monitoring. Essential for agency. |
| **Sentry** | ✅ 5K events/mo | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Error tracking for client projects. |

### Automation Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| **Calendly** | 4.8 | **P2** — Real integration for scheduling |
| **GitHub API** | 4.8 | **P2** — Agency dev workflow automation |
| **Slack** | 4.8 | **P2** — Agent notifications + approvals |
| **Uptime Robot** | 5.0 | **P2** — Client website monitoring |
| **Sentry** | 4.8 | **P2** — Error tracking |
| Zapier | 4.8 | P3 — Non-technical integrations |

---

## 12. ANALYTICS

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Google Analytics** | ✅ Free | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Client website analytics built-in. |
| **OpenWeatherMap** | ✅ 1K calls/day | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P3 | Weather data for location-based analytics. Niche. |
| **ExchangeRate API** | ✅ Free | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P3 | Currency conversion for finance module. |
| **IPinfo** | ✅ 50K/mo | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P3 | IP analytics. Lead geo-detection. |
| **Mapbox** | ✅ 50K tile loads/mo | 5/5 | 5/5 | 4/5 | 3/5 | **4.4** | P3 | Client location maps. |
| **World Bank Data** | ✅ Unlimited | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P4 | General economic data. Not directly useful. |

### Analytics Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| Google Analytics | 4.8 | P2 — Client website analytics |
| ExchangeRate API | 4.6 | P3 — Finance module |
| IPinfo | 5.0 | P3 — Lead geo-detection |
| Mapbox | 4.4 | P3 — Client location features |
| OpenWeatherMap | 5.0 | P4 — Not needed |
| World Bank | 4.6 | P4 — Not needed |

---

## 13. INFRASTRUCTURE & DEVOPS

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Vercel API** | ✅ Hobby tier | 5/5 | 5/5 | 5/5 | 5/5 | **5.0** | P2 | Deploy management, domain config, env management. |
| **GitHub API** | ✅ Free | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Repo management, CI/CD, code review automation. |
| **Sentry** | ✅ 5K events/mo | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Error tracking for production. |
| **Stripe** | ✅ Free (per-transaction) | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P2 | Already in registry (stubbed). Real payment processing. |
| **MongoDB Atlas** | ✅ 512MB free | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P4 | Already using Supabase PostgreSQL. No need. |
| **Neon** | ✅ Free tier | 4/5 | 4/5 | 5/5 | 4/5 | **4.4** | P4 | Already using Supabase. |
| **Railway** | ✅ $5 free credit | 4/5 | 4/5 | 5/5 | 4/5 | **4.4** | P4 | Already on Vercel. |

### Infrastructure Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| Stripe | 4.8 | P2 — Upgrade stub for real payments |
| GitHub API | 4.8 | P2 — Dev workflow automation |
| Sentry | 4.8 | P2 — Production error tracking |
| Vercel API | 5.0 | P2 — Deployment management |
| MongoDB Atlas | 4.8 | P4 — Not needed |
| Neon | 4.4 | P4 — Not needed |

---

## 14. CONTENT & PUBLISHING

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Medium RSS → JSON** | ✅ Free | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P2 | Cross-post blog content to Medium for syndication. |
| **Sanity** | ✅ Free tier | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P3 | Headless CMS. Redundant with built-in content system. |
| **Contentful** | ✅ Free tier | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P3 | Headless CMS. Redundant. |

### Content Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| Medium RSS → JSON | 4.6 | P2 — Blog syndication |
| Sanity | 4.6 | P4 — Redundant |
| Contentful | 4.8 | P4 — Redundant |

---

## 15. DATA ENRICHMENT

| API | Free Tier | Reliability | Docs | Comm Use | Integration | Overall | Priority | Rationale |
|-----|-----------|-------------|------|----------|-------------|---------|----------|-----------|
| **Clearbit** | ✅ Limited free | 4/5 | 5/5 | 5/5 | 4/5 | **4.6** | P2 | Company/person enrichment for leads. |
| **Apollo** | ✅ 10 credits/day | 4/5 | 4/5 | 4/5 | 4/5 | **4.0** | P2 | Already in registry. Lead enrichment + search. |
| **Clay** | ✅ 30 credits/mo | 3/5 | 4/5 | 4/5 | 4/5 | **3.8** | P2 | Already in registry. Multi-source enrichment. |
| **OpenCorporates** | ✅ Free | 4/5 | 4/5 | 5/5 | 4/5 | **4.4** | P3 | Company registry data. Niche. |
| **LibreTranslate** | ✅ Unlimited | 4/5 | 4/5 | 5/5 | 5/5 | **4.6** | P3 | Text translation for multilingual content. |
| **DeepL** | ✅ 500K chars/mo | 5/5 | 5/5 | 5/5 | 4/5 | **4.8** | P3 | AI translation. Higher quality than LibreTranslate. |

### Data Enrichment Recommendation

| API | Score | Verdict |
|-----|-------|---------|
| Clearbit | 4.6 | P2 — Lead enrichment |
| Apollo | 4.0 | P2 — Upgrade stub |
| Clay | 3.8 | P2 — Upgrade stub |
| DeepL | 4.8 | P3 — Content translation |
| LibreTranslate | 4.6 | P3 — Free translation |

---

## CONSOLIDATED ROADMAP

### P1 — Must Integrate Now (7 APIs)

| # | API | Category | Why Now | Est. Effort |
|---|-----|----------|---------|-------------|
| 1 | **Unsplash** | Image Generation | Stock photos for content factory | 1 day |
| 2 | **Pexels** | Image Generation | Stock photos + videos | 1 day |
| 3 | **Cloudinary** | Image Generation | Image optimization + CDN for client sites | 2 days |
| 4 | **SendGrid** | Email | Email campaigns + newsletters (missing capability) | 2 days |
| 5 | **Google Trends** | Marketing | Content strategy + keyword research | 1 day |
| 6 | **News API** | Marketing | News monitoring + competitive intel | 1 day |
| 7 | **Apollo (real)** | Lead Gen | Lead enrichment + search (upgrade stub) | 2 days |

### P2 — Integrate Later (20 APIs)

| # | API | Category | Prerequisite |
|---|-----|----------|-------------|
| 1 | **OpenRouter** | AI/LLM | After P1 |
| 2 | **Stability AI** | Image Gen | AI image generation |
| 3 | **YouTube Data** | Video | Reels/video publishing |
| 4 | **ElevenLabs** | Voice | Voice narration |
| 5 | **Twilio (real)** | Voice | SMS + call outreach |
| 6 | **Instagram (real)** | Social | Content factory publishing |
| 7 | **Reddit** | Social | Lead gen + social listening |
| 8 | **Slack** | Social/Automation | Agent notifications |
| 9 | **Algolia** | Search | Dashboard search UX |
| 10 | **Google Custom Search** | Search | Market research |
| 11 | **Clearbit** | Lead Gen | Lead enrichment |
| 12 | **Clay (real)** | Lead Gen | Multi-source enrichment |
| 13 | **HubSpot (real)** | CRM | 2-way CRM sync |
| 14 | **Calendly (real)** | Automation | Meeting scheduling |
| 15 | **GitHub API** | Automation | Dev workflow automation |
| 16 | **Uptime Robot** | Automation | Client website monitoring |
| 17 | **Sentry** | DevOps | Error tracking |
| 18 | **Stripe (real)** | Payment | Client payment processing |
| 19 | **Vercel API** | DevOps | Deploy management |
| 20 | **Medium RSS → JSON** | Content | Blog syndication |

### P3 — Optional (19 APIs)

| # | API | Category |
|---|-----|----------|
| 1 | Hugging Face | AI/LLM |
| 2 | Mistral AI | AI/LLM |
| 3 | Pixabay | Image Gen |
| 4 | Lorem Picsum | Image Gen |
| 5 | OCR.space | Image Gen |
| 6 | X / Twitter (real) | Social |
| 7 | Discord | Social |
| 8 | Mailgun | Email |
| 9 | Instantly (real) | Email |
| 10 | Smartlead (real) | Email |
| 11 | SerpAPI / SearchAPI | Search |
| 12 | IPinfo | Lead Gen |
| 13 | Airtable | CRM |
| 14 | Notion | CRM |
| 15 | Google Analytics | Analytics |
| 16 | Mapbox | Analytics |
| 17 | Zapier | Automation |
| 18 | DeepL | Data Enrichment |
| 19 | LibreTranslate | Data Enrichment |

### P4 — Ignore (30+ APIs)

Everything not listed above: animals, anime, games, sports, jokes, recipes, blockchain, books, transportation, vehicles, QR codes, URL shorteners, general weather, music, podcasts, science, space, tracking/logistics, shopping, government data, health/medical, jobs, entertainment, dictionaries, cloud storage, etc.

---

## SUMMARY

| Priority | Count | Total Effort |
|----------|-------|-------------|
| **P1 — Must Integrate Now** | 7 | ~10 days (sequential) or ~5 days (parallel) |
| **P2 — Integrate Later** | 20 | ~30 days |
| **P3 — Optional** | 19 | ~20 days |
| **P4 — Ignore** | 30+ | 0 |

**Immediate next step**: Wire up the 7 P1 APIs to unblock content factory (images), email campaigns, and market research capabilities.
