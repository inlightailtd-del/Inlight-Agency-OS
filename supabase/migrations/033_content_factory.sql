-- Content Factory: ideas, posts, carousels, reels, calendar, analytics

create table if not exists content_factory_ideas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  topic text not null,
  category text not null default 'general',
  content_type text not null,                -- post | carousel | reel
  platform text not null default 'linkedin',
  hook text,
  body text,
  caption text,
  hashtags text[] default '{}',
  source text,                               -- market_trend | competitor | opportunity | ai
  source_ref text,                           -- reference to the source data
  score integer default 0,                   -- predicted performance 0-100
  status text default 'draft',               -- draft | approved | published | archived
  published_at timestamptz,
  platform_post_id text,
  engagement_data jsonb default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists content_factory_calendar (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  week_start date not null,
  day_of_week integer not null,             -- 0-6 Mon-Sun
  platform text not null,
  content_type text not null,               -- post | carousel | reel
  idea_id uuid references content_factory_ideas(id) on delete set null,
  title text,
  status text default 'scheduled',          -- scheduled | published | skipped
  scheduled_time timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, week_start, day_of_week, platform)
);

create table if not exists content_factory_analytics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  idea_id uuid references content_factory_ideas(id) on delete cascade,
  platform text not null,
  snapshot_date date not null,
  views integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  saves integer default 0,
  engagement_rate numeric(5,2) default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique(user_id, idea_id, platform, snapshot_date)
);

create table if not exists content_factory_weekly_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  week_start date not null,
  plan jsonb default '{}',
  status text default 'active',
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

create index if not exists idx_cfi_user on content_factory_ideas(user_id);
create index if not exists idx_cfi_status on content_factory_ideas(status);
create index if not exists idx_cfi_type on content_factory_ideas(content_type);
create index if not exists idx_cfc_user on content_factory_calendar(user_id);
create index if not exists idx_cfc_week on content_factory_calendar(week_start);
create index if not exists idx_cfa_idea on content_factory_analytics(idea_id);
create index if not exists idx_cfa_date on content_factory_analytics(snapshot_date);

alter table content_factory_ideas enable row level security;
alter table content_factory_calendar enable row level security;
alter table content_factory_analytics enable row level security;
alter table content_factory_weekly_plans enable row level security;

create policy "Users own content_factory_ideas" on content_factory_ideas for all using (auth.uid() = user_id);
create policy "Users own content_factory_calendar" on content_factory_calendar for all using (auth.uid() = user_id);
create policy "Users own content_factory_analytics" on content_factory_analytics for all using (auth.uid() = user_id);
create policy "Users own content_factory_weekly_plans" on content_factory_weekly_plans for all using (auth.uid() = user_id);
