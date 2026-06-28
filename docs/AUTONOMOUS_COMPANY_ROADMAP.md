# Autonomous Company Roadmap — Phase 15 Status

## Current Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Orchestrator Loop                   │
│  Phase 1 → Phase 2 → ... → Phase 10 → Report → Loop │
└──────────────┬──────────────┬───────────────────────┘
               │              │
     ┌─────────▼──────┐  ┌───▼──────────────┐
     │  10 Agents     │  │  Approval System │
     │  CEO           │  │  pending_approval │
     │  CTO           │  │  onPendingApproval│
     │  CMO           │  │  approve/reject   │
     │  COO           │  └──────────────────┘
     │  Sales         │
     │  Developer     │  ┌──────────────────┐
     │  Media Buyer   │  │  Memory System   │
     │  Designer      │  │  agent_memory     │
     │  Video Editor  │  │  cycle_results    │
     │  Support       │  └──────────────────┘
     └────────────────┘
```

### Agent Roles

| Agent | Role | Key Actions |
|-------|------|-------------|
| CEO | Strategic leadership | Set vision, make strategic decisions, allocate budget |
| CTO | Technical leadership | Architecture decisions, technology stack, infrastructure |
| CMO | Marketing leadership | Content strategy, campaign planning, brand management |
| COO | Operations leadership | Process optimization, resource allocation, hiring |
| Sales | Revenue generation | Lead generation, outreach, pipeline management |
| Developer | Implementation | Code development, deployment, technical tasks |
| Media Buyer | Advertising | Campaign management, ad spend optimization, audience targeting |
| Designer | Visual creation | Design assets, brand materials, creative direction |
| Video Editor | Video production | Video creation, editing, content repurposing |
| Support | Customer service | Issue resolution, customer communication, feedback |

---

## What Works Today

### System Architecture ✅
- All 10 agents constructed and wired into the orchestrator
- Full cycle executes all 10 phases with graceful fallbacks
- Error isolation — one agent failure doesn't break the loop
- Phase-based execution with dependency management
- Configurable phase skipping on failure

### Approval System ✅
- `pending_approval` status fully implemented
- `onPendingApproval` handler processes approve/reject
- CEO decisions routed through approval gates
- Agent hiring/promotion requires approval
- Budget allocation requires CEO approval + optional Hamza approval

### Report Generation ✅
- All agent summaries aggregated into comprehensive reports
- Cycle results stored in `agent_memory` table
- JSON-formatted output for downstream processing
- Support for markdown and structured data formats

### Role Dispatch ✅
- `runRole` function dispatches any agent by role
- Provider-agnostic: works with any AI provider
- Consistent input/output schema across all agents

### Memory Storage ✅
- Cycle results persisted to `agent_memory` Supabase table
- Historical context available for future cycles
- Agent-specific memory retrieval
- Cross-cycle learning (previous results fed into next cycle)

### Testing ✅
- 35 unit tests passing
- Agent execution tests
- Approval flow tests
- Memory storage tests
- Orchestrator loop tests

---

## What's Missing for Production

### 1. Real AI Provider
| Issue | Impact | Solution |
|-------|--------|----------|
| Ollama used for development | Won't work in Vercel (no local process) | Add `OPENAI_API_KEY` to env |
| No fallback provider | Single point of failure | Configure Anthropic as fallback |
| No token management | Unbounded costs | Add token budget per cycle |

### 2. Real API Connections
| Agent | Depends On | Status | Impact of Missing |
|-------|-----------|--------|------------------|
| CEO | AI provider | Blocked | No decisions |
| CMO | LinkedIn, Facebook, Instagram | Blocked | No content publishing |
| Sales | HubSpot, Salesforce, Gmail | Blocked | No CRM/email |
| Media Buyer | Facebook Ads, Google Ads | Stub | No real campaigns |
| Developer | GitHub, Vercel | Missing | No code deployment |
| Video Editor | YouTube, Runway | Blocked | No video upload |
| Support | Gmail, Slack, Discord | Blocked | No communication |

### 3. Human-in-the-Loop UI
| Feature | Status | Need |
|---------|--------|------|
| Approval dashboard | Not built | UI to view/manage pending approvals |
| Notification system | Not built | Email/Slack notification on pending items |
| Approval history | Partial | Add UI to review past approvals |
| Dashboard metrics | Not built | Cycle performance, agent health |

### 4. Persistent Scheduling
| Component | Status | Solution |
|-----------|--------|----------|
| Company worker script | Exists as CLI command | Deploy as Vercel cron target |
| Schedule configuration | Not implemented | Add cron schedule to env vars |
| Cycle frequency | Hardcoded | Make configurable (4h, 8h, 12h, 24h) |
| Retry mechanism | Basic | Add exponential backoff |

### 5. State Recovery
| Issue | Risk | Solution |
|-------|------|----------|
| Company state in-memory | Lost on server restart | Persist to Supabase |
| No crash recovery | Partial cycle lost on crash | Checkpoint phase completion |
| No idempotency | Duplicate executions | Track execution_id per cycle |

---

## Approve-Only Mode

### Architecture

The approval system is already built and tested. In approve-only mode:

```
┌─────────────────┐     ┌─────────────────┐     ┌────────────────┐
│  Orchestrator   │────▶│  CEO Decision   │────▶│  Pending       │
│  runs all       │     │  Engine         │     │  Approval      │
│  10 phases      │     │  generates      │     │  (Supabase)    │
│                 │     │  proposals      │     │                │
└─────────────────┘     └─────────────────┘     └───────┬────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │  Hamza Reviews      │
                                              │  via API / Dashboard │
                                              │  Approve or Reject  │
                                              └──────────┬──────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │  System Continues   │
                                              │  Execution          │
                                              └─────────────────────┘
```

### What Hamza Can Do
| Action | How | Status |
|--------|-----|--------|
| Start the company orchestrator | `npm run company` or trigger `/api/company/start` | ✅ Works |
| Let it run all 10 phases | Orchestrator executes sequentially | ✅ Works |
| Review CEO strategic decisions | `GET /api/approvals?type=strategic` | ✅ Works |
| Review hiring/promotion proposals | `GET /api/approvals?type=hiring` | ✅ Works |
| Review budget allocations | `GET /api/approvals?type=budget` | ✅ Works |
| Approve or reject each decision | `POST /api/approvals/:id` with `approve` or `reject` | ✅ Works |
| View aggregated cycle report | `GET /api/company/report/:cycleId` | ✅ Works |
| System continues executing approved actions | After approval, next phase triggers | ✅ Works |

### What Hamza Cannot Do (Requires Missing Credentials)
| Action | Missing | Workaround |
|--------|---------|------------|
| Approve ad campaigns | All 4 ad providers are stubs | No workaround — needs real API keys |
| Approve payments/invoices | Stripe key missing | Add `STRIPE_SECRET_KEY` |
| Send approved emails | Gmail OAuth token missing | Complete Gmail OAuth flow |
| Publish approved social posts | LinkedIn/Facebook tokens missing | Complete social OAuth flows |
| Execute approved video uploads | YouTube token missing | Complete YouTube OAuth flow |

### Running Approve-Only Mode Today

```bash
# 1. Add at minimum one production AI key
export OPENAI_API_KEY=sk-...

# 2. Start the orchestrator
npm run company

# 3. System runs through all phases
#    CEO decisions appear as pending approvals

# 4. Check approvals via CLI or API
curl https://inlight.agency/api/approvals

# 5. Approve or reject
curl -X POST https://inlight.agency/api/approvals/123 \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'

# 6. System picks up and continues
```

---

## Roadmap to Full Autonomy

### Week 1: Production AI + First Cycle
| Day | Task | Deliverable |
|-----|------|-------------|
| Day 1 | Add OpenAI / Anthropic API key | AI provider configured |
| Day 2 | Run first full cycle with human review | Cycle 1 report |
| Day 3 | Verify all 10 phases execute end-to-end | Green run |
| Day 4 | Review and fix phase failures | Cycle 2 with fixes |
| Day 5 | Set up approval dashboard | UI for Hamza |
| Day 6 | Run 3 full cycles | Proof of repeatability |
| Day 7 | Document learnings | Cycle performance report |

### Week 2: Complete OAuth Flows
| Day | Task | Deliverable |
|-----|------|-------------|
| Day 1 | Complete Gmail OAuth flow | Email sending verified |
| Day 2 | Complete LinkedIn + Facebook OAuth | Social posting verified |
| Day 3 | Complete Instagram + YouTube OAuth | Media publishing verified |
| Day 4 | Content publishing pipeline tested | Full content workflow |
| Day 5 | Automated posting with human review | Approve-only social |
| Day 6 | Error handling for OAuth refresh | Token refresh logic |
| Day 7 | Monitor first week of publishing | Publishing metrics |

### Week 3: Connect CRM + Payments
| Day | Task | Deliverable |
|-----|------|-------------|
| Day 1 | Add Stripe API key | Payment system live |
| Day 2 | Test invoicing + billing flow | First invoice |
| Day 3 | Add HubSpot API key | CRM sync live |
| Day 4 | Connect Calendly | Meeting booking live |
| Day 5 | Sales pipeline end-to-end | Lead → deal flow |
| Day 6 | Payment + CRM integration test | Full financial workflow |
| Day 7 | Revenue tracking dashboard | Revenue metrics |

### Week 4: Persistent Worker Service
| Day | Task | Deliverable |
|-----|------|-------------|
| Day 1 | Deploy company worker as Vercel cron target | Scheduled execution |
| Day 2 | Configure cron-job.org or Vercel crons | 4-hour cycle schedule |
| Day 3 | Persist company state to Supabase | Crash recovery |
| Day 4 | Add checkpointing per phase | Partial cycle recovery |
| Day 5 | Test restart after simulated crash | Recovery verified |
| Day 6 | Add idempotency keys | No duplicate cycles |
| Day 7 | Run 24h continuous test | Uptime verified |

### Week 5: Scheduling + State Persistence
| Day | Task | Deliverable |
|-----|------|-------------|
| Day 1 | Make cycle frequency configurable | 4h/8h/12h/24h options |
| Day 2 | Add cycle scheduling calendar | Configured schedule |
| Day 3 | State persistence verification | No data loss |
| Day 4 | Add agent memory consolidation | Cross-cycle learning |
| Day 5 | Performance optimization | Cycle time reduction |
| Day 6 | Load testing | 10 concurrent cycles |
| Day 7 | Failover testing | Graceful degradation |

### Week 6: Reduce Oversight
| Day | Task | Deliverable |
|-----|------|-------------|
| Day 1 | Autopilot mode for low-risk decisions | Rules-based auto-approval |
| Day 2 | Exception-only alerting | Only failures alert Hamza |
| Day 3 | Confidence scoring for decisions | Auto-approve high confidence |
| Day 4 | Escalation rules | Critical decisions → Hamza |
| Day 5 | Daily review mode | One daily check-in |
| Day 6 | Trust metrics | Track auto-approval accuracy |
| Day 7 | Reduce to daily review | Approve-only → Review-only |

### Week 7: Full Autonomy
| Day | Task | Deliverable |
|-----|------|-------------|
| Day 1 | Full autonomy mode toggle | On/off switch |
| Day 2 | Autonomous cycle execution | 24h without human intervention |
| Day 3 | Monitor and tune | Performance adjustments |
| Day 4 | Exception-only mode live | Alerts only on exceptions |
| Day 5 | Performance report | Autonomy metrics |
| Day 6 | Documentation | Runbook for autonomous ops |
| Day 7 | **GO LIVE — Full Autonomy** | Autonomous company operational |

### Autonomy Levels

| Level | Name | Human Involvement | Status |
|-------|------|-------------------|--------|
| 0 | Manual | Hamza runs everything manually | N/A |
| 1 | Assisted | System suggests, Hamza executes | N/A |
| 2 | Approve-Only | System executes, Hamza approves | ✅ Ready |
| 3 | Review-Only | System executes, Hamza reviews daily | 🔄 Week 6 |
| 4 | Exception-Only | System executes, alerts on exceptions | 🔄 Week 7 |
| 5 | Full Autonomy | System runs independently | 🎯 Goal |
