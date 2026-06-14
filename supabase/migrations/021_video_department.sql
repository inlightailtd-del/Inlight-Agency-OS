create table if not exists video_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  content_type text not null default 'short', -- short | long | reel
  platform text, -- youtube | instagram | tiktok | linkedin | facebook | twitter
  status text not null default 'idea', -- idea | script | voiceover | assets | editing | thumbnail | review | scheduled | published
  assignee_id uuid references agents(id),
  campaign_id uuid,
  script_content text,
  voiceover_url text,
  thumbnail_url text,
  duration_seconds integer,
  hook_text text,
  scheduled_at timestamptz,
  published_at timestamptz,
  views integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  save_count integer default 0,
  viral_score integer default 0,
  platform_post_id text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists video_assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references video_projects(id) on delete cascade,
  asset_type text not null, -- footage | music | voiceover | thumbnail | broll | graphic
  url text,
  filename text,
  duration_seconds integer,
  notes text,
  created_at timestamptz default now()
);

create table if not exists video_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  goal text,
  target_platforms text[] default '{}',
  video_count integer default 0,
  status text not null default 'planned', -- planned | active | completed | archived
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table video_projects add column if not exists asset_count integer default 0;
create index if not exists idx_video_projects_user on video_projects(user_id);
create index if not exists idx_video_projects_status on video_projects(status);
create index if not exists idx_video_projects_assignee on video_projects(assignee_id);
create index if not exists idx_video_assets_project on video_assets(project_id);
create index if not exists idx_video_campaigns_user on video_campaigns(user_id);

alter table video_projects enable row level security;
alter table video_assets enable row level security;
alter table video_campaigns enable row level security;

create policy "Users see own video projects" on video_projects for all using (auth.uid() = user_id);
create policy "Users see own video assets" on video_assets for all using (auth.uid() = user_id);
create policy "Users see own video campaigns" on video_campaigns for all using (auth.uid() = user_id);
