-- Dev System V2: Git Engine, ADR, RCA, Swarm, Cycles
create table if not exists dev_git_commits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  cycle_id text,
  branch text not null default 'main',
  message text not null,
  files_changed jsonb default '[]',
  additions integer default 0,
  deletions integer default 0,
  status text default 'staged',         -- staged | committed | pushed | failed
  hash text,
  author_name text default 'Inlight ASE v2',
  author_email text default 'ase@inlight.ai',
  created_at timestamptz default now()
);

create table if not exists dev_adr (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  cycle_id text,
  title text not null,
  context text not null,
  decision text not null,
  alternatives text[] default '{}',
  consequences text,
  status text default 'proposed',       -- proposed | accepted | deprecated | superseded
  tags text[] default '{}',
  superseded_by uuid references dev_adr(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists dev_rca (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  cycle_id text,
  symptom text not null,                -- what went wrong
  root_cause text not null,             -- why it happened
  impact text not null,                 -- what was affected
  severity text default 'medium',       -- low | medium | high | critical
  category text default 'build',        -- build | test | runtime | logic | config
  stacktrace text,
  fix text,
  fix_status text default 'pending',    -- pending | applied | verified | failed
  prevention text,                      -- how to prevent recurrence
  tags text[] default '{}',
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists dev_cycles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  objective text not null,
  mode text default 'full',             -- full | quick | fix | feature | refactor
  status text default 'running',        -- running | completed | failed | learning
  architect_plan jsonb,
  swarm_composition jsonb,
  execution_log jsonb default '[]',
  errors jsonb default '[]',
  lessons_learned jsonb default '[]',
  commit_count integer default 0,
  file_count integer default 0,
  duration_ms integer,
  metadata jsonb default '{}',
  started_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists dev_swarm_agents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null,                   -- architect | planner | builder | reviewer | tester | debugger
  specialization text,                  -- area of expertise
  model text default 'default',
  temperature numeric(3,2) default 0.3,
  max_iterations integer default 3,
  is_active boolean default true,
  performance_metrics jsonb default '{"success_rate": 0, "avg_duration_ms": 0, "tasks_completed": 0}',
  instructions text,
  created_at timestamptz default now()
);

create table if not exists dev_repo_graph (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  file_path text not null,
  file_type text,
  imports jsonb default '[]',
  exported_by jsonb default '[]',
  dependencies jsonb default '[]',
  dependents jsonb default '[]',
  size_bytes integer default 0,
  last_modified timestamptz,
  hash text,
  created_at timestamptz default now(),
  unique(user_id, file_path)
);

-- Indexes
create index if not exists idx_dgc_cycle on dev_git_commits(cycle_id);
create index if not exists idx_dgc_user on dev_git_commits(user_id);
create index if not exists idx_dadr_status on dev_adr(status);
create index if not exists idx_dadr_tags on dev_adr using gin(tags);
create index if not exists idx_drca_severity on dev_rca(severity);
create index if not exists idx_drca_category on dev_rca(category);
create index if not exists idx_dc_status on dev_cycles(status);
create index if not exists idx_dc_user on dev_cycles(user_id);
create index if not exists idx_dsa_role on dev_swarm_agents(role);
create index if not exists idx_drg_file on dev_repo_graph(file_path);

-- RLS
alter table dev_git_commits enable row level security;
alter table dev_adr enable row level security;
alter table dev_rca enable row level security;
alter table dev_cycles enable row level security;
alter table dev_swarm_agents enable row level security;
alter table dev_repo_graph enable row level security;

create policy "Users own dev_git_commits" on dev_git_commits for all using (auth.uid() = user_id);
create policy "Users own dev_adr" on dev_adr for all using (auth.uid() = user_id);
create policy "Users own dev_rca" on dev_rca for all using (auth.uid() = user_id);
create policy "Users own dev_cycles" on dev_cycles for all using (auth.uid() = user_id);
create policy "Users own dev_swarm_agents" on dev_swarm_agents for all using (auth.uid() = user_id);
create policy "Users own dev_repo_graph" on dev_repo_graph for all using (auth.uid() = user_id);
