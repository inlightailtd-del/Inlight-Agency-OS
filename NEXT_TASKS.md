# NEXT TASKS

Priority-ordered list of what to build next.

## P0 — Critical Path (Build Now)

### 1. Company Brain V2 — Vector Chat Interface
- **File**: `app/dashboard/brain/chat/page.tsx`
- **What**: Chat UI that queries `/api/brain/query` with natural language, shows context block
- **Why**: The vector search API exists but has no human-facing UI
- **Reuses**: `lib/brain/context.ts`, `lib/brain/embeddings.ts`, `/api/brain/query`

### 2. Agent Runtime — Cron Hook
- **File**: `app/api/cron/agent-runtime/route.ts`
- **What**: A cron endpoint that calls `runtime.tick()` every 15 minutes
- **Why**: The runtime loop exists but nothing triggers it automatically
- **Reuses**: `lib/agents/runtime.ts`, existing cron infra

### 3. AI Provider Config UI
- **File**: `app/dashboard/settings/ai/page.tsx`
- **What**: UI to configure AI provider (Ollama URL, OpenAI/Anthropic API keys)
- **Why**: Currently hardcoded → requires `ai_provider_configs` table interaction
- **Reuses**: `lib/ai/provider.ts`, `lib/ai/execution.ts`

## P1 — High Value

### 4. Agent Health Dashboard
- **File**: `app/dashboard/agents/dashboard/page.tsx`
- **What**: Real-time agent health cards, execution history, performance trends
- **Why**: Currently a basic table — needs richer data viz

### 5. Approval Requests Page
- **File**: `app/dashboard/orchestrator/approvals/page.tsx`
- **What**: Dedicated page for pending approvals with approve/reject inline
- **Why**: Currently embedded in orchestrator page — needs dedicated view

### 6. Company Brain Auto-Indexing
- **File**: `lib/brain/indexer.ts`
- **What**: Auto-index knowledge_docs into `memories` table on create/update via Supabase trigger or server action
- **Why**: Knowledge docs are stored but not automatically vectorized

## P2 — Growth

### 7. Lead Analyzer Dashboard
- **File**: `app/dashboard/leads/dashboard/page.tsx` (enhance)
- **What**: Lead scores over time, opportunity pipeline, batch scoring trigger

### 8. Marketing Skills UI
- **File**: `app/dashboard/agents/[id]/edit/page.tsx` (enhance)
- **What**: Skill selector when editing agents, shows available marketing skills

### 9. Department Run Triggers
- **File**: `app/dashboard/orchestrator/page.tsx` (enhance)
- **What**: "Run Marketing Cycle", "Run Sales Cycle" buttons that call `runDepartment()`

## P3 — Polish

### 10. Agent Retry Logic
- **Where**: `lib/agents/runtime.ts`
- **What**: Retry failed tasks up to 3 times before marking as failed

### 11. Email Notifications for Approvals
- **Where**: New integration
- **What**: When an approval request is created, send email notification

### 12. Performance Trend Charts
- **Where**: `app/dashboard/learning/page.tsx`
- **What**: Agent performance over time, success rate trends
