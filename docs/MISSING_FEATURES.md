# MISSING FEATURES — INLIGHT AGENCY OS

## 🔴 CRITICAL (Must Fix Before Production)

### 1. Voice Engine TypeScript Errors
- **Description:** `lib/voice/interruptions.ts` has syntax errors at lines 75-76
- **Why Needed:** Blocks all voice functionality
- **Suggested Implementation:** Correct the TypeScript syntax (missing commas, string delimiters)
- **Dependencies:** None
- **Estimated Effort:** 15 minutes

### 2. Missing OAuth Keys for Core Providers
- **Description:** Calendly and Salesforce OAuth configured but no keys exist in `.env.local`
- **Why Needed:** Calendar scheduling and CRM sync are core features
- **Suggested Implementation:** Obtain keys from Calendly developer console and Salesforce setup
- **Dependencies:** Calendly/Salesforce developer accounts
- **Estimated Effort:** 2 hours

### 3. Queue Process Route Has No Authentication
- **Description:** `app/api/queue/process/route.ts` has zero auth checks
- **Why Needed:** Security risk — anyone can process jobs
- **Suggested Implementation:** Add Supabase auth check or `CRON_SECRET` validation
- **Dependencies:** None
- **Estimated Effort:** 30 minutes

### 4. Automation Provider API Keys All Missing
- **Description:** Stripe, HubSpot, Slack, Discord, Telegram, Airtable, n8n, Make API keys all absent
- **Why Needed:** 10 automation providers cannot function without keys
- **Suggested Implementation:** Generate API keys from each provider's dashboard
- **Dependencies:** Accounts on each platform
- **Estimated Effort:** 4 hours

## 🟡 HIGH (Critical for Full Operation)

### 5. Real Video Rendering Integration
- **Description:** Runway, Pika, Kling, Veo providers are configured but no real API calls
- **Why Needed:** Video production pipeline cannot produce actual videos
- **Suggested Implementation:** Integrate Runway API (best free tier) for initial video generation
- **Dependencies:** Runway API key
- **Estimated Effort:** 2 days

### 6. Real Telephony (Twilio/Vapi)
- **Description:** Twilio, Vapi, BlandAI providers implemented as stubs
- **Why Needed:** Voice calling, appointment reminders, AI phone agents
- **Suggested Implementation:** Integrate Vapi (simplest) or Twilio (most reliable)
- **Dependencies:** Vapi/Twilio API keys, phone number
- **Estimated Effort:** 3 days

### 7. WhatsApp Business API Integration
- **Description:** WhatsApp engine exists but no real API key
- **Why Needed:** Client communication, marketing campaigns
- **Suggested Implementation:** Register for WhatsApp Business API via Meta
- **Dependencies:** Meta Business account
- **Estimated Effort:** 2 days

### 8. X/Twitter Publishing
- **Description:** XProvider is a stub — no real API calls
- **Why Needed:** Multi-platform publishing is incomplete without X
- **Suggested Implementation:** Implement real X API v2 integration
- **Dependencies:** X Developer account (free basic tier)
- **Estimated Effort:** 1 day

### 9. Real Email Outreach
- **Description:** Gmail OAuth keys present but not tested end-to-end
- **Why Needed:** Email outreach is a core agency function
- **Suggested Implementation:** Verify Gmail OAuth flow, test `send_email` action
- **Dependencies:** Google Cloud Console OAuth setup
- **Estimated Effort:** 1 day

### 10. End-to-End Social Publishing
- **Description:** LinkedIn, Facebook, Instagram providers exist but need OAuth token exchange
- **Why Needed:** Core agency deliverable
- **Suggested Implementation:** Complete OAuth flows for Facebook/Instagram, verify LinkedIn publishing
- **Dependencies:** Facebook App Review, LinkedIn API approval
- **Estimated Effort:** 3 days

### 11. Missing Automated Tests
- **Description:** Only 76 tests for ~30 systems
- **Why Needed:** Cannot verify system stability
- **Suggested Implementation:** Add tests for all critical paths
- **Dependencies:** None
- **Estimated Effort:** 2 weeks

### 12. No CI/CD Pipeline
- **Description:** No GitHub Actions or similar CI configuration
- **Why Needed:** Cannot automate testing/deployment
- **Suggested Implementation:** Add GitHub Actions workflow for test/lint/build
- **Dependencies:** None
- **Estimated Effort:** 1 day

## 🟢 MEDIUM (Important for Feature Completeness)

### 13. Real LinkedIn Post Publishing
- **Description:** LinkedIn OAuth works but real publishing needs end-to-end verification
- **Why Needed:** Core social publishing feature incomplete
- **Suggested Implementation:** Run verify-and-publish script with valid tokens
- **Dependencies:** Valid LinkedIn OAuth tokens
- **Estimated Effort:** 4 hours

### 14. Software Factory Deployment Integration
- **Description:** Vercel/Netlify/GitHub Pages deployment not connected
- **Why Needed:** Software factory cannot deliver deployable sites
- **Suggested Implementation:** Integrate Vercel API for auto-deploy
- **Dependencies:** Vercel API key
- **Estimated Effort:** 2 days

### 15. Website Factory Go-Live
- **Description:** Website builder creates specs but doesn't deploy
- **Why Needed:** Clients cannot receive live websites
- **Suggested Implementation:** Connect Vercel API or FTP deployment
- **Dependencies:** Vercel API key or FTP credentials
- **Estimated Effort:** 2 days

### 16. Knowledge Doc Vector Search
- **Description:** `knowledge_docs` table exists but not indexed for vector search
- **Why Needed:** Brain/Q&A cannot retrieve relevant documents
- **Suggested Implementation:** Add `pgvector` column and sync to brain embeddings
- **Dependencies:** `pgvector` extension on Supabase
- **Estimated Effort:** 1 day

### 17. OpenAI/Anthropic/Groq Integration
- **Description:** Provider code exists but no API keys
- **Why Needed:** Production AI reliability depends on paid tiers (free tiers rate-limit)
- **Suggested Implementation:** Add at least one paid AI provider key for production reliability
- **Dependencies:** OpenAI/Anthropic/Groq billing account
- **Estimated Effort:** 1 hour

### 18. Real Lead Enrichment (Apollo/Clearbit)
- **Description:** Lead enrichment is simulated
- **Why Needed:** Sales pipeline needs enriched contact data
- **Suggested Implementation:** Integrate Apollo API or Clearbit
- **Dependencies:** Apollo/Clearbit API key
- **Estimated Effort:** 2 days

### 19. Content Marketing Campaigns
- **Description:** Campaign management exists but no real execution
- **Why Needed:** Marketing automation is a core promise
- **Suggested Implementation:** Wire campaigns to content factory for actual publishing
- **Dependencies:** Content factory providers configured
- **Estimated Effort:** 1 day

### 20. Dashboard Server Actions
- **Description:** Only CEO, Command Center, Queue, Orchestrator dashboards have `actions.ts`
- **Why Needed:** Remaining dashboards have no server-side logic
- **Suggested Implementation:** Add server actions to all remaining dashboards
- **Dependencies:** None
- **Estimated Effort:** 3 days

### 21. Reel Package Download/Export
- **Description:** Packages generated but no download/export UI
- **Why Needed:** Users cannot retrieve generated reel packages
- **Suggested Implementation:** Add package download as ZIP/PDF
- **Dependencies:** None
- **Estimated Effort:** 1 day

## 🔵 LOW (Nice to Have)

### 22. Theme/Style Customization
- **Description:** No theme or branding customization for client portals
- **Why Needed:** Clients expect white-label or branded experiences
- **Suggested Implementation:** Add CSS variable theming with per-client overrides
- **Dependencies:** None
- **Estimated Effort:** 2 days

### 23. Notification System
- **Description:** Currently uses `execution_logs` only — no push/email/in-app notifications
- **Why Needed:** Users have no visibility into async job completion
- **Suggested Implementation:** Integrate Web Push API or Resend for email notifications
- **Dependencies:** Resend API key or VAPID keys
- **Estimated Effort:** 1 day

### 24. Mobile App
- **Description:** No mobile interface exists
- **Why Needed:** Agency operators need on-the-go access
- **Suggested Implementation:** React Native or Flutter wrapper around key dashboards
- **Dependencies:** None
- **Estimated Effort:** 3 weeks

### 25. Multi-Tenant Support
- **Description:** All data is single-tenant — no organization isolation
- **Why Needed:** Cannot serve multiple clients securely
- **Suggested Implementation:** Add `organization_id` to all tables and row-level security
- **Dependencies:** Database migration plan
- **Estimated Effort:** 1 week

### 26. Analytics Dashboard
- **Description:** Basic KPIs exist but no visualization
- **Why Needed:** Stakeholders cannot track performance
- **Suggested Implementation:** Integrate Chart.js or Recharts for campaign/queue analytics
- **Dependencies:** None
- **Estimated Effort:** 3 days

### 27. API Rate Limiting
- **Description:** No rate limiting on public API routes
- **Why Needed:** Abuse potential and cost overruns
- **Suggested Implementation:** Add `express-rate-limit` or Upstash rate limiting to API routes
- **Dependencies:** None
- **Estimated Effort:** 1 day

### 28. Webhook Endpoints
- **Description:** No webhook receivers for external integration callbacks
- **Why Needed:** Third-party services cannot push events to the system
- **Suggested Implementation:** Create `/api/webhooks/:provider` endpoints with signature verification
- **Dependencies:** None
- **Estimated Effort:** 2 days

### 29. Billing/Subscription Integration
- **Description:** No billing system connected
- **Why Needed:** Cannot charge clients or manage subscriptions
- **Suggested Implementation:** Integrate Stripe Billing with usage-based pricing
- **Dependencies:** Stripe account
- **Estimated Effort:** 3 days

### 30. Audit Log Export
- **Description:** Audit logs exist but no export/download capability
- **Why Needed:** Compliance and client reporting
- **Suggested Implementation:** Add CSV/JSON export button to audit log dashboard
- **Dependencies:** None
- **Estimated Effort:** 1 day

## SUMMARY

| Priority | Count | Total Estimated Effort |
|----------|-------|----------------------|
| 🔴 Critical | 4 | ~7 hours |
| 🟡 High | 8 | ~12-14 days |
| 🟢 Medium | 9 | ~12 days |
| 🔵 Low | 9 | ~32 days |
| **Total** | **30** | **~8-10 weeks** |

**Next Recommended Action:** Resolve all 4 🔴 Critical items first (estimated 7 hours), then proceed to 🟡 High items in priority order. The Critical and High categories together represent the minimum viable product barrier.
