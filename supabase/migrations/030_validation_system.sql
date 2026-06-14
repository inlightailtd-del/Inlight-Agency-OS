-- ============================================================
-- VALIDATION SYSTEM — Internal QA & Production Audit
-- ============================================================

create table if not exists validation_registry (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  name text not null,
  description text,
  category text not null default 'integration',   -- integration | content | growth | ai
  provider text,                                   -- gmail | linkedin | facebook | etc
  severity text default 'high',                    -- critical | high | medium | low
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists validation_runs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'running',          -- running | completed | failed
  total_checks integer default 0,
  passed_checks integer default 0,
  warning_checks integer default 0,
  failed_checks integer default 0,
  duration_ms integer,
  started_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists validation_results (
  id uuid default gen_random_uuid() primary key,
  run_id uuid references validation_runs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  category text not null,
  status text not null,                            -- working | warning | broken | skipped
  status_code integer,
  message text,
  details jsonb default '{}',                     -- API responses, evidence, timestamps
  duration_ms integer,
  checked_at timestamptz default now()
);

create index if not exists idx_vruns_user on validation_runs(user_id);
create index if not exists idx_vruns_status on validation_runs(status);
create index if not exists idx_vresults_run on validation_results(run_id);
create index if not exists idx_vresults_user on validation_results(user_id);
create index if not exists idx_vresults_status on validation_results(status);

alter table validation_registry enable row level security;
alter table validation_runs enable row level security;
alter table validation_results enable row level security;

create policy "Users see validation registry" on validation_registry for select using (true);
create policy "Users see own validation runs" on validation_runs for all using (auth.uid() = user_id);
create policy "Users see own validation results" on validation_results for all using (auth.uid() = user_id);

-- Seed the validation registry
insert into validation_registry (slug, name, description, category, provider, severity) values
  ('gmail-api', 'Gmail API', 'Tests Gmail OAuth token validity and ability to read/send email', 'integration', 'gmail', 'critical'),
  ('gmail-credentials', 'Gmail Credentials', 'Checks that Gmail OAuth credentials exist and are not expired', 'integration', 'gmail', 'critical'),
  ('linkedin-api', 'LinkedIn API', 'Tests LinkedIn OAuth token and ability to publish posts', 'integration', 'linkedin', 'critical'),
  ('linkedin-credentials', 'LinkedIn Credentials', 'Checks that LinkedIn OAuth credentials exist', 'integration', 'linkedin', 'critical'),
  ('facebook-api', 'Facebook API', 'Tests Facebook Graph API token and page access', 'integration', 'facebook', 'critical'),
  ('facebook-credentials', 'Facebook Credentials', 'Checks that Facebook credentials exist (if configured)', 'integration', 'facebook', 'medium'),
  ('content-published', 'Published Content', 'Verifies content_requests has published rows with real platform IDs', 'content', null, 'high'),
  ('content-factory', 'Content Factory', 'Verifies content factory can generate and store content', 'content', null, 'high'),
  ('growth-calendar', 'Growth Calendar', 'Verifies growth_content_calendar has scheduled entries', 'growth', null, 'high'),
  ('growth-engine', 'Growth Engine', 'Verifies growth engine execution history', 'growth', null, 'medium'),
  ('voice-credentials', 'Voice Credentials', 'Checks voice provider credentials (Twilio, Vapi, Bland AI)', 'integration', 'voice', 'medium'),
  ('ai-providers', 'AI Providers', 'Checks AI provider integrations', 'ai', null, 'medium'),
  ('production-build', 'Production Build', 'Verifies the Next.js build compiles successfully', 'system', null, 'critical'),
  ('database-connection', 'Database Connection', 'Verifies Supabase connection and table access', 'system', null, 'critical')
on conflict (slug) do nothing;
