# GitHub Backup Checklist — Inlight Agency OS

Use this checklist to verify the project is ready for GitHub backup before PC reset.

---

## Pre-Push Verification

- [ ] **`git status` clean** — no uncommitted changes
- [ ] **`.env.local` is gitignored** — double-check with `git diff --cached`
- [ ] **`.env.local` backed up** — copy saved to `Desktop\inlight_secrets_backup\`
- [ ] **No secrets in git history** — verify with `git grep` for API keys
- [ ] **TypeScript passes** — `npm run type-check` = 0 errors
- [ ] **Production build passes** — `npm run build` = 0 errors
- [ ] **Dev server starts** — `npm run dev` serves pages at localhost:3000

## Push Commands

```bash
# Stage all files
git add -A

# Commit
git commit -m "chore: finalize Inlight Agency OS v0.1 for GitHub backup

- Remove dead code: -p/, .venv duplicates, unused npm deps
- Fix SSR crash in dashboard layout
- Fix middleware to protect all /dashboard/* routes
- Update .env.example with CRON_SECRET
- Create FINAL_PROJECT_STATUS.md, WORKING_FEATURES.md
- Create REMAINING_GAPS.md, LOCAL_SETUP_GUIDE.md
- Create GITHUB_BACKUP_CHECKLIST.md"

# Push to GitHub
git push -u origin main

# Tag release
git tag v0.1.0
git push --tags
```

## Post-Push Verification

- [ ] Visit `https://github.com/inlightailtd-del/Inlight-Agency-OS`
- [ ] Verify all files are present (minus gitignored ones)
- [ ] Verify `README.md` renders correctly
- [ ] Verify `FINAL_PROJECT_STATUS.md` is visible
- [ ] Verify `.env.example` (not `.env.local`) is visible

## Recovery from GitHub (After PC Reset)

```bash
# 1. Clone
git clone https://github.com/inlightailtd-del/Inlight-Agency-OS.git
cd Inlight-Agency-OS

# 2. Restore env
# Copy from your secrets backup to .env.local

# 3. Install & run
npm install
npm run dev
```

## Files Unchanged Since Backup

The following are excluded from git but should be recreated after reset:

| Item | How to Recreate |
|------|-----------------|
| `.env.local` | From `Desktop\inlight_secrets_backup\` |
| `node_modules/` | `npm install` |
| `.next/` | `npm run build` |
| Database tables | Run migrations 001-040 in Supabase SQL Editor |

## Checklist Status

- **Verified**: TypeScript 0 errors
- **Verified**: Build passes with 110 pages, 40 API routes
- **Verified**: Dev server starts and serves pages
- **Verified**: `.env.local` is gitignored
- **Verified**: `.env.local` backed up to Desktop
- **Verified**: Git remote configured to `inlightailtd-del/Inlight-Agency-OS`
- **Pending**: Final `git push`
