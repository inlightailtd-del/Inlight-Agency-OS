 -- ============================================================
-- MISSING TABLES DEPLOYMENT SQL
-- Only creates tables that do NOT exist in the database
-- Paste into Supabase SQL Editor and execute
-- ============================================================

-- ============================================================
-- 1. KNOWLEDGE DOCS (Migration 005)
-- ============================================================
create table if not exists knowledge_docs (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  title          text not null,
  content        text,
  category       text not null default 'general',
  department     text,
  status         text not null default 'published',
  tags           text[] default '{}',
  version        integer default 1,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_knowledge_docs_user on knowledge_docs(user_id);
alter table knowledge_docs enable row level security;
create policy "Users see own knowledge docs" on knowledge_docs for all using (auth.uid() = user_id);

create table if not exists knowledge_doc_versions (
  id             uuid default gen_random_uuid() primary key,
  doc_id         uuid references knowledge_docs(id) on delete cascade,
  version        integer not null,
  title          text not null,
  content        text,
  changed_by     uuid references auth.users(id),
  change_summary text,
  created_at     timestamptz default now()
);

alter table knowledge_doc_versions enable row level security;
create policy "Users see versions for own docs" on knowledge_doc_versions for select
  using (doc_id in (select id from knowledge_docs where user_id = auth.uid()));
create policy "Users can insert versions for own docs" on knowledge_doc_versions
  for insert with check (doc_id in (select id from knowledge_docs where user_id = auth.uid()));

-- ============================================================
-- 2. AGENTS (Migration 006)
-- ============================================================
create table if not exists agents (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  name           text not null,
  description    text,
  type           text not null default 'general',
  role           text,
  status         text not null default 'offline',
  department     text,
  assigned_tasks   integer default 0,
  assigned_projects integer default 0,
  performance_score integer default 0,
  total_executions  integer default 0,
  success_rate     integer default 0,
  avg_response_time_ms integer default 0,
  config         jsonb default '{}',
  last_active_at timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_agents_user on agents(user_id);
alter table agents enable row level security;
create policy "Users see own agents" on agents for all using (auth.uid() = user_id);

-- ============================================================
-- 3. AUTOMATIONS (Migration 007)
-- ============================================================
create table if not exists automations (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  name           text not null,
  description    text,
  category       text not null default 'internal',
  status         text not null default 'draft',
  trigger_type   text default 'manual',
  schedule_cron  text,
  total_runs     integer default 0,
  success_runs   integer default 0,
  failed_runs    integer default 0,
  last_run_at    timestamptz,
  performance_score integer default 0,
  config         jsonb default '{}',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_automations_user on automations(user_id);
alter table automations enable row level security;
create policy "Users see own automations" on automations for all using (auth.uid() = user_id);

create table if not exists automation_runs (
  id             uuid default gen_random_uuid() primary key,
  automation_id  uuid references automations(id) on delete cascade,
  status         text not null default 'pending',
  started_at     timestamptz default now(),
  completed_at   timestamptz,
  duration_ms    integer,
  result         jsonb,
  error_msg      text,
  triggered_by   text default 'manual'
);

alter table automation_runs enable row level security;
create policy "Users see runs for own automations" on automation_runs for select
  using (automation_id in (select id from automations where user_id = auth.uid()));
create policy "Users can insert runs for own automations" on automation_runs
  for insert with check (automation_id in (select id from automations where user_id = auth.uid()));

-- ============================================================
-- 4. COMMAND CENTER (Migration 008)
-- ============================================================
create table if not exists commands (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  command        text not null,
  response       text,
  status         text not null default 'pending',
  category       text,
  agent_id       uuid references agents(id),
  automation_id  uuid references automations(id),
  execution_time_ms integer,
  created_at     timestamptz default now()
);

create index if not exists idx_commands_user on commands(user_id);
alter table commands enable row level security;
create policy "Users see own commands" on commands for all using (auth.uid() = user_id);

create table if not exists execution_logs (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  command_id     uuid references commands(id) on delete cascade,
  action         text not null,
  module         text,
  entity_type    text,
  entity_id      uuid,
  result         jsonb,
  status         text not null default 'success',
  message        text,
  duration_ms    integer,
  created_at     timestamptz default now()
);

create index if not exists idx_execution_logs_user on execution_logs(user_id);
alter table execution_logs enable row level security;
create policy "Users see own execution logs" on execution_logs for all using (auth.uid() = user_id);

-- ============================================================
-- 5. ORCHESTRATOR (Migration 009)
-- ============================================================
create table if not exists orchestrator_tasks (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  agent_id       uuid references agents(id),
  status         text not null default 'pending',
  priority       text default 'medium',
  result         text,
  assigned_at    timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_orch_tasks_user on orchestrator_tasks(user_id);
create index if not exists idx_orch_tasks_agent on orchestrator_tasks(agent_id);
alter table orchestrator_tasks enable row level security;
create policy "Users see own orchestrator tasks" on orchestrator_tasks for all using (auth.uid() = user_id);

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

-- ============================================================
-- 6. CONTENT ENGINE (Migration 010)
-- ============================================================
create table if not exists content_requests (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  title          text not null,
  content_type   text not null default 'blog',
  description    text,
  platform       text,
  tone           text default 'professional',
  status         text not null default 'draft',
  word_count     integer,
  generated_content text,
  feedback       text,
  score          integer default 0,
  tags           text[] default '{}',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_content_requests_user on content_requests(user_id);
alter table content_requests enable row level security;
create policy "Users see own content requests" on content_requests for all using (auth.uid() = user_id);

-- ============================================================
-- 7. LEADS (Migration 011)
-- ============================================================
create table if not exists leads (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  name           text not null,
  company        text,
  website        text,
  email          text,
  phone          text,
  industry       text,
  country        text,
  source         text not null default 'manual',
  status         text not null default 'new',
  score          integer default 0,
  notes          text,
  tags           text[] default '{}',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_leads_user on leads(user_id);
alter table leads enable row level security;
create policy "Users see own leads" on leads for all using (auth.uid() = user_id);

-- ============================================================
-- 8. AI EXECUTION ENGINE (Migration 012)
-- ============================================================
create table if not exists ai_provider_configs (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  provider       text not null default 'ollama',
  model          text not null default 'llama3.1',
  api_url        text default 'http://localhost:11434',
  api_key        text,
  is_active      boolean default true,
  created_at     timestamptz default now(),
  unique(user_id, provider, model)
);

create index if not exists idx_ai_provider_configs_user on ai_provider_configs(user_id);
alter table ai_provider_configs enable row level security;
create policy "Users see own AI configs" on ai_provider_configs for all using (auth.uid() = user_id);

create table if not exists agent_executions (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  agent_id       uuid references agents(id),
  command_id     uuid references commands(id),
  task_id        uuid references orchestrator_tasks(id),
  prompt         text not null,
  response       text,
  model          text,
  provider       text,
  tokens_used    integer default 0,
  duration_ms    integer default 0,
  status         text not null default 'running',
  error_msg      text,
  metadata       jsonb default '{}',
  created_at     timestamptz default now()
);

create index if not exists idx_agent_executions_user on agent_executions(user_id);
create index if not exists idx_agent_executions_agent on agent_executions(agent_id);
alter table agent_executions enable row level security;
create policy "Users see own agent executions" on agent_executions for all using (auth.uid() = user_id);

create table if not exists agent_memory (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  agent_id       uuid references agents(id),
  category       text not null default 'general',
  content        jsonb not null default '{}',
  tags           text[] default '{}',
  created_at     timestamptz default now()
);

create index if not exists idx_agent_memory_user on agent_memory(user_id);
alter table agent_memory enable row level security;
create policy "Users see own agent memory" on agent_memory for all using (auth.uid() = user_id);

-- ============================================================
-- DONE
-- ============================================================