create table if not exists commands (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  command        text not null,
  response       text,
  status         text not null default 'pending', -- pending | processing | completed | failed
  category       text,                             -- content | research | sales | seo | analysis | operations
  agent_id       uuid references agents(id),
  automation_id  uuid references automations(id),
  execution_time_ms integer,
  created_at     timestamptz default now()
);
create index if not exists idx_commands_user on commands(user_id);
create index if not exists idx_commands_status on commands(status);
alter table commands enable row level security;
create policy "Users see own commands" on commands for all using (auth.uid() = user_id);

create table if not exists execution_logs (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  command_id     uuid references commands(id) on delete cascade,
  action         text not null,
  module         text,                             -- clients | projects | tasks | milestones | finance | brain | agents | automations
  entity_type    text,
  entity_id      uuid,
  result         jsonb,
  status         text not null default 'success',  -- success | failed | warning
  message        text,
  duration_ms    integer,
  created_at     timestamptz default now()
);
create index if not exists idx_execution_logs_user on execution_logs(user_id);
create index if not exists idx_execution_logs_command on execution_logs(command_id);
alter table execution_logs enable row level security;
create policy "Users see own execution logs" on execution_logs for all using (auth.uid() = user_id);