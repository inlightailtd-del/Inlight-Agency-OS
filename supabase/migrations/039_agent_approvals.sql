-- ============================================================
-- Agent Approval Requests
-- Gate for dangerous/irreversible agent actions.
-- Every row represents an action awaiting human review.
-- ============================================================

create table if not exists agent_approval_requests (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  agent_id        uuid not null references agents(id) on delete cascade,

  -- What the agent wants to do
  action          text not null,            -- e.g. "update_project_timeline", "send_client_email", "cancel_project"
  target_type     text not null,            -- e.g. "project", "invoice", "client", "task"
  target_id       uuid,                     -- the specific record the agent wants to change
  summary         text not null,            -- human-readable one-liner
  justification   text,                     -- why the agent thinks this is needed
  impact          text default 'medium',    -- low | medium | high | critical

  -- Before/after snapshots for informed decisions
  current_state   jsonb default '{}',
  proposed_change jsonb not null default '{}',

  -- Approval workflow
  status          text not null default 'pending',  -- pending | approved | rejected | cancelled
  reasoning       text,                             -- human's reason for approve/reject
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz,
  expires_at      timestamptz,

  -- Link back to the execution context
  task_id         uuid references orchestrator_tasks(id) on delete set null,
  execution_id    uuid references agent_executions(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_agent_approvals_user on agent_approval_requests(user_id);
create index if not exists idx_agent_approvals_status on agent_approval_requests(status);
create index if not exists idx_agent_approvals_agent on agent_approval_requests(agent_id);
create index if not exists idx_agent_approvals_target on agent_approval_requests(target_type, target_id);
create index if not exists idx_agent_approvals_pending on agent_approval_requests(user_id, status)
  where status = 'pending';

-- RLS
alter table agent_approval_requests enable row level security;
create policy "Users see own approval requests"
  on agent_approval_requests for all
  using (auth.uid() = user_id);
