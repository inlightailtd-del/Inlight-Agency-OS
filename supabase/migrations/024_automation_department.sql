-- Extend existing automations with pipeline support
alter table automations add column if not exists pipeline_status text default 'idea';
alter table automations add column if not exists assignee_id uuid references agents(id);
alter table automations add column if not exists workflow_doc text;
alter table automations add column if not exists integration_mappings jsonb default '{}';
alter table automations add column if not exists tags text[] default '{}';

create table if not exists workflow_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'internal',
  steps jsonb default '[]',
  integrations text[] default '{}',
  triggers text[] default '{}',
  estimated_duration_min integer default 30,
  success_rate decimal(5,2) default 0,
  total_uses integer default 0,
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists integrations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  provider text not null,
  type text not null default 'api',
  config jsonb default '{}',
  status text not null default 'disconnected',
  last_connected_at timestamptz,
  total_requests integer default 0,
  success_rate decimal(5,2) default 0,
  error_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists workflow_triggers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  workflow_id uuid references automations(id) on delete cascade,
  trigger_type text not null,
  config jsonb default '{}',
  condition text,
  is_active boolean default true,
  last_fired_at timestamptz,
  total_fires integer default 0,
  created_at timestamptz default now()
);

create table if not exists automation_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  workflow_id uuid references automations(id) on delete cascade,
  run_id uuid references automation_runs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_auto_pipeline on automations(pipeline_status);
create index if not exists idx_auto_assignee on automations(assignee_id);
create index if not exists idx_wf_templates_user on workflow_templates(user_id);
create index if not exists idx_integrations_user on integrations(user_id);
create index if not exists idx_integrations_provider on integrations(provider);
create index if not exists idx_triggers_workflow on workflow_triggers(workflow_id);
create index if not exists idx_auto_logs_workflow on automation_logs(workflow_id);
create index if not exists idx_auto_logs_run on automation_logs(run_id);

alter table workflow_templates enable row level security;
alter table integrations enable row level security;
alter table workflow_triggers enable row level security;
alter table automation_logs enable row level security;

create policy "Users see own workflow templates" on workflow_templates for all using (auth.uid() = user_id);
create policy "Users see own integrations" on integrations for all using (auth.uid() = user_id);
create policy "Users see own triggers" on workflow_triggers for all using (auth.uid() = user_id);
create policy "Users see own automation logs" on automation_logs for all using (auth.uid() = user_id);
