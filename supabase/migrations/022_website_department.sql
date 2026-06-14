create table if not exists website_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  website_type text not null default 'business', -- business | agency | saas | ecommerce | portfolio | landing_page | blog
  status text not null default 'idea', -- idea | requirements | wireframe | design | development | testing | deployment | live
  lead_id uuid references leads(id),
  assignee_id uuid references agents(id),
  template_id uuid,
  pages integer default 1,
  budget decimal(12,2),
  deadline timestamptz,
  live_url text,
  repo_url text,
  hosting_provider text,
  seo_score integer default 0,
  performance_score integer default 0,
  conversion_rate decimal(5,2) default 0,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists website_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  website_type text not null default 'business',
  description text,
  structure jsonb default '{}',
  pages text[] default '{}',
  components text[] default '{}',
  seo_score integer default 0,
  conversion_pattern text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists website_deployments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references website_projects(id) on delete cascade,
  version text not null default '1.0.0',
  status text not null default 'pending', -- pending | building | deploying | live | failed
  url text,
  platform text default 'vercel',
  build_logs text,
  deployed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_website_projects_user on website_projects(user_id);
create index if not exists idx_website_projects_status on website_projects(status);
create index if not exists idx_website_projects_type on website_projects(website_type);
create index if not exists idx_website_projects_assignee on website_projects(assignee_id);
create index if not exists idx_website_templates_type on website_templates(website_type);
create index if not exists idx_website_deployments_project on website_deployments(project_id);

alter table website_projects enable row level security;
alter table website_templates enable row level security;
alter table website_deployments enable row level security;

create policy "Users see own website projects" on website_projects for all using (auth.uid() = user_id);
create policy "Users see own templates" on website_templates for all using (auth.uid() = user_id);
create policy "Users see own deployments" on website_deployments for all using (auth.uid() = user_id);
