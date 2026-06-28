# Credentials Matrix — Inlight Agency OS

## Legend
| Icon | Meaning |
|------|---------|
| ✅ | Present in .env.local |
| ❌ | Missing |
| 🟡 | Partial (client ID present, secret missing) |
| N/A | Not applicable |

---

| Provider | Status | Required | Optional | Cost/month | Free Tier | Owner | How To Get | Setup Time |
|----------|--------|----------|----------|------------|-----------|-------|------------|------------|
| **Supabase** | ✅ | `NEXT_PUBLIC_SUPABASE_URL` `NEXT_PUBLIC_SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` | — | $25 (Pro) | 500MB DB, 50K users, 5GB bandwidth, 2M edge requests | Hamza | Dashboard → Project Settings → API | 2 min |
| **Next.js / Vercel** | ✅ | `NEXT_PUBLIC_APP_URL` | Vercel token | $20 (Pro) | 100GB bandwidth, 6K build min, 1 concurrent build | Hamza | vercel.com → Import Git repo → Add env vars | 10 min |
| **Unsplash** | ✅ | `UNSPLASH_ACCESS_KEY` | `UNSPLASH_SECRET` | Free | 50 req/hr | Hamza | unsplash.com/developers → New App | 5 min |
| **Pexels** | ✅ | `PEXELS_API_KEY` | — | Free | 200 req/hr, 20K req/month | Hamza | pexels.com/api → Get free API key | 2 min |
| **NewsAPI** | ✅ | `NEWSAPI_API_KEY` | — | Free | 100 req/day | Hamza | newsapi.org → Register → Get API key | 2 min |
| **LinkedIn** | 🟡 | `LINKEDIN_CLIENT_ID` `LINKEDIN_CLIENT_SECRET` | — | Free | Standard API access | Hamza | linkedin.com/developers → Create App → Add products | 15 min |
| **Google / Gmail** | 🟡 | `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | — | Free | Gmail API: 1B quota/day | Hamza | console.cloud.google.com → Enable APIs → Create credentials | 15 min |
| **YouTube** | 🟡 | (Shares Google credentials) | — | Free | YouTube Data API: 10K units/day | Hamza | console.cloud.google.com → Enable YouTube Data API v3 | 5 min |
| **Facebook / Instagram** | 🟡 | `FACEBOOK_CLIENT_ID` `FACEBOOK_CLIENT_SECRET` | — | Free | Standard API access | Hamza | developers.facebook.com → Create App → Add Facebook Login | 20 min |
| **Stripe** | ❌ | `STRIPE_API_KEY` | — | 2.9% + $0.30/transaction | Standard | Hamza | dashboard.stripe.com → API keys → Reveal secret key | 5 min |
| **Calendly** | ❌ | `CALENDLY_CLIENT_ID` `CALENDLY_CLIENT_SECRET` | — | $10 (Essentials) | 1 event type | Hamza | calendly.com → Integrations → API & Webhooks → Create OAuth app | 15 min |
| **HubSpot** | ❌ | `HUBSPOT_API_KEY` | — | $45 (Starter) | Free CRM (1K contacts) | Hamza | app.hubspot.com → Settings → Integrations → Private Apps → Create | 10 min |
| **Salesforce** | ❌ | `SALESFORCE_CLIENT_ID` `SALESFORCE_CLIENT_SECRET` | — | $25 (Starter) | Free (1 CRM) | Hamza | salesforce.com → Setup → App Manager → New Connected App | 20 min |
| **Slack** | ❌ | `SLACK_BOT_TOKEN` | `SLACK_SIGNING_SECRET` | Free | 10 apps, 5K messages/channel | Hamza | api.slack.com → Create App → Bot Tokens → Install to Workspace | 15 min |
| **Discord** | ❌ | `DISCORD_BOT_TOKEN` | `DISCORD_CLIENT_ID` | Free | 1K guilds, unlimited messages | Hamza | discord.com/developers → New Application → Bot → Reset Token | 10 min |
| **Telegram** | ❌ | `TELEGRAM_BOT_TOKEN` | — | Free | Unlimited | Hamza | t.me/BotFather → /newbot → Copy token | 5 min |
| **Twilio** | ❌ | `TWILIO_ACCOUNT_SID` `TWILIO_AUTH_TOKEN` | `TWILIO_PHONE_NUMBER` | Pay as you go ($1.15/mo + $0.014/min) | $0 trial ($15 credit) | Hamza | twilio.com → Register → Get Account SID & Auth Token | 10 min |
| **WhatsApp** | ❌ | `WHATSAPP_ACCESS_TOKEN` | `WHATSAPP_PHONE_NUMBER_ID` `WABA_ID` `BUSINESS_ID` | Pay as you go (varies by region) | 1K free convos/month | Hamza | developers.facebook.com → WhatsApp → Create Business App | 30 min |
| **Airtable** | ❌ | `AIRTABLE_API_KEY` | `AIRTABLE_BASE_ID` | $20 (Team) | 1K records/base, 2GB attachments | Hamza | airtable.com → Account → Generate API key | 5 min |
| **n8n** | ❌ | `N8N_API_KEY` `N8N_BASE_URL` | — | Free self-hosted | Unlimited self-hosted | Hamza | n8n.io → Self-host or cloud → Settings → API → Generate key | 10 min |
| **Make** | ❌ | `MAKE_API_KEY` `MAKE_BASE_URL` | `MAKE_TEAM_ID` | $9 (Pro) | 1K ops/month | Hamza | make.com → Settings → API → Create API key | 5 min |
| **Sentry** | ❌ | `SENTRY_DSN` `NEXT_PUBLIC_SENTRY_DSN` | — | Free | 5K events/month, 1 user | Hamza | sentry.io → Create Project → Next.js → Copy DSN | 5 min |
| **Langfuse** | ❌ | `LANGFUSE_SECRET_KEY` `LANGFUSE_PUBLIC_KEY` | `LANGFUSE_BASE_URL` | Free (cloud) | 50K observations/month | Hamza | langfuse.com → Sign up → Create Project → API Keys | 5 min |

---

## OAuth Token Status

| Provider | Client ID | Client Secret | Token Generated | Expires | Auto-Refresh | Expiry Monitor |
|----------|-----------|---------------|-----------------|---------|--------------|----------------|
| LinkedIn | ✅ | ✅ | ❌ | Once generated: 60 days | ✅ (via `refreshAccessToken`) | ❌ (no scheduled check) |
| Gmail | ✅ | ✅ | ❌ | Once generated: 1 hour (refresh: 6 months) | ✅ | ❌ |
| Facebook | ✅ | ✅ | ❌ | Once generated: 60 days | ✅ | ❌ |
| Instagram | ✅ (shares FB) | ✅ (shares FB) | ❌ | Once generated: 60 days | ✅ | ❌ |
| YouTube | ✅ (shares Google) | ✅ (shares Google) | ❌ | Once generated: 1 hour (refresh: 6 months) | ✅ | ❌ |
| Calendly | ❌ | ❌ | ❌ | N/A | N/A | N/A |
| Salesforce | ❌ | ❌ | ❌ | N/A | N/A | N/A |

## Urgent Actions (Priority Order)

1. **Register Calendly OAuth app** → Get `CALENDLY_CLIENT_ID` + `CALENDLY_CLIENT_SECRET` → Run OAuth flow
2. **Register Salesforce Connected App** → Get `SALESFORCE_CLIENT_ID` + `SALESFORCE_CLIENT_SECRET` → Run OAuth flow
3. **Complete LinkedIn OAuth flow** → Visit `GET /api/integrations/oauth/authorize?provider=linkedin`
4. **Complete Google OAuth flow** → Visit `GET /api/integrations/oauth/authorize?provider=gmail`
5. **Complete Facebook OAuth flow** → Visit `GET /api/integrations/oauth/authorize?provider=facebook`
6. **Complete YouTube OAuth flow** → Visit `GET /api/integrations/oauth/authorize?provider=youtube`
7. **Get Stripe API key** → Add `STRIPE_API_KEY` to .env.local
8. **Get HubSpot API key** → Add `HUBSPOT_API_KEY` to .env.local
9. **Get Slack bot token** → Add `SLACK_BOT_TOKEN` to .env.local
