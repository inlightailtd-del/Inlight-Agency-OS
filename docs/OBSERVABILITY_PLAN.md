# Observability Plan — Monitoring & Alerting

## Current State

| Aspect | Status | Notes |
|--------|--------|-------|
| Error tracking | ❌ None | No Sentry, no error aggregation |
| Logging | ⚠️ Basic | `console.log` statements only, no structured logging |
| APM | ❌ None | No performance monitoring, no traces |
| Uptime monitoring | ❌ None | No external uptime checks |
| Execution tracking | ✅ Built-in | `execution_logs` table in Supabase |
| Health endpoint | ⚠️ Partial | Some health status endpoints exist |
| Alerting | ❌ None | No PagerDuty, Slack alerts, or email notifications |
| Agent tracing | ❌ None | No LLM call traces or token tracking |

---

## Phase 1: Error Tracking (Sentry)

### Installation
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

### Configuration Files

**sentry.client.config.ts**
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

**sentry.server.config.ts**
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV,
});
```

**sentry.edge.config.ts**
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV,
});
```

### Setup Steps
1. Create Sentry account and project at `sentry.io`
2. Copy the DSN to `SENTRY_DSN` environment variable
3. Run Sentry wizard to patch Next.js config
4. Deploy — Sentry automatically captures unhandled errors
5. Set up alert rules: error rate > 5% in 5 minutes → Slack notification

### Key Metrics to Track
| Metric | Threshold | Action |
|--------|-----------|--------|
| Error count | > 10 / hour | Investigate top errors |
| Crash-free rate | < 99.5% | Rollback deployment |
| API error rate | > 5% | Check provider status |
| Client-side errors | > 100 / hour | Check browser compatibility |

---

## Phase 2: LLM Observability (Langfuse)

### Installation
```bash
npm install langfuse
```

### Wrapper: `lib/observability/langfuse.ts`
```typescript
import Langfuse from 'langfuse';

const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

export function createTrace(name: string, metadata?: Record<string, unknown>) {
  return langfuse.trace({ name, metadata });
}

export function createGeneration(
  trace: ReturnType<typeof langfuse.trace>,
  params: {
    name: string;
    model: string;
    prompt: string;
    completion: string;
    promptTokens: number;
    completionTokens: number;
    latency: number;
  }
) {
  return trace.generation({
    name: params.name,
    model: params.model,
    input: params.prompt,
    output: params.completion,
    usage: {
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.promptTokens + params.completionTokens,
    },
    latency: params.latency,
  });
}
```

### Instrumenting Agent Execution

In `lib/agents/executeAgentTask.ts`, wrap each LLM call:

```typescript
import { createTrace, createGeneration } from '@/lib/observability/langfuse';

export async function executeAgentTask(params: ExecuteAgentTaskParams) {
  const trace = createTrace(`agent:${params.agentId}`, {
    phase: params.phase,
    task: params.task,
  });

  const startTime = Date.now();
  const response = await callLLM(params); // existing LLM call
  const latency = Date.now() - startTime;

  createGeneration(trace, {
    name: `execute_${params.agentId}`,
    model: 'gpt-4o', // or current model
    prompt: params.task,
    completion: response.content,
    promptTokens: response.usage?.promptTokens ?? 0,
    completionTokens: response.usage?.completionTokens ?? 0,
    latency,
  });

  return response;
}
```

### Langfuse Dashboard Tracks
- **Prompt tokens per agent** — which agents consume the most tokens
- **Completion tokens per agent** — which agents produce the most output
- **Latency per agent** — which agents are slowest
- **Model usage** — distribution across models
- **Cost per cycle** — estimated cost per autonomous company cycle
- **Error rate per agent** — which agents fail most

### Alert Rules
| Metric | Threshold | Action |
|--------|-----------|--------|
| Cost per day | > $10 | Review prompt optimization |
| Latency p95 | > 30s | Check model, reduce context |
| Error rate | > 10% | Investigate agent prompt |
| Token waste | > 50% on system prompts | Optimize system prompt length |

---

## Phase 3: Health Dashboard

### Endpoint: `GET /api/health`

Create a comprehensive health endpoint:

```typescript
// pages/api/health.ts
export default async function handler(req, res) {
  const checks = {
    database: await checkDatabase(),
    supabase: await checkSupabase(),
    lastCronRun: await getLastCronRun(),
    queueDepth: await getQueueDepth(),
    executionSuccessRate: await getExecutionSuccessRate(),
    nightShiftDaemon: await getDaemonStatus(),
    providerHealth: await checkProviders(),
    systemVersion: process.env.NEXT_PUBLIC_VERSION || '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  res.status(allHealthy ? 200 : 503).json(checks);
}
```

### Health Check Fields

| Field | Type | Description |
|-------|------|-------------|
| `database` | object | PostgreSQL connection status, response time |
| `supabase` | object | Supabase client status, auth service reachable |
| `lastCronRun` | string | ISO timestamp of last scheduled job execution |
| `queueDepth` | number | Number of pending executions in queue |
| `executionSuccessRate` | number | Percentage of successful executions in last 24h |
| `nightShiftDaemon` | string | Running / Stopped / Unknown |
| `providerHealth` | object | Status of each configured provider (connected / disconnected / error) |
| `systemVersion` | string | Git commit SHA or version tag |
| `uptime` | number | Server process uptime in seconds |

### External Uptime Monitoring
- **Service:** UptimeRobot, Better Uptime, or Pingdom
- **Check interval:** 5 minutes
- **Endpoint:** `https://inlight.agency/api/health`
- **Expected status:** 200
- **Alert:** Email + Slack if 3 consecutive failures

---

## Phase 4: Metrics & Alerting

### Metrics to Collect

| Metric | Source | Collection Method | Retention |
|--------|--------|-------------------|-----------|
| Execution success rate | `execution_logs` table | SQL query on Supabase | 90 days |
| Queue depth | Company state | In-memory / DB read | Instant |
| Daemon status | Process manager | Health check endpoint | Instant |
| Auth failure rate | Supabase Auth logs | API call | 30 days |
| Build status | GitHub Actions | API call | 30 days |
| API response times | Next.js server logs | Custom metric | 7 days |
| Provider availability | Provider health check | Cron job | 30 days |

### Alert Rules

| Rule | Condition | Severity | Notification |
|------|-----------|----------|-------------|
| Execution success rate critical | Rate < 80% in 1 hour | 🔴 Critical | Email + Slack |
| High queue depth | Queue > 100 items | 🟡 Warning | Slack |
| Daemon stopped | Night shift not running | 🔴 Critical | Email + Slack + SMS |
| Auth failure spike | Failure rate > 10% in 5 min | 🔴 Critical | Email + Slack |
| Build failure | CI pipeline fails | 🟡 Warning | Slack |
| High API error rate | Provider errors > 20% | 🟡 Warning | Slack |
| Database connection failure | DB unreachable | 🔴 Critical | Email + Slack + SMS |
| Cron job missed | No cron run in > 1 hour | 🟡 Warning | Slack |

### Alert Channels

| Channel | Critical | Warning | Info |
|---------|----------|---------|------|
| Slack (`#alerts`) | ✅ | ✅ | ✅ |
| Email (Hamza) | ✅ | ✅ | ❌ |
| SMS (via Twilio) | ✅ | ❌ | ❌ |
| Sentry dashboard | ✅ | ✅ | ✅ |

### Implementation Timeline

| Phase | What | Effort | When |
|-------|------|--------|------|
| Phase 1 | Sentry error tracking | 2 hours | Before go-live |
| Phase 2 | Langfuse LLM observability | 4 hours | Week 1 post-launch |
| Phase 3 | Health dashboard endpoint | 3 hours | Before go-live |
| Phase 4 | Metrics & alerting | 4 hours | Week 2 post-launch |
| Phase 5 | Uptime monitoring service | 1 hour | Before go-live |
| Phase 6 | Dashboard UI for metrics | 8 hours | Week 3 post-launch |
