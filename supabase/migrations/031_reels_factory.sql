-- ============================================================
-- INLIGHT AUTONOMOUS REELS FACTORY
-- ============================================================

create table if not exists reels_trends (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  keyword text not null,
  source text not null,                        -- google_trends | youtube | linkedin | x | reddit | industry_news
  category text not null default 'general',    -- ai | automation | saas | marketing | agency
  score numeric(5,2) default 0,                -- 0-100 trend score
  velocity numeric(5,2) default 0,             -- growth rate -100 to 100
  volume integer default 0,                    -- search volume / mention count
  momentum text default 'stable',              -- rising | stable | falling
  metadata jsonb default '{}',
  discovered_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists reels_competitors (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  platform text not null,                      -- linkedin | facebook | instagram | youtube | x
  profile_url text,
  category text not null default 'agency',     -- agency | saas | marketing | individual
  followers integer default 0,
  engagement_rate numeric(5,2) default 0,
  top_posts jsonb default '[]',
  content_formats jsonb default '[]',
  common_hooks jsonb default '[]',
  cta_patterns jsonb default '[]',
  last_scanned_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform, name)
);

create table if not exists reels_hooks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  hook_text text not null,
  hook_type text not null,                     -- curiosity | authority | problem | story | shock
  score numeric(5,2) default 0,                -- predicted performance 0-100
  source text default 'ai',                    -- ai | competitor | trend
  category text,                               -- topic category this hook applies to
  topics text[] default '{}',                  -- associated topics
  performance_score numeric(5,2),              -- actual performance after use
  times_used integer default 0,
  win_rate numeric(5,2),                       -- % of time this hook outperformed average
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reels_scripts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  topic text not null,
  category text not null default 'general',
  duration_seconds integer not null default 30, -- 15 | 30 | 60
  hook_text text,
  hook_type text,
  body_text text not null,
  cta_text text,
  caption text,
  hashtags text[] default '{}',
  tone text default 'professional',            -- professional | casual | urgent | inspirational | humorous
  hook_score numeric(5,2),
  predicted_performance numeric(5,2),
  status text default 'draft',                  -- draft | approved | produced | published | archived
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reels_videos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  script_id uuid references reels_scripts(id) on delete set null,
  title text not null,
  duration_seconds integer not null,
  video_url text,
  thumbnail_url text,
  voiceover_url text,
  voice_type text default 'ai',                -- ai | cloned | recorded
  caption text,
  hashtags text[] default '{}',
  status text default 'rendering',             -- rendering | ready | published | failed
  platform_status jsonb default '{}',          -- { linkedin: 'ready', facebook: 'pending', ... }
  file_size_bytes bigint,
  render_duration_ms integer,
  error_message text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reels_analytics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references reels_videos(id) on delete cascade,
  platform text not null,
  platform_post_id text,
  platform_url text,
  views integer default 0,
  unique_views integer default 0,
  reach integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  saves integer default 0,
  watch_time_seconds integer default 0,
  avg_watch_percentage numeric(5,2) default 0,
  engagement_rate numeric(5,2) default 0,
  snapshot_date date default current_date,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique(user_id, video_id, platform, snapshot_date)
);

create table if not exists reels_topic_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  topic text not null,
  category text not null default 'general',
  performance_score numeric(5,2) default 50,
  engagement_avg numeric(5,2) default 0,
  total_posts integer default 0,
  win_count integer default 0,
  trend_velocity numeric(5,2) default 0,
  last_updated timestamptz default now(),
  unique(user_id, topic)
);

create table if not exists reels_factory_config (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  daily_target integer default 3,
  platforms text[] default '{}',               -- connected platforms
  preferred_duration integer default 30,
  preferred_tone text default 'professional',
  auto_publish boolean default false,
  active_hours jsonb default '{"start": 8, "end": 22}',
  last_strategy_update timestamptz,
  config jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- Indexes
create index if not exists idx_rtrends_user on reels_trends(user_id);
create index if not exists idx_rtrends_score on reels_trends(score desc);
create index if not exists idx_rtrends_source on reels_trends(source);
create index if not exists idx_rcomp_user on reels_competitors(user_id);
create index if not exists idx_rhooks_user on reels_hooks(user_id);
create index if not exists idx_rhooks_score on reels_hooks(score desc);
create index if not exists idx_rscripts_user on reels_scripts(user_id);
create index if not exists idx_rscripts_status on reels_scripts(status);
create index if not exists idx_rvideos_user on reels_videos(user_id);
create index if not exists idx_rvideos_status on reels_videos(status);
create index if not exists idx_ranalytics_video on reels_analytics(video_id);
create index if not exists idx_ranalytics_date on reels_analytics(snapshot_date);
create index if not exists idx_rtscores_user on reels_topic_scores(user_id);
create index if not exists idx_rtscores_score on reels_topic_scores(performance_score desc);

-- RLS
alter table reels_trends enable row level security;
alter table reels_competitors enable row level security;
alter table reels_hooks enable row level security;
alter table reels_scripts enable row level security;
alter table reels_videos enable row level security;
alter table reels_analytics enable row level security;
alter table reels_topic_scores enable row level security;
alter table reels_factory_config enable row level security;

create policy "Users own reels_trends" on reels_trends for all using (auth.uid() = user_id);
create policy "Users own reels_competitors" on reels_competitors for all using (auth.uid() = user_id);
create policy "Users own reels_hooks" on reels_hooks for all using (auth.uid() = user_id);
create policy "Users own reels_scripts" on reels_scripts for all using (auth.uid() = user_id);
create policy "Users own reels_videos" on reels_videos for all using (auth.uid() = user_id);
create policy "Users own reels_analytics" on reels_analytics for all using (auth.uid() = user_id);
create policy "Users own reels_topic_scores" on reels_topic_scores for all using (auth.uid() = user_id);
create policy "Users own reels_factory_config" on reels_factory_config for all using (auth.uid() = user_id);
