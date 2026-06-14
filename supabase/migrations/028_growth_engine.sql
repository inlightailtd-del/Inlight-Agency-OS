create table if not exists growth_content_calendar (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content_request_id uuid references content_requests(id) on delete cascade,
  scheduled_date date not null,
  platform text not null,
  post_type text not null default 'post',
  status text not null default 'scheduled',
  posted_at timestamptz,
  engagement_likes integer default 0,
  engagement_comments integer default 0,
  engagement_shares integer default 0,
  created_at timestamptz default now()
);

create table if not exists growth_leads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  source text not null default 'ai_generated',
  name text,
  company text,
  email text,
  phone text,
  interest text,
  score integer default 0,
  contacted boolean default false,
  converted boolean default false,
  created_at timestamptz default now()
);

alter table growth_content_calendar add column if not exists notes text;

create index if not exists idx_gcc_date on growth_content_calendar(scheduled_date);
create index if not exists idx_gcc_platform on growth_content_calendar(platform);
create index if not exists idx_gl_user on growth_leads(user_id);
create index if not exists idx_gl_source on growth_leads(source);

alter table growth_content_calendar enable row level security;
alter table growth_leads enable row level security;
create policy "Users see own calendar" on growth_content_calendar for all using (auth.uid() = user_id);
create policy "Users see own growth leads" on growth_leads for all using (auth.uid() = user_id);
