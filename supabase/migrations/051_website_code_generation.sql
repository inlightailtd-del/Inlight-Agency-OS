-- Website Code Generation: store generated code files and deploy status

-- Add code generation columns to website_projects
alter table website_projects add column if not exists generated_code jsonb default '[]';
alter table website_projects add column if not exists generated_at timestamptz;

-- Table for storing generated website files
create table if not exists website_project_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references website_projects(id) on delete cascade not null,
  path text not null,
  content text not null,
  type text default 'text/html',
  size integer default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table website_project_files enable row level security;

-- RLS policies
create policy "Users can view their own files"
  on website_project_files for select
  using (auth.uid() = user_id);

create policy "Users can insert their own files"
  on website_project_files for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own files"
  on website_project_files for delete
  using (auth.uid() = user_id);

-- Index for faster lookups
create index if not exists idx_website_project_files_project
  on website_project_files(project_id);
create index if not exists idx_website_project_files_user
  on website_project_files(user_id);
