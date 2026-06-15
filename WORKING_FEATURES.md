# Working Features — Inlight Agency OS

## ✅ Fully Working

### Authentication & Security
- **Supabase SSR Auth** — Email/password login and signup
- **Auth Middleware** — Protects all `/dashboard/*` routes, redirects to `/login`
- **Row Level Security** — All 15+ database tables have RLS policies
- **Session Management** — Cookie-based sessions via `@supabase/ssr`

### CRM
- **Clients** — Full CRUD with name, email, phone, company, website, notes
- **Client Health Tracking** — Active/inactive status
- **Client-Specific Views** — Detail pages with linked projects, invoices

### Projects
- **Full CRUD** — Name, description, status, priority, dates, budget
- **Service Types** — SEO, social media, paid ads, web dev, AI automation
- **Budget Tracking** — Budget vs actual cost

### Finance
- **Invoices** — Create, send, track status (draft/sent/paid/overdue)
- **Expenses** — Track with categories (software, ads, freelancer, other)
- **Revenue Dashboard** — Basic analytics view

### Company Brain (Knowledge Base)
- **Knowledge Docs** — Create, edit, version history
- **Categories & Tags** — Organization by department and type
- **Vector Search** — pgvector semantic search via `search_memories` RPC
- **Auto-Indexing** — Docs indexed to `memories` on create/edit
- **Keyword Fallback** — ILIKE search if vector RPC unavailable

### AI Provider Configuration
- **4 Providers** — Ollama, OpenAI, Anthropic, Groq
- **Config UI** — `/dashboard/settings/ai` — set API URLs, models, keys
- **Execution History** — Recent AI execution logs shown in UI

### Agent Runtime
- **5 Execution Modes** — manual, squad, delegation, approval, cron
- **Approval System** — 12 action types (schedule, budget, content, deploy, etc.)
- **4 Autonomy Levels** — supervised, semi-autonomous, autonomous, full
- **Agent Registry** — List/view/edit agents in dashboard
- **Agent Agent Timeline** — Execution history per agent

### Orchestrator
- **Task Queue** — View pending/in-progress tasks
- **Manual Execution** — Run tasks on demand
- **History** — Past orchestration runs

### Integrations SDK
- **OAuth Framework** — LinkedIn, Google, Facebook OAuth flows
- **Connection Management** — Connect/disconnect/refresh integrations
- **Facebook Pages** — Select and manage connected pages

## ⚠️ Partially Working

### Company Brain V2 Chat
- Vector search RPC exists in migration 040
- Fallback to keyword works
- **Missing**: Human-facing chat UI for interactive Q&A

### CEO Agent
- Assessment generation works
- Manager/employee evaluation structure defined
- **Missing**: Automated cron schedule calling `enqueueCeoAssessmentIfNeeded()`

### Content Systems
- Content generation engine works (blog, social, ad, email, landing page)
- Content history tracking
- **Missing**: Full publishing pipeline verification

### Validation System
- 6 validators defined (content, LinkedIn, Gmail, Facebook, growth, voice)
- Run/status/latest API endpoints exist
- Validation UI at `/dashboard/validation`

### Lead Management
- Lead scoring via LLM
- Batch analysis and opportunity detection
- Full CRUD leads with history
- **Missing**: Real lead data in production

### Growth Engine
- Daily growth execution pipeline
- Phase status tracking (content, LinkedIn, email, leads, report)
- `/api/cron/daily` endpoint for automated runs

### Department Systems (Foundation Built)
- Sales, Outreach, Voice AI, Content Marketing
- Video, Websites, Software, Automation, Factory
- Each has: engine file, basic dashboard page, API route
- **Missing**: Real business logic, full UI workflows, production data

## 🔲 Not Yet Working

### Automated Execution (Cron)
- `/api/cron/daily` endpoint exists and works
- Agent runtime tick integrated
- **Requires**: External cron service (cron-job.org) with `CRON_SECRET`
- **Local**: Runs when you hit the endpoint manually

### Agent Retry Logic
- Failed tasks logged but not automatically retried

### Testing
- Only 1 test file exists

### Multi-tenant
- Per-user data only, no organization-level isolation
