# Inlight Agency — Marketing Automation Plan

## Current State

Inlight Agency has:
- ✅ 6 AI agents configured for marketing operations
- ✅ 3 Inlight-specific content/lead workflows
- ✅ Knowledge base with brand voice, content strategy, and competitive positioning
- ✅ Daily cron for autonomous execution
- ✅ Project monitor scanning every 2 hours
- ✅ Company Brain with auto-indexing

## Phase 1: Content Engine (Week 1)

### Daily Autonomous Execution

| Time | Action | System |
|---|---|---|
| Every 2h | Project Monitor scans for risks | `lib/agents/project-monitor.ts` |
| Every 4h | CEO assessment + task generation | `lib/ceo/ceo.ts` |
| Every 1h | Runtime tick drains task queue | `lib/agents/runtime.ts` |

### Manual Workflow Runs (Daily)

Start each day by running:
1. **Inlight Weekly Content Engine** → generates week's content
2. **Inlight Content Marketing** → strategy + first pieces
3. Review project monitor findings → approve/reject

### Content Distribution

Once content is generated:
- Blog posts go to `content_requests` table (status: draft)
- Social posts ready for LinkedIn/Twitter publishing
- Newsletter drafts for email campaign

**Current limitation**: Publishing requires connected social providers (LinkedIn OAuth, Gmail API). Content is generated and stored — publishing is manual until OAuth is configured.

## Phase 2: Lead Pipeline (Week 2)

### Workflow Execution

1. Run **Inlight Lead Pipeline** workflow
2. Output: segmented market, lead sources, scoring framework
3. Manual: apply scoring to existing leads in the system
4. Manual: execute outreach per the generated templates

**Current limitation**: Lead scoring is AI-powered but requires existing leads in the database. No automated lead sourcing from external platforms is wired.

## Phase 3: Measurement (Week 3)

### KPI Tracking (already built)

```typescript
// lib/execution/kpi.ts — runs daily, tracks:
- Projects completed
- Tasks completed
- Revenue (invoiced, paid, overdue)
- Expenses
- Leads scored/converted
- Content generated/published
- Agent performance
```

### Reporting

- CEO assessment includes key metrics summary
- Performance agent (`lib/agents/wrappers.ts`) generates optimization reports
- Daily cron logs execution results with timing

## Phase 4: Optimization (Week 4)

### What to Optimize

| Metric | Current | Target |
|---|---|---|
| Content pieces/week | 0 (manual) | 7 (autonomous) |
| Lead scoring | Manual | Automated via Lead Analyzer |
| CEO assessments | On-demand | Every 4 hours |
| Project monitoring | Every 2 hours | Continuous |
| Agent autonomy | Level 2-3 | Level 3-4 (as performance improves) |

### Agent Performance Growth

Agents start at Level 1-2 autonomy. As they complete tasks successfully:
- Performance score increases
- Autonomy level increases
- Less human approval needed
- More actions executed autonomously

## Automation Checklist

### Must be configured outside code

- [ ] **CRON_SECRET environment variable** — set a random string, configure cron-job.org to call `/api/cron/daily` with `Authorization: Bearer <secret>` every hour
- [ ] **AI Provider** — go to Settings → AI, select provider (Ollama for local, OpenAI/Anthropic for cloud), enter API key if needed
- [ ] **Migration 040** — run `supabase/migrations/040_search_memories.sql` in Supabase SQL Editor for vector search
- [ ] **LinkedIn OAuth** — configure in integrations for social publishing
- [ ] **Gmail OAuth** — configure for email outreach

### Built and ready

- [x] 6 agents configured for Inlight
- [x] 5 knowledge documents loaded
- [x] 3 Inlight-specific workflows
- [x] 5 marketing goals set
- [x] Service catalog defined
- [x] CEO scheduler enabled (2h)
- [x] Project monitor scheduled (2h)
- [x] First CEO assessment task created
- [x] Autonomous runtime wired to daily cron

## Expected Outcomes (30 Days)

| Metric | Target |
|---|---|
| Content pieces generated | 60+ |
| Qualified leads scored | 50+ |
| CEO assessments completed | 180+ |
| Project monitor cycles | 360+ |
| Runtime tasks executed | 1,000+ |
| Agent performance improvement | +5-10% |
