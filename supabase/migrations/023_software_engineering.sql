create table if not exists software_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  project_type text not null default 'saas', -- saas | api | webapp | mobile | library | tool | internal
  status text not null default 'idea',
  lead_id uuid references leads(id),
  website_project_id uuid references website_projects(id),
  architecture_doc text,
  requirements text[] default '{}',
  tech_stack text[] default '{}',
  repo_id uuid,
  repo_url text,
  live_url text,
  total_commits integer default 0,
  total_issues integer default 0,
  open_issues integer default 0,
  total_sprints integer default 0,
  current_sprint integer default 0,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists code_repositories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references software_projects(id) on delete cascade,
  name text not null,
  provider text default 'github',
  url text,
  default_branch text default 'main',
  language text,
  total_commits integer default 0,
  total_pull_requests integer default 0,
  open_pull_requests integer default 0,
  total_branches integer default 1,
  stars integer default 0,
  forks integer default 0,
  created_at timestamptz default now()
);

create table if not exists api_services (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references software_projects(id) on delete cascade,
  name text not null,
  description text,
  base_url text,
  endpoints integer default 0,
  authentication text default 'none',
  status text default 'planned', -- planned | developing | active | deprecated
  version text default '1.0.0',
  latency_ms integer default 0,
  uptime decimal(5,2) default 0,
  total_requests integer default 0,
  created_at timestamptz default now()
);

create table if not exists deployments_sw (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references software_projects(id) on delete cascade,
  version text not null default '1.0.0',
  status text not null default 'pending', -- pending | building | testing | deploying | live | failed | rolled_back
  platform text default 'vercel',
  environment text default 'production', -- production | staging | development
  build_logs text,
  deployed_at timestamptz,
  rollback_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists test_suites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references software_projects(id) on delete cascade,
  name text not null,
  type text not null default 'unit', -- unit | integration | e2e | performance | security
  total_tests integer default 0,
  passed integer default 0,
  failed integer default 0,
  skipped integer default 0,
  coverage decimal(5,2) default 0,
  last_run_at timestamptz,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table software_projects add column if not exists test_coverage decimal(5,2) default 0;
alter table software_projects add column if not exists deploy_count integer default 0;

create index if not exists idx_sw_projects_user on software_projects(user_id);
create index if not exists idx_sw_projects_status on software_projects(status);
create index if not exists idx_sw_projects_type on software_projects(project_type);
create index if not exists idx_code_repos_project on code_repositories(project_id);
create index if not exists idx_api_services_project on api_services(project_id);
create index if not exists idx_deployments_sw_project on deployments_sw(project_id);
create index if not exists idx_test_suites_project on test_suites(project_id);

alter table software_projects enable row level security;
alter table code_repositories enable row level security;
alter table api_services enable row level security;
alter table deployments_sw enable row level security;
alter table test_suites enable row level security;

create policy "Users see own software projects" on software_projects for all using (auth.uid() = user_id);
create policy "Users see own repos" on code_repositories for all using (auth.uid() = user_id);
create policy "Users see own api services" on api_services for all using (auth.uid() = user_id);
create policy "Users see own deployments" on deployments_sw for all using (auth.uid() = user_id);
create policy "Users see own test suites" on test_suites for all using (auth.uid() = user_id);
