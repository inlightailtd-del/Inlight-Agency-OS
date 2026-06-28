# MINIMUM GO-LIVE CONFIGURATION

**Goal**: Smallest set of credentials to make the Content Agent produce and schedule content.

---

## THE MINIMUM: 5 THINGS

| # | What | Why | Time |
|---|------|-----|------|
| 1 | **Supabase project** | Database, auth, vector search, file storage | 15 min |
| 2 | **Ollama (local)** | Default AI provider — content generation, embeddings, agent execution | 10 min |
| 3 | **Unsplash API key** | Stock images for content pipeline | 5 min |
| 4 | **Pexels API key** | Backup stock images (wider free tier) | 5 min |
| 5 | **News API key** | Market research + content ideation | 5 min |

**Total setup time**: ~40 minutes
**Total cost**: $0

---

## STEP-BY-STEP

### Step 1: Supabase (15 min)

```bash
# 1. Create project at https://supabase.com (free tier)
# 2. Copy these three values from Settings → API:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                    # anon public key
SUPABASE_SERVICE_ROLE_KEY=eyJ...                        # service_role key

# 3. Set your app URL (for local dev):
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 4. Paste all 41 migration files into Supabase SQL Editor
#    Start with supabase/migrations/001_initial_schema.sql
#    End with supabase/migrations/041_content_workflow.sql
#    Run each one in order
```

### Step 2: Ollama (10 min)

```bash
# 1. Download and install from https://ollama.com
# 2. Open terminal and pull models:
ollama pull llama3.1          # ~4.7 GB — default LLM
ollama pull nomic-embed-text   # ~274 MB — embeddings for vector search

# 3. Verify:
ollama list
# Should show: llama3.1, nomic-embed-text
```

**No env vars needed**. Ollama runs on `http://localhost:11434` by default. The code falls back to this automatically.

### Step 3: Unsplash (5 min)

```bash
# 1. Go to https://unsplash.com/developers
# 2. Register a developer account
# 3. Create a new application
# 4. Copy the "Access Key" (NOT the Secret Key)
```

```env
UNSPLASH_ACCESS_KEY=your-unsplash-access-key
```

### Step 4: Pexels (5 min)

```bash
# 1. Go to https://www.pexels.com/api/
# 2. Sign up for a free account
# 3. Request API key (instant)
```

```env
PEXELS_API_KEY=your-pexels-api-key
```

### Step 5: News API (5 min)

```bash
# 1. Go to https://newsapi.org/register
# 2. Create free account
# 3. Copy API key
```

```env
NEWSAPI_API_KEY=your-newsapi-api-key
```

---

## THE .ENV.LOCAL FILE

```env
# ─── Required (5 vars) ──────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
UNSPLASH_ACCESS_KEY=your-unsplash-key
PEXELS_API_KEY=your-pexels-key
NEWSAPI_API_KEY=your-newsapi-key

# ─── Optional (set later for publishing) ────────────────────
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# LINKEDIN_CLIENT_ID=
# LINKEDIN_CLIENT_SECRET=
# FACEBOOK_CLIENT_ID=
# FACEBOOK_CLIENT_SECRET=
```

---

## WHAT WORKS WITH JUST THESE 5

| Feature | Works? |
|---------|--------|
| **Content Agent** — generate blog/social/ad/email/landing page | ✅ Yes (via Ollama) |
| **Content Pipeline** — Trends → News → Ideas → Images → Content → Calendar → Approvals | ✅ Yes |
| **Google Trends** — trending topic research | ✅ Yes (RSS, no key) |
| **News API** — competitive intelligence | ✅ Yes (NEWSAPI key) |
| **Stock images** — Unsplash + Pexels | ✅ Yes (both keys) |
| **Content calendar** — weekly schedule (`content_factory_calendar`) | ✅ Yes |
| **Approval queue** — pending items in `agent_approval_requests` | ✅ Yes |
| **Company Brain** — vector search + RAG | ✅ Yes (via Ollama embeddings) |
| **CEO Agent** — system assessment | ✅ Yes (via Ollama) |
| **Lead Analyzer** — AI lead scoring | ✅ Yes (via Ollama) |

## WHAT DOESN'T WORK WITHOUT OAUTH

| Feature | Blocked By |
|---------|-----------|
| **LinkedIn publishing** | LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET |
| **Facebook publishing** | FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET |
| **Gmail sending** | GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET |
| **Calendly scheduling** | CALENDLY_CLIENT_ID / CALENDLY_CLIENT_SECRET |
| **SMS / Voice calls** | Twilio API key (stub only) |

Content is **generated, scheduled, and queued for approval** without OAuth. Publishing needs OAuth configured.

---

## VERIFICATION CHECKLIST

After configuration, verify with:

- [ ] `npm run dev` starts without errors
- [ ] `/` loads landing page
- [ ] `/signup` creates an account
- [ ] `/dashboard` loads after login
- [ ] `/dashboard/content` shows Content Engine page
- [ ] "Run Content Pipeline" button exists
- [ ] `/dashboard/settings/ai` shows Ollama as active provider
- [ ] Ollama responds: `ollama list` shows both models
- [ ] Supabase project has all 41 migrations applied

### Production Vercel Deploy

```bash
# Add these to Vercel Environment Variables:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=https://your-domain.com
UNSPLASH_ACCESS_KEY
PEXELS_API_KEY
NEWSAPI_API_KEY
```
