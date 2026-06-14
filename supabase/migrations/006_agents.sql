-- TABLE: agents (AI Employee Registry)
create table if not exists agents (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  name           text not null,
  description    text,
  type           text not null default 'general',    -- ceo | sales | marketing | content | seo | research | support | developer | automation | finance
  role           text,                                -- e.g., "Senior Sales Agent"
  status         text not null default 'offline',     -- active | idle | busy | offline
  department     text,                                -- sales | marketing | design | development | hr | admin
  assigned_tasks   integer default 0,
  assigned_projects integer default 0,
  performance_score integer default 0,               -- 0-100
  total_executions  integer default 0,
  success_rate     integer default 0,                -- 0-100
  avg_response_time_ms integer default 0,
  config         jsonb default '{}',
  last_active_at timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_agents_user on agents(user_id);
create index if not exists idx_agents_type on agents(type);
create index if not exists idx_agents_status on agents(status);
create index if not exists idx_agents_department on agents(department);

alter table agents enable row level security;
create policy "Users see own agents" on agents for all using (auth.uid() = user_id);