create table if not exists dev_v3_docs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  cycle_id text,
  topic text not null,
  url text,
  content text,
  summary text,
  relevance numeric(3,2),
  source text default 'web',           -- web | local | npm | github
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists dev_v3_arch_graph (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  module_name text not null,
  module_type text,                     -- api | lib | component | page | migration
  file_path text,
  imports jsonb default '[]',
  exports jsonb default '[]',
  complexity integer default 0,         -- cyclomatic complexity
  test_coverage numeric(5,2),
  quality_score numeric(3,2),
  created_at timestamptz default now(),
  unique(user_id, module_name)
);

create table if not exists dev_v3_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  cycle_id text,
  file_path text not null,
  test_file_path text,
  test_type text default 'unit',       -- unit | integration | e2e
  status text default 'generated',     -- generated | passing | failing | skipped
  coverage_delta numeric(5,2),
  last_run timestamptz,
  created_at timestamptz default now()
);

create table if not exists dev_v3_branches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  cycle_id text,
  branch_name text not null,
  base_branch text default 'main',
  status text default 'active',        -- active | merged | abandoned | conflicted
  commits integer default 0,
  files_changed integer default 0,
  pull_request_url text,
  created_at timestamptz default now(),
  merged_at timestamptz
);

create table if not exists dev_v3_rollbacks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  cycle_id text,
  commit_hash text not null,
  reason text not null,
  rollback_type text default 'soft',   -- soft | hard | revert
  files_affected integer default 0,
  success boolean default false,
  restored_at timestamptz default now()
);

alter table dev_v3_docs enable row level security;
alter table dev_v3_arch_graph enable row level security;
alter table dev_v3_tests enable row level security;
alter table dev_v3_branches enable row level security;
alter table dev_v3_rollbacks enable row level security;

create policy "Users own dev_v3_docs" on dev_v3_docs for all using (auth.uid() = user_id);
create policy "Users own dev_v3_arch_graph" on dev_v3_arch_graph for all using (auth.uid() = user_id);
create policy "Users own dev_v3_tests" on dev_v3_tests for all using (auth.uid() = user_id);
create policy "Users own dev_v3_branches" on dev_v3_branches for all using (auth.uid() = user_id);
create policy "Users own dev_v3_rollbacks" on dev_v3_rollbacks for all using (auth.uid() = user_id);

create index if not exists idx_v3docs_topic on dev_v3_docs(topic);
create index if not exists idx_v3arch_module on dev_v3_arch_graph(module_name);
create index if not exists idx_v3tests_file on dev_v3_tests(file_path);
create index if not exists idx_v3branches_name on dev_v3_branches(branch_name);
create index if not exists idx_v3roll_hash on dev_v3_rollbacks(commit_hash);
