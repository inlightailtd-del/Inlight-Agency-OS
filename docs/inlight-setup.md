# Inlight Agency — Platform Onboarding & Company Setup

## Endpoint

`POST /api/inlight/setup` — authenticated one-shot setup for any user.

## What It Creates

### 1. Six AI Agents

| Agent | Type | Role |
|---|---|---|
| Inlight CEO | `ceo` | Company oversight, KPIs, strategy, department coordination |
| Inlight Content | `content` | Blog, social media, email, landing page production |
| Inlight Sales | `sales` | Lead scoring, pipeline management, opportunity detection |
| Inlight Marketing | `marketing` | Campaigns, content distribution, channel optimization |
| Inlight Automation | `automation` | Operations, queue processing, project monitoring |
| Inlight Research | `research` | Market intelligence, competitor analysis, trend detection |

All agents configured with:
- Department assignments
- Performance baselines (70-85)
- Autonomy levels (2-3)
- Skills loaded from Marketing Skills System
- Event subscriptions (for Automation + CEO agents)

### 2. Knowledge Base (5 Documents)

| Document | Category | Department |
|---|---|---|
| Service Catalog | Guide | Sales |
| Brand Voice & Messaging | Guide | Marketing |
| Q3 2026 Content Strategy | SOP | Marketing |
| Target Client Profiles | Wiki | Sales |
| Competitive Positioning | Wiki | Marketing |

### 3. Marketing Goals (5 Goals)

| Goal | Target | Timeframe |
|---|---|---|
| Content Volume | 100 pieces | Quarterly |
| Lead Generation | 150 leads | Quarterly |
| LinkedIn Audience | 5,000 followers | Quarterly |
| Monthly Revenue | PKR 50,000 | Monthly |
| Weekly Publishing | 7 pieces | Weekly |

All stored in `agent_memory` as `goal` category for CEO agent access.

### 4. Service Catalog (5 Services)

| Service | Base Price |
|---|---|
| AI Agency OS Platform | PKR 50,000 |
| Agent Development | PKR 150,000 |
| Content Factory Setup | PKR 100,000 |
| Agency Automation Audit | PKR 75,000 |
| AI Strategy Consulting | PKR 50,000 |

### 5. Autonomous Schedules (2 Schedules)

| Schedule | Agent | Interval |
|---|---|---|
| Project Monitor | Inlight Automation | Every 2 hours |
| CEO Assessment | Inlight CEO | Every 4 hours |

### 6. First Task

Creates an initial orchestrator task: `Inlight Agency — First CEO Assessment` (high priority) to kickstart autonomous operation.

## How to Use

```bash
# After signing up and logging in, run:
curl -X POST http://localhost:3000/api/inlight/setup \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>"
```

Or navigate to the orchestrator dashboard and trigger from the UI.

## Inlight-Specific Workflows (3 new + 6 existing)

| Workflow | Steps | Purpose |
|---|---|---|
| Inlight Weekly Content Engine | Research → Plan → Write | Generates a full week of Inlight content |
| Inlight Lead Pipeline | Segment → Source → Score | End-to-end lead generation for Inlight |
| Inlight Content Marketing | Strategy → Produce → Distribute | Complete content marketing lifecycle |
| Agency Growth (existing) | CEO → Sales → Marketing → Finance | Scale your agency |
| Marketing Strategy (existing) | Marketing → Research → Content | Full marketing strategy |
| Lead Generation (existing) | Research → Sales → Automation | Generic lead pipeline |
| Client Proposal (existing) | Research → Sales → Content | Win proposals |
| SEO Strategy (existing) | Research → SEO → Content | SEO roadmap |
| SaaS Builder (existing) | CEO → Research → Marketing → Content | SaaS business plan |

## System Configuration

- **CEO Scheduler**: Enabled, runs every 2 hours
- **Daily Cron**: Runs growth execution + agent runtime tick
- **Project Monitor**: Scans projects every 2 hours for risks
- **Approval Gate**: High-impact actions (delete, budget change, client comms) require human approval
- **Company Brain**: Auto-indexes knowledge docs on create/update
