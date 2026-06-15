# Inlight Agency — First Autonomous Workflows

## How Autonomous Execution Works

Every Inlight Agency user gets schedules registered in `orchestrator_memory`:

```
Schedule 1: Project Monitor → Every 2 hours
Schedule 2: CEO Assessment → Every 4 hours
External Cron: GET /api/cron/daily → Every hour (uses CRON_SECRET)
```

The **daily cron** triggers three things per user:
1. `runDailyGrowthExecution()` — content generation, social publishing, email, leads, KPIs
2. `runtime.tick({ maxTasks: 10 })` — drains the orchestrator queue (processes all pending tasks)
3. CEO assessment check — enqueues if enough time has passed

## First CEO Assessment

**When**: Triggered immediately after setup (task created), then every 4 hours

**What happens**:
1. `runCeoAssessment()` gathers: active projects, pending tasks, content requests, leads, recent memories
2. AI analyzes system state and generates: summary, 2-4 insights, 1-3 concrete decisions
3. Decisions are automatically executed: tasks created, workflows launched, content requests made
4. Assessment stored in `agent_memory` as `ceo_assessment`
5. All actions logged to `execution_logs`

## Content Marketing Engine

### Inlight Weekly Content Engine (3-step workflow)

**Trigger**: Manual or scheduled

**Step 1 — Topic Research** (Research agent)
- Scans trends for AI agency topics
- Identifies 10-15 high-potential topics
- Ranks by engagement potential

**Step 2 — Content Planning** (Content agent)
- Creates 7-day content plan across LinkedIn, Blog, Twitter, Newsletter
- Mix of formats: posts, articles, threads, emails
- Specific hooks and CTAs per piece

**Step 3 — Content Writing** (Content agent)
- Writes full content for each piece
- Follows Inlight brand voice
- Platform-optimized formatting

**Output**: Full week of publish-ready content

### Inlight Content Marketing Engine (3-step workflow)

**Step 1 — Strategy**: 30-day content marketing strategy including pillars, channels, formats, KPIs
**Step 2 — Production**: Content calendar + 3 full pieces (LinkedIn post, blog intro, newsletter draft)
**Step 3 — Distribution**: Publishing schedule, cross-promotion, monitoring, reporting template

## Lead Generation Pipeline

### Inlight Lead Pipeline (3-step workflow)

**Step 1 — Market Segmentation**: Identify target segments, their communities, language, pain points
**Step 2 — Lead Sourcing**: LinkedIn groups, hashtags, search terms, prospect signals, outreach templates
**Step 3 — Lead Scoring**: Qualification framework with scoring criteria, thresholds, next-action rules

## Project Monitor (runs every 2 hours)

**Automatic checks for every active project**:
1. Overdue critical tasks → creates warning/critical tasks
2. Milestones due within 7 days → creates warning
3. Budget >80% or >100% consumed → creates warning/critical tasks
4. Health score ≤50 or ≤30 → creates warning/critical tasks
5. No updates for 7+ days → creates warning/critical tasks

**Critical findings** generate a DelegationPlan for automated remediation.

## Approval Workflow

When an agent needs approval (configured by action type + agent autonomy level):

1. Agent detects action is high-risk (delete, budget change, client email)
2. `checkAutonomy()` returns `needs_approval`
3. Request inserted into `agent_approval_requests` (status: pending)
4. Task paused until human reviews
5. User sees approval in orchestrator dashboard
6. Approve → task resumes. Reject → task marked as failed.
7. Decision logged to `execution_logs`

## Sample Autonomous Day

```
00:00 — Daily cron runs
  ├─ Growth execution generates content
  ├─ Runtime tick processes pending tasks
  └─ CEO assessment check (runs if 4h since last)
  
02:00 — Project Monitor scans projects
  └─ Creates remediation tasks for any risks found
      (tasks picked up by next runtime tick)

04:00 — Daily cron runs
  ├─ Growth execution (skips if already ran)
  ├─ Runtime tick
  └─ CEO assessment (runs if 4h since last)

06:00 — Project Monitor scans projects
  └─ ... (cycle continues)
```
