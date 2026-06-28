# Deployment Plan — Production Go-Live

## Hosting Architecture

| Component | Service | Justification |
|-----------|---------|---------------|
| Frontend | Vercel (Next.js 14) | Optimal for Next.js, automatic SSR/ISR, global CDN |
| Database | Supabase (PostgreSQL) | Managed Postgres, RLS, real-time subscriptions |
| Auth | Supabase Auth | Built-in, handles sessions, row-level security |
| File Storage | Supabase Storage | S3-compatible, RLS integration, CDN |
| Cron | cron-job.org (or similar) | External cron trigger for /api/cron endpoints |
| DNS | Cloudflare (or Vercel) | Vercel domains managed automatically |

---

## Pre-Deployment Checklist

### Code Quality

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all tests passing (35+ tests)
- [ ] `npx next lint` — 0 errors
- [ ] `npx next build` — compiles successfully with no warnings
- [ ] `npm run build` — verifies full build pipeline

### Environment Variables

**Total: 31 environment variables required for production deployment.**

#### Supabase Section (3 vars)
| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key for server operations | ✅ |

#### App Section (2 vars)
| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | Production URL (e.g., `https://inlight.agency`) | ✅ |
| `NODE_ENV` | Set to `production` | ✅ |

#### OAuth Section (6 vars)
| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (Gmail, YouTube) | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth client ID | ✅ |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth client secret | ✅ |
| `FACEBOOK_CLIENT_ID` | Facebook OAuth client ID (FB, Instagram) | ✅ |
| `FACEBOOK_CLIENT_SECRET` | Facebook OAuth client secret | ✅ |

#### Content / Social API Section (3 vars)
| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | AI provider for all agent execution | ✅ |
| `ANTHROPIC_API_KEY` | Alternative AI provider | Optional |
| `GROQ_API_KEY` | Fast inference fallback | Optional |

#### Automation Providers Section (8 vars)
| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_SECRET_KEY` | Stripe payments | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe event verification | ✅ |
| `HUBSPOT_ACCESS_TOKEN` | CRM integration | Optional |
| `AIRTABLE_PAT` | Database sync | Optional |
| `N8N_API_KEY` | Workflow automation | Optional |
| `MAKE_API_KEY` | Workflow automation | Optional |
| `ELEVENLABS_API_KEY` | Voice synthesis | Optional |
| `SENDGRID_API_KEY` | Email sending fallback | Optional |

#### CRM / Finance Section (4 vars)
| Variable | Description | Required |
|----------|-------------|----------|
| `CALENDLY_CLIENT_ID` | Calendly OAuth | Optional |
| `CALENDLY_CLIENT_SECRET` | Calendly OAuth | Optional |
| `SALESFORCE_CLIENT_ID` | Salesforce OAuth | Optional |
| `SALESFORCE_CLIENT_SECRET` | Salesforce OAuth | Optional |

#### Messaging Section (3 vars)
| Variable | Description | Required |
|----------|-------------|----------|
| `SLACK_BOT_TOKEN` | Team notifications | Optional |
| `DISCORD_BOT_TOKEN` | Community management | Optional |
| `TELEGRAM_BOT_TOKEN` | Broadcast messaging | Optional |

#### Workflow Section (4 vars)
| Variable | Description | Required |
|----------|-------------|----------|
| `N8N_WEBHOOK_URL` | n8n webhook endpoint | Optional |
| `MAKE_WEBHOOK_URL` | Make.com webhook endpoint | Optional |
| `TWILIO_ACCOUNT_SID` | SMS / voice | Optional |
| `TWILIO_AUTH_TOKEN` | SMS / voice auth | Optional |

### Database

- [ ] Run ALL 49 migrations via `supabase db push`
- [ ] Verify RLS policies enabled on ALL tables (auth.users, profiles, company_state, agent_memory, execution_logs, etc.)
- [ ] Verify seed data exists (test user, sample agents, company config)
- [ ] Enable point-in-time recovery in Supabase project settings
- [ ] Enable SSL enforcement for database connections

### CI/CD Pipeline

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx next lint
      - run: npx vitest run
      - run: npx next build

  deploy:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  backup:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          pg_dump $SUPABASE_DATABASE_URL > backup_$(date +%Y%m%d).sql
        env:
          SUPABASE_DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
      - uses: actions/upload-artifact@v4
        with:
          name: db-backup
          path: backup_*.sql
```

Create `.github/workflows/backup.yml` for weekly database backup:

```yaml
name: Weekly Database Backup

on:
  schedule:
    - cron: '0 3 * * 0'  # Every Sunday at 3 AM

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pg_dump --no-owner --no-acl ${{ secrets.SUPABASE_DATABASE_URL }} | gzip > supabase-backup-$(date +%Y-%m-%d).sql.gz
      - uses: actions/upload-artifact@v4
        with:
          name: supabase-backup-$(date +%Y-%m-%d)
          path: supabase-backup-*.sql.gz
          retention-days: 30
```

### Vercel Configuration

- [ ] Set all 31 environment variables in Vercel project dashboard
- [ ] Configure custom domain (`inlight.agency` or similar)
- [ ] Enable automatic HTTPS
- [ ] Set VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID in GitHub Secrets

---

## Rollback Strategy

### Frontend (Vercel)
1. Go to Vercel Dashboard → Deployments
2. Find the last known-good deployment
3. Click "..." → "Promote to Production"
4. Rollback is instant — previous deployment is already cached on CDN

### Database (Supabase)
1. Go to Supabase Dashboard → Database → Backups
2. Select a point-in-time before the incident
3. Click "Restore" — creates a new database branch
4. Update `NEXT_PUBLIC_SUPABASE_URL` to point to restored branch
5. Verify data integrity, then promote to production

### Code (Git)
1. `git log --oneline` to find the last good commit on `main`
2. `git revert HEAD~N` where N is commits to roll back
3. Push to `main` — CI/CD automatically deploys reverted code
4. Alternatively: `git reset --hard <good-sha>` and `git push --force` (use with caution)

### Emergency Runbook
| Scenario | Action | RTO |
|----------|--------|-----|
| Broken deployment | Vercel rollback to previous | 1 minute |
| Database corruption | Supabase PITR restore | 10 minutes |
| Security incident | Rotate all env vars + redeploy | 15 minutes |
| Data loss | Restore from latest backup artifact | 20 minutes |
| DNS / domain issue | Cloudflare dashboard → DNS records | 5 minutes |
