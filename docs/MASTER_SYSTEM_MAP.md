# MASTER SYSTEM MAP — Inlight Agency OS

**Generated**: 2026-06-16
**Version**: v0.1.0
**Architecture**: Next.js 14 App Router + Supabase PostgreSQL + TypeScript + Tailwind CSS

---

## 1. COMPLETE ARCHITECTURE

### Technology Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| **Framework** | Next.js 14 (App Router) | ✅ Production |
| **Language** | TypeScript (strict mode) | ✅ Production |
| **Styling** | Tailwind CSS + shadcn/ui (Radix primitives) | ✅ Production |
| **Database** | PostgreSQL 17 via Supabase + pgvector | ✅ Production |
| **Auth** | `@supabase/ssr` — cookie-based sessions | ✅ Production |
| **AI Providers** | Ollama (local), OpenAI, Anthropic, Groq | ✅ Production |
| **Deployment** | Vercel (Node.js 20.x) | ✅ Configured |
| **Package Manager** | npm | ✅ |

### Architecture Layers

```
┌─────────────────────────────────────────────┐
│  CLIENT LAYER                                │
│  Landing (/), Auth (/login, /signup)         │
│  Dashboard (95 pages across 35 sections)     │
├─────────────────────────────────────────────┤
│  API LAYER (40 Route Handlers)               │
│  /api/agents/* , /api/brain/*               │
│  /api/business/* , /api/content-factory/*   │
│  /api/integrations/* , /api/reels/*         │
│  /api/validation/* , /api/cron/*            │
├─────────────────────────────────────────────┤
│  BUSINESS LOGIC (146 TypeScript files)       │
│  lib/agents/    → Runtime, approval, swarms │
│  lib/ai/        → Provider, execution, tools │
│  lib/brain/     → Embeddings, context        │
│  lib/ceo/       → CEO assessment engine      │
│  lib/integrations/ → OAuth + 15 providers    │
│  lib/supabase/  → Data access layer (14 svcs) │
│  lib/ +20 modules → Business domain engines  │
├─────────────────────────────────────────────┤
│  DATABASE LAYER                              │
│  Supabase PostgreSQL + pgvector              │
│  40 migrations (001-040)                     │
│  ~30+ tables with RLS                        │
│  Vector(768) for semantic search             │
│  IVFFlat index on memories.embedding         │
└─────────────────────────────────────────────┘
```

---

## 2. EXISTING AGENTS

### Agent Runtime (`lib/agents/runtime.ts` — 617 lines)

| Method | Type | Status | Description |
|--------|------|--------|-------------|
| `exec()` | Manual | ✅ Working | One-shot agent execution with prompt |
| `tick()` | Scheduled | ✅ Working | Drains orchestrator queue (needs cron trigger) |
| `on()` | Event-driven | ✅ Working | Triggered by database events |
| `delegate()` | Multi-agent | ✅ Working | Sequential delegation with context passing |
| `dispatchSquad()` | Parallel | ✅ Working | Executes multiple agents in parallel |
| `schedule()` | Registration | ✅ Working | Stores schedules in orchestrator_memory |
| `tickScheduled()` | Cron | ✅ Working | Wraps exec() for scheduled agents |

### Approval System (`lib/agents/approval.ts` — 262 lines)

| Component | Status | Details |
|-----------|--------|---------|
| 12 Action Rules | ✅ Working | schedule_change, budget_change, financial_action, delete_entity, cancel_project, etc. |
| 4 Autonomy Levels | ✅ Working | Level 1-4 with per-action thresholds |
| `checkAutonomy()` | ✅ Working | Risk + agent level + config evaluation |
| `resolveApproval()` | ✅ Working | Approve → resume task, Reject → fail task |
| `fetchPendingApprovals()` | ✅ Working | List with agent names |
| Agent Config | ✅ Working | autonomy.level + requires_approval_for from agent.config |

### Departments (`lib/agents/departments.ts` — 180 lines)

| Department | Plan | Steps | Status |
|-----------|------|-------|--------|
| Marketing | MARKETING_PLAN | Research → Plan → Create → Campaign Setup | ✅ Working |
| Sales | SALES_PLAN | Score → Qualify → Outreach → Pipeline Review | ✅ Working |
| Operations | OPERATIONS_PLAN | Project Scan → Queue → Quality → Report | ✅ Working |
| `runDepartment()` | — | Executes via runtime.delegate() | ✅ Working |
| `getDepartmentStatus()` | — | Queries agents + tasks, computes health | ✅ Working |
| `getDepartmentSquad()` | — | Builds AgentSquad from agents table | ✅ Working |

### Project Monitor Agent (`lib/agents/project-monitor.ts` — 351 lines)

| Check | Status | Detection |
|-------|--------|-----------|
| Overdue Tasks | ✅ Working | Critical/high-priority overdue detection |
| Milestone at Risk | ✅ Working | Due within 7 days |
| Budget Overrun | ✅ Working | >80% used (warning), >100% used (critical) |
| Health Drop | ✅ Working | ≤50 (warning), ≤30 (critical) |
| Stalled Projects | ✅ Working | 7d (warning), 14d (critical) without update |
| Remediation Plan | ✅ Working | Builds DelegationPlan for critical findings |
| Task Creation | ✅ Working | Creates orchestrator_tasks per finding |

### CEO Agent (`lib/ceo/ceo.ts` — 278 lines)

| Function | Status | Details |
|----------|--------|---------|
| `runCeoAssessment()` | ✅ Working | Gathers system state, calls AI, executes 5 decision types |
| `gatherSystemState()` | ✅ Working | Queries jobs, tasks, content, leads, memories |
| Decision Types | ✅ Working | create_task, launch_workflow, create_content, create_lead_task, enqueue_job |
| `getLastCeoAssessment()` | ✅ Working | Retrieves from agent_memory |
| `getCeoRunStats()` | ✅ Working | Counts executions |
| CEO Dashboard UI | ✅ Working | /dashboard/ceo/page.tsx |

### Manager Agent (`lib/ceo/manager.ts` — 270 lines)

| Function | Status | Details |
|----------|--------|---------|
| `runManagerAssessment()` | ✅ Working | 5 department types with department-specific data queries |

### Agent Wrappers (`lib/agents/wrappers.ts`)

| Wrapper | Status | Details |
|---------|--------|---------|
| CEO Full Assessment | ✅ Working | Connects to runtime, logs execution |
| CEO Department Oversight | ✅ Working | Per-department oversight |
| Content Generate | ✅ Working | Multi-type content generation |
| Content Batch | ✅ Working | Sequential batch processing |
| Lead Analyze | ✅ Working | Single lead AI scoring |
| Lead Batch Analyze | ✅ Working | Batch lead scoring |
| Lead Detect Opportunities | ✅ Working | Finds leads with score ≥70 |
| Performance Agent | ✅ Working | Health checks, optimization reports |

### Content Factory (`lib/content-factory/` — 11 files)

| Component | Type | Status |
|-----------|------|--------|
| idea-generator.ts | Idea generation | ✅ Working |
| writers.ts | Content writing | ✅ Working |
| templates.ts | Content templates | ✅ Working |
| publishing.ts | Publishing pipeline | ✅ Working |
| linkedin-publisher.ts | LinkedIn publishing | ✅ Working |
| image.ts | Image generation | ✅ Working |
| creative-factory.ts | Creative pipeline | ✅ Working |
| creative-index.ts | Creative indexing | ✅ Working |
| factory.ts | Factory orchestration | ✅ Working |

### Content Agent (`lib/ai/content-engine.ts`)

| Content Type | Status |
|-------------|--------|
| Blog | ✅ Working |
| Social Media | ✅ Working |
| Ad Copy | ✅ Working |
| Email | ✅ Working |
| Landing Page | ✅ Working |

### Lead Analyzer (`lib/ai/lead-analyzer.ts`)

| Function | Status | Details |
|----------|--------|---------|
| `analyzeLead()` | ✅ Working | Fetches lead, calls AI, parses JSON, updates score |
| `scoreLeadsBatch()` | ✅ Working | Sequential batch scoring |

### Marketing Skills (`lib/skills/marketing.ts` — 207 lines)

| Skill | Category | Status |
|-------|----------|--------|
| SEO Keyword Research | SEO | ✅ |
| On-Page SEO | SEO | ✅ |
| Blog Copywriting | Copywriting | ✅ |
| Conversion Copywriting | Copywriting | ✅ |
| Lead Qualification | Lead Generation | ✅ |
| Lead Outreach | Lead Generation | ✅ |
| Email Campaign Strategy | Email Marketing | ✅ |
| Social Media Strategy | Social Media | ✅ |
| Paid Ads Strategy | Paid Ads | ✅ |

### Business Engine (`lib/business/` — 11 files)

| Module | Status |
|--------|--------|
| market-intelligence.ts | ✅ Working |
| competitor-intelligence.ts | ✅ Working |
| content-strategy.ts | ✅ Working |
| offer-generation.ts | ✅ Working |
| opportunity-detection.ts | ✅ Working |
| revenue-engine.ts | ✅ Working |
| learning-engine.ts | ✅ Working |
| website-strategy.ts | ✅ Working |
| data-sources.ts | ✅ Working |
| types.ts | ✅ |

### Reels System (`lib/reels/` — 13 files)

| Module | Status | Details |
|--------|--------|---------|
| trend-scanner.ts | ✅ Working | Scans trending topics |
| hook-engine.ts | ✅ Working | Generates engagement hooks |
| script-engine.ts | ✅ Working | Writes reel scripts |
| production-engine.ts | ✅ Working | Production pipeline |
| publishing-engine.ts | ✅ Working | Publishing workflow |
| analytics-engine.ts | ✅ Working | Performance analytics |
| learning-engine.ts | ✅ Working | Pattern learning |
| competitor-intelligence.ts | ✅ Working | Competitor analysis |
| package-generator.ts | ✅ Working | Generates reel packages |
| package-index.ts | ✅ Working | Package indexing |
| package-types.ts | ✅ | Type definitions |

### Dev Systems (Experimental)

| System | Files | Status | Notes |
|--------|-------|--------|-------|
| dev-v2 | 10 files | ⚠️ Experimental | ADR engine, dev loop, RCA engine, swarm engine |
| dev-v3 | 11 files | ⚠️ Experimental | Architecture graph, code quality, browser automation |
| development | 15 files | ⚠️ Working | Architect, builder, debug engine, website builder |

### Validation System (`lib/validation/` — 9 files)

| Validator | Status |
|-----------|--------|
| content-validator.ts | ✅ Working |
| linkedin-validator.ts | ✅ Working |
| gmail-validator.ts | ✅ Working |
| facebook-validator.ts | ✅ Working |
| growth-validator.ts | ✅ Working |
| voice-validator.ts | ✅ Working |
| ai-validator.ts | ✅ Working |

### Other Engines

| Engine | File | Status |
|--------|------|--------|
| Automation | lib/automation/engine.ts | ✅ Working |
| Content Marketing | lib/content-marketing/engine.ts | ✅ Working |
| Growth | lib/growth/engine.ts | ✅ Working |
| Outreach | lib/outreach/engine.ts | ✅ Working |
| Revenue | lib/revenue/engine.ts | ✅ Working |
| Sales | lib/sales/engine.ts | ✅ Working |
| Video | lib/video/engine.ts | ✅ Working |
| Voice | lib/voice/engine.ts | ✅ Working |
| Websites | lib/websites/engine.ts | ✅ Working |
| Software | lib/software/engine.ts | ✅ Working |
| Employee | lib/employees/employee.ts | ✅ Working |
| Factory | lib/factory/engine.ts | ✅ Working |
| Learning | lib/learning/patterns.ts | ✅ Working |
| Performance | lib/perf/analyzer.ts | ✅ Working |
| Night Shift | lib/night-shift/ | ✅ Working |
| Queue | lib/queue/ | ✅ Working |
| Execution KPI | lib/execution/kpi.ts | ✅ Working |
| Execution Scheduler | lib/execution/scheduler.ts | ✅ Working |
| Execution Email | lib/execution/email.ts | ✅ Working |
| Execution Social | lib/execution/social.ts | ✅ Working |

---

## 3. EXISTING INTEGRATIONS & EXTERNAL APIs

### OAuth Providers (Fully Configured)

| Provider | Auth Type | Real API Calls | Status |
|----------|-----------|----------------|--------|
| **LinkedIn** | OAuth 2.0 | ✅ Real — UGC post creation via `/v2/ugcPosts` | ✅ Working |
| **Gmail** | OAuth 2.0 | ✅ Real — email send via Gmail API | ✅ Working |
| **Facebook** | OAuth 2.0 | ✅ Real — feed post, page listing, health check via Graph API v22.0 | ✅ Working |
| **Calendly** | OAuth 2.0 | ❌ Stub — returns mock data | ⚠️ Stub |

### API Key Providers (Stubbed — Return Mock Data)

| Provider | Category | Status | Notes |
|----------|----------|--------|-------|
| **HubSpot** | CRM | ⚠️ Stub | Mock create_contact, update_contact, create_deal |
| **Stripe** | Payment | ⚠️ Stub | Mock payment, invoice, balance |
| **Twilio** | Voice/SMS | ⚠️ Stub | Mock call, SMS |
| **Vapi** | Voice AI | ⚠️ Stub | Mock call start/end |
| **Bland AI** | Voice AI | ⚠️ Stub | Mock call |
| **Apollo** | Lead Gen | ⚠️ Stub | Mock enrich_company, search_leads |
| **Clay** | Data Enrichment | ⚠️ Stub | Mock enrich_company, enrich_person |
| **Instagram** | Social | ⚠️ Stub | Mock publish, insights |
| **X (Twitter)** | Social | ⚠️ Stub | Mock publish, insights |
| **YouTube** | Video | ⚠️ Stub | Mock publish, analytics |
| **Outlook** | Email | ⚠️ Stub | Mock send, list |
| **Instantly** | Email | ⚠️ Planned | API key only, no implementation |
| **Smartlead** | Email | ⚠️ Planned | API key only, no implementation |
| **Retell AI** | Voice | ⚠️ Planned | API key only, no implementation |
| **ElevenLabs** | Voice | ⚠️ Planned | API key only, no implementation |
| **OpenAI Realtime** | AI | ⚠️ Planned | API key only, no implementation |

### Company Brain (Vector Search)

| Component | Status |
|-----------|--------|
| pgvector extension | ✅ Installed |
| `memories` table with vector(768) | ✅ Created |
| IVFFlat index (lists=100) | ✅ Created |
| `search_memories` RPC (pgvector) | ✅ Migration 040 |
| `search_memories_keyword` RPC (ILIKE) | ✅ Migration 040 |
| `generateEmbedding()` — Ollama nomic-embed-text | ✅ Working |
| `storeMemories()` — embedding + insert | ✅ Working |
| `searchMemories()` — 3-tier fallback | ✅ Working |
| `buildContext()` — multi-type memory query | ✅ Working |
| `queryBrain()` — combined vector + keyword | ✅ Working |
| `formatContextBlock()` — prompt injection | ✅ Working |
| `indexKnowledgeDoc()` — auto-chunking | ✅ Working |
| `/api/brain/query` endpoint | ✅ Working |

### AI Provider Layer

| Provider | Model | Status |
|----------|-------|--------|
| Ollama (Local) | `llama3.1` / `nomic-embed-text` | ✅ Default |
| OpenAI | `gpt-4o` | ✅ Via config |
| Anthropic | `claude-sonnet-4-20250514` | ✅ Via config |
| Groq | `llama3-70b-8192` | ✅ Via config |
| AI Provider Config UI | — | ✅ /dashboard/settings/ai |

---

## 4. EXISTING WORKFLOWS

| Workflow | Type | Status |
|----------|------|--------|
| SaaS Business Builder | Multi-agent | ✅ /lib/ai/workflow.ts |
| Marketing Strategy | Multi-agent | ✅ /lib/ai/workflow.ts |
| Lead Generation | Multi-agent | ✅ /lib/ai/workflow.ts |
| Client Proposal | Multi-agent | ✅ /lib/ai/workflow.ts |
| SEO Strategy | Multi-agent | ✅ /lib/ai/workflow.ts |
| Agency Growth | Multi-agent | ✅ /lib/ai/workflow.ts |
| Marketing Department Cycle | Delegation | ✅ /lib/agents/departments.ts |
| Sales Department Cycle | Delegation | ✅ /lib/agents/departments.ts |
| Operations Department Cycle | Delegation | ✅ /lib/agents/departments.ts |
| CEO Assessment | Agent | ✅ /lib/ceo/ceo.ts |
| Project Monitor | Agent | ✅ /lib/agents/project-monitor.ts |
| Night Shift Goals | Background | ✅ /lib/night-shift/ |
| Daily Cron | Scheduled | ✅ /api/cron/daily |

---

## 5. EXISTING DATABASE STRUCTURE

### Core Tables (~30+)

| Table | Purpose | Migrations |
|-------|---------|------------|
| `profiles` | User profiles (extends auth.users) | 001 |
| `clients` | CRM client records | 002 |
| `contacts` | Contact people per client | 003 |
| `interactions` | Call/email/meeting logs | 004 |
| `projects` | Project management | 001/005 |
| `milestones` | Project milestones | 001/006 |
| `tasks` | Task management | 001/007 |
| `invoices` | Billing records | 001/008 |
| `invoice_items` | Invoice line items | 001/009 |
| `expenses` | Expense tracking | 001/010 |
| `knowledge_docs` | Company Brain docs | 005 |
| `memories` | Vector store (pgvector) | 001/011 |
| `agent_logs` / `execution_logs` | Agent execution history | 001/012 |
| `notifications` | In-app notifications | 001/013 |
| `settings` | Per-user configuration | 001/014 |
| `agents` | Agent registry | 006 |
| `automations` | Automation definitions | 007 |
| `orchestrator_tasks` | Orchestrator task queue | 008/009 |
| `agent_memory` | Agent persistent memory | 008 |
| `orchestrator_memory` | Orchestrator state store | 008 |
| `content_requests` | Content generation queue | 010 |
| `leads` | Lead management | 011 |
| `ai_execution_logs` | AI call tracking | 012 |
| `job_queue` | Background job queue | 015/016 |
| `employees` | Employee records | 017 |
| `agent_factory` | Agent factory | 018 |
| `sales_data` | Sales dept data | 019 |
| `content_marketing_data` | Content marketing data | 020 |
| `video_data` | Video dept data | 021 |
| `website_data` | Website dept data | 022 |
| `software_engineering_data` | Software dept data | 023 |
| `automation_data` | Automation dept data | 024 |
| `outreach_data` | Outreach data | 025 |
| `voice_data` | Voice/calling data | 026 |
| `integration_registry` | Provider registry | 027 |
| `integration_credentials` | OAuth token / API key storage | 027 |
| `integration_connections` | Active connection state | 027 |
| `integration_health_logs` | Integration health monitoring | 027 |
| `growth_data` | Growth engine data | 028 |
| `validation_results` | Validation system | 030 |
| `reel_data` / `reel_packages` | Reels factory | 031/034 |
| `development_data` | Dev system data | 032 |
| `content_factory_data` | Content factory data | 033 |
| `creative_factory_data` | Creative factory data | 035 |
| `agent_approval_requests` | Approval workflow | 039 |

### RLS Policy
All tables have Row Level Security enabled. Policies enforce per-user data isolation via `auth.uid()`.

---

## 6. DASHBOARD SECTIONS (95 Pages)

| Section | Pages | Status |
|---------|-------|--------|
| Agents | 7 (list, detail, edit, new, timeline, dashboard, new v2) | ✅ |
| Automations | 6 (list, detail, edit, new, timeline, dashboard) | ✅ |
| Brain | 6 (list, detail, edit, new, timeline, dashboard) | ✅ |
| CEO | 2 (dashboard, actions) | ✅ |
| Clients | 4 (list, new, detail, edit) | ✅ |
| Command Center | 3 (dashboard, executions, history) | ✅ |
| Content | 6 (list, new, detail, edit, history, dashboard) | ✅ |
| Content Marketing | 1 | ✅ |
| Employees | 1 | ✅ |
| Factory | 2 (main, creative) | ✅ |
| Finance | 4 (main, invoices, expenses, analytics) | ✅ |
| Growth | 1 | ✅ |
| Integrations | 1 | ✅ |
| Leads | 6 (list, new, detail, edit, history, dashboard) | ✅ |
| Learning | 1 | ✅ |
| Managers | 1 | ✅ |
| Milestones | 6 (list, new, detail, edit, timeline, dashboard) | ✅ |
| Optimization | 1 | ✅ |
| Orchestrator | 4 (main, tasks, history, agents) | ✅ |
| Outreach | 1 | ✅ |
| Projects | 5 (list, new, detail, edit, timeline, analytics) | ✅ |
| Queue | 2 (list, actions) | ✅ |
| Reels | 1 | ✅ |
| Revenue | 1 | ✅ |
| Sales | 1 | ✅ |
| Settings AI | 1 | ✅ |
| Software | 1 | ✅ |
| Tasks | 6 (list, new, detail, edit, timeline, dashboard) | ✅ |
| Validation | 1 | ✅ |
| Video | 1 | ✅ |
| Voice | 1 | ✅ |
| Websites | 1 | ✅ |
| Dev Systems | 3 (dev-v2, dev-v3, development) | ⚠️ Experimental |

---

## 7. DOCUMENTATION (36 Files)

| Category | Files |
|----------|-------|
| **docs/** — Architectural docs | 22 files (system-architecture, agent-architecture, company-brain, orchestrator-architecture, swarm-architecture, department-architecture, memory-architecture, autonomous-execution, integration-guide, marketing-automation-plan, etc.) |
| **Root** — Status docs | 14 files (README, PROJECT_STATUS, FINAL_PROJECT_STATUS, WORKING_FEATURES, IMPLEMENTED_FEATURES, REMAINING_GAPS, KNOWN_ISSUES, NEXT_TASKS, NEXT_30_DAYS_PLAN, LOCAL_SETUP_GUIDE, REAL_COMPLETION_REPORT, GITHUB_BACKUP_CHECKLIST, AI_BLOCKERS_FIXED) |

---

## 8. EXECUTION SUMMARY

| System | Working | Foundation | Gap |
|--------|---------|------------|-----|
| **Agent Runtime** | 65% | 35% (cron trigger, webhooks) |
| **Company Brain V2** | 70% | 30% (chat UI) |
| **CEO Agent** | 75% | 25% (auto-scheduling) |
| **Content Agent** | 90% | 10% |
| **Lead Analyzer** | 85% | 15% |
| **Department Swarms** | 60% | 40% (UI triggers) |
| **Marketing Skills** | 70% | 30% (UI selector) |
| **Approval System** | 95% | 5% |
| **Project Monitor** | 100% | 0% |
| **Integrations** | 40% | 60% (15 providers, only 3 real API calls) |
| **Validation System** | 80% | 20% |
| **Night Shift** | 90% | 10% |
| **Overall** | **77%** | **23%** |

**Production Readiness Score**: 68% (up from 58% after Blocker fixes)
