## Monitoring Setup Guide

### Prerequisites
- Sentry account (free tier at sentry.io)
- Langfuse account (free tier at langfuse.com)

### Step 1: Install Dependencies
```bash
npm install @sentry/nextjs
npm install langfuse
```

### Step 2: Configure Sentry
1. Create project in Sentry dashboard
2. Copy DSN
3. Add to .env.local:
```
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.us.sentry.io/xxx
SENTRY_DSN=https://xxx@xxx.ingest.us.sentry.io/xxx
```

### Step 3: Configure Langfuse
1. Create account at langfuse.com
2. Create project, get API keys
3. Add to .env.local:
```
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

### Step 4: Verify
1. Visit /api/health — should return JSON with all checks
2. Trigger an error — should appear in Sentry
3. Run an AI task — should appear in Langfuse

### Step 5: Configure Alerts
- Sentry: Alert on >5 errors in 5 minutes
- Langfuse: Alert on >30s average latency
- Slack/Email: Configure notification channels
