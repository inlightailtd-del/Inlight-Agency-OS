-- Orchestrator Tasks (delegated work items)
create table if not exists orchestrator_tasks (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  agent_id       uuid references agents(id),
  status         text not null default 'pending', -- pending | assigned | in_progress | completed | failed
  priority       text default 'medium',           -- low | medium | high | critical
  result         text,
  assigned_at    timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_orch_tasks_user on orchestrator_tasks(user_id);
create index if not exists idx_orch_tasks_agent on orchestrator_tasks(agent_id);
create index if not exists idx_orch_tasks_status on orchestrator_tasks(status);
alter table orchestrator_tasks enable row level security;
create policy "Users see own orchestrator tasks" on orchestrator_tasks for all using (auth.uid() = user_id);

-- Agent Messages (inter-agent communication log)
create table if not exists agent_messages (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  from_agent_id  uuid references agents(id),
  to_agent_id    uuid references agents(id),
  message        text not null,
  context        jsonb default '{}',
  created_at     timestamptz default now()
);
create index if not exists idx_agent_messages_user on agent_messages(user_id);
alter table agent_messages enable row level security;
create policy "Users see own agent messages" on agent_messages for all using (auth.uid() = user_id);

-- Orchestrator Memory (shared context between agents)
create table if not exists orchestrator_memory (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  key            text not null,
  value          jsonb not null default '{}',
  agent_id       uuid references agents(id),
  updated_at     timestamptz default now(),
  unique(user_id, key)
);
create index if not exists idx_orch_memory_user on orchestrator_memory(user_id);
alter table orchestrator_memory enable row level security;
create policy "Users see own orchestrator memory" on orchestrator_memory for all using (auth.uid() = user_id);