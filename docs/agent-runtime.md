# Agent Execution Engine — Architecture

## File Map

```
lib/
├── agents/
│   ├── runtime.ts          → AgentRuntime class (infrastructure)
│   ├── approval.ts         → Autonomy check & approval gate
│   ├── project-monitor.ts  → Project Monitor Agent (consumer)
│   ├── wrappers.ts         → CEO/Content/Lead/Performance wrappers
│   └── departments.ts      → Marketing/Sales/Operations swarms
├── brain/
│   ├── embeddings.ts       → Vector embedding & search (pgvector)
│   └── context.ts          → Context builder & brain query API
├── skills/
│   └── marketing.ts        → 8 reusable marketing skills
├── ai/
│   ├── provider.ts         → Ollama/OpenAI/Anthropic/Groq abstraction
│   ├── execution.ts        → executeAgentTask() pipeline
│   ├── memory.ts           → agent_memory store/retrieve
│   ├── tools.ts            → 9 tools (updated with vector search)
│   ├── workflow.ts         → 6 multi-agent workflows
│   ├── content-engine.ts   → Blog/social/ad/email generation
│   └── lead-analyzer.ts    → Lead scoring & batch analysis
├── ceo/
│   ├── ceo.ts              → CEO assessment engine
│   ├── manager.ts          → 5 department manager agents
│   └── scheduler.ts        → CEO scheduler config
├── perf/
│   └── analyzer.ts         → Performance reports & bottlenecks
├── learning/
│   └── patterns.ts         → Self-learning pattern extraction
└── queue/
    └── queue.ts            → Job queue with retries & backoff
```

## Execution Flow

```
User/System triggers execution
  │
  ├─ POST /api/agents/runtime/tick (scheduled)
  ├─ POST /api/agents/runtime/tick { agentId, prompt } (manual)
  ├─ POST /api/brain/query (brain search)
  └─ POST /api/agents/project-monitor/run (monitor)
      │
      ▼
  AgentRuntime class
  │
  ├─ .exec(agentId, prompt)      → Manual
  ├─ .tick()                     → Scheduled
  ├─ .on(event, payload)         → Event-driven
  ├─ .delegate(plan)             → Multi-agent delegation
  └─ .dispatchSquad(squad)       → Parallel execution
      │
      ▼
  checkAutonomy() ──→ needs_approval? ──→ agent_approval_requests table
      │                               └─ Approve/Reject via UI
      ▼
  executeAgentTask()
  │
  ├─ Creates agent_executions record
  ├─ Fetches AI provider config
  ├─ Injects Company Brain context (vector + keyword)
  ├─ Runs agent tools (brain search, content, leads)
  ├─ Calls generateAIResponse()
  ├─ Updates agent stats (total_executions, success_rate)
  └─ Logs to execution_logs + agent_memory
      │
      ▼
  Response returned
```
