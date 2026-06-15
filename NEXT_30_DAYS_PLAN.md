# NEXT 30 DAYS PLAN

## Week 1: Company Brain V2 Launch
| Day | Task |
|---|---|
| 1-2 | Build Chat UI: `app/dashboard/brain/chat/page.tsx` — natural language query to `/api/brain/query` |
| 3-4 | Build auto-indexer: `lib/brain/indexer.ts` — trigger on knowledge doc create/update |
| 5 | Build AI Provider Config UI: `app/dashboard/settings/ai/page.tsx` — form to set Ollama URL, API keys |
| 6-7 | Build cron hook: `app/api/cron/agent-runtime/route.ts` — automatic runtime.tick() every 15 min |

## Week 2: Agent UI & Approvals
| Day | Task |
|---|---|
| 8-9 | Build approvals page: `app/dashboard/orchestrator/approvals/page.tsx` |
| 10-11 | Enhance agent dashboard: `app/dashboard/agents/dashboard/page.tsx` — health cards, performance trends |
| 12 | Add retry logic: update `lib/agents/runtime.ts` — 3 retries before marking failed |
| 13-14 | Build department run triggers in orchestrator page |

## Week 3: Analytics & Export
| Day | Task |
|---|---|
| 15-16 | Build performance trend charts: `app/dashboard/learning/page.tsx` |
| 17-18 | Add CSV export to clients, projects, leads, finance pages |
| 19-20 | Build lead analyzer dashboard: `app/dashboard/leads/dashboard/page.tsx` |
| 21 | Enhance finance analytics with charts |

## Week 4: Testing & Polish
| Day | Task |
|---|---|
| 22-23 | Write unit tests for runtime, approval, project-monitor |
| 24 | Write integration test: agent execution → memory → logs |
| 25 | Performance profiling: identify slow queries, add indexes |
| 26-27 | Fix all ESLint warnings (console.log → logger, prefer-const) |
| 28-30 | Deploy to Vercel, verify production, create user docs |

## Quick Wins (Any Day)
- [ ] Remove console.warn from `lib/brain/embeddings.ts` → use silent fallback
- [ ] Add loading states to all server-action forms
- [ ] Fix `<img>` → `<Image />` in `app/dashboard/page.tsx`
- [ ] Fix `react-hooks/exhaustive-deps` warnings in command-center and dashboard
