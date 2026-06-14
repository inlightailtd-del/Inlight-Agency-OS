create table if not exists automations (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  name           text not null,
  description    text,
  category       text not null default 'internal', -- lead_gen | support | social_media | content | seo | email | whatsapp | sales | crm | internal
  status         text not null default 'draft',     -- active | paused | draft | failed
  trigger_type   text default 'manual',             -- manual | scheduled | webhook | event
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
create index if not exists idx_automations_category on automations(category);
create index if not exists idx_automations_status on automations(status);
alter table automations enable row level security;
create policy "Users see own automations" on automations for all using (auth.uid() = user_id);

create table if not exists automation_runs (
  id             uuid default gen_random_uuid() primary key,
  automation_id  uuid references automations(id) on delete cascade,
  status         text not null default 'pending', -- pending | running | success | failed
  started_at     timestamptz default now(),
  completed_at   timestamptz,
  duration_ms    integer,
  result         jsonb,
  error_msg      text,
  triggered_by   text default 'manual'
);
create index if not exists idx_automation_runs_auto on automation_runs(automation_id);
alter table automation_runs enable row level security;
create policy "Users see runs for own automations" on automation_runs for select
  using (automation_id in (select id from automations where user_id = auth.uid()));
create policy "Users can insert runs for own automations" on automation_runs
  for insert with check (automation_id in (select id from automations where user_id = auth.uid()));