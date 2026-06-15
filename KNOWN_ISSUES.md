# KNOWN ISSUES

## Build Warnings (Non-blocking)

| Severity | File | Issue |
|---|---|---|
| Warn | `app/dashboard/page.tsx` | 3x `<img>` should be `<Image />` from next/image |
| Warn | `app/dashboard/content/page.tsx` | `<img>` should be `<Image />` |
| Warn | `components/integrations/FacebookPageSelector.tsx` | `<img>` should be `<Image />` |
| Warn | `app/dashboard/command-center/page.tsx` | `useEffect` missing dependency `loadData` |
| Warn | `app/dashboard/page.tsx` | `useEffect` missing dependency `loadData` |
| Warn | `lib/brain/embeddings.ts` | 3x `console.warn` for embedding fallback |
| Warn | 7 files | `prefer-const` — variables never reassigned |
| Warn | 5 files | `no-console` — unexpected console statements |

## Missing Features

| Priority | Area | Gap |
|---|---|---|
| P0 | AI Config | No UI to configure Ollama URL or API keys. Must insert into `ai_provider_configs` manually |
| P0 | Cron | No automated runtime tick. `runtime.tick()` must be called manually |
| P1 | Chat UI | Company Brain vector search has no human-facing chat interface |
| P1 | Auto-index | Knowledge docs aren't automatically vectorized into the `memories` table |
| P2 | Retry | Failed tasks are not retried automatically |
| P2 | Tests | Only 1 test file exists. No integration or E2E tests |

## Database

| Issue | Impact |
|---|---|
| Migration 039 must be run manually via Supabase SQL Editor | `agent_approval_requests` table won't exist otherwise |
| `memories` table has no trigger for auto-embedding | Memory entries must be stored via `storeMemories()` explicitly |

## Performance

| Concern | Mitigation |
|---|---|
| 110 pages, all dynamic except ~15 | Acceptable for an internal tool |
| No pagination on most list pages | Filtering exists but large datasets will slow |
| No query caching | Redis not configured — all queries hit PostgreSQL |
