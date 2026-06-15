# Remaining Gaps — Inlight Agency OS

These are **known gaps** that don't block local operation or GitHub backup. They can be addressed post-reset.

---

## Security & Configuration

| Gap | Impact | Workaround |
|-----|--------|------------|
| `CRON_SECRET` not actually set in `.env.local` | `/api/cron/daily` endpoint is unauthenticated locally | Set it for production use |
| Supabase service role key in `.env.local` is live | Anyone with this can do admin operations | Rotate key if compromised |

## Code Quality

| Gap | Impact |
|-----|--------|
| `useEffect` missing dependency `loadData` in 2 files (command-center, dashboard) | Stale closures possible |
| `<img>` instead of `<Image />` in 3 pages | Slower LCP, no Next.js image optimization |
| `let` should be `const` in 5+ places | Minor lint issues |
| `console.warn/log` statements in production code | Console noise |

## Features Not Built

| Feature | Priority | Notes |
|---------|----------|-------|
| Interactive Brain Chat UI | Medium | Vector search works; no human-facing chat |
| Automated cron scheduler | Medium | `/api/cron/daily` ready; needs external trigger |
| Agent retry logic | Low | Failed tasks require manual re-run |
| Unit/integration tests | Medium | Only 1 test file for ~120 lib files |
| Pagination on list pages | Low | Large datasets will be slow |
| Multi-tenant org isolation | Low | Per-user only, not per-organization |

## Dead/Experimental Code (Intentionally Kept)

| System | Reason Kept |
|--------|-------------|
| `lib/dev-v2/`, `lib/dev-v3/` | Experimental auto-dev systems; may be valuable reference |
| `app/dashboard/dev-v2/`, `app/dashboard/dev-v3/` | Corresponding UIs |
| `app/api/dev-v2/`, `app/api/dev-v3/` | Corresponding API routes |

These are **not harmful** — they compile, build, and run without errors. They can be removed later when the development system direction is finalized.

## Documentation Gaps

| Gap | Impact |
|-----|--------|
| `docs/` folder contains aspirational enterprise architecture (Kubernetes, 12 microservices) | Misleading for new developers |
| Some `docs/` describes features that don't exist yet | Read with skepticism; trust the code |

## Production Readiness

| Category | Score |
|----------|-------|
| TypeScript compilation | 100% |
| Production build | 100% |
| Authentication & RLS | 100% |
| AI Provider Layer | 95% |
| Agent Runtime | 70% |
| Error handling | 65% |
| Automated execution | 20% (manual only) |
| Testing coverage | <1% |
| **Overall** | **~70%** |
