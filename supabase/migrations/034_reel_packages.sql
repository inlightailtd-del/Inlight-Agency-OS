create table if not exists reel_packages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  topic text not null,
  duration_seconds integer not null default 30,
  trend_source text,
  trend_keyword text,
  trend_category text,
  hook text not null,
  hook_type text not null,
  hook_score numeric(5,2),
  script_body text not null,
  storyboard jsonb default '[]',
  scenes jsonb default '[]',
  visual_prompts jsonb default '[]',
  voiceover_text text,
  caption text,
  hashtags text[] default '{}',
  cta text,
  predicted_performance numeric(5,2),
  status text default 'draft',          -- draft | ready | published | archived
  platform_post_id text,
  platform_url text,
  engagement_data jsonb default '{}',
  performance_score numeric(5,2),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_rp_user on reel_packages(user_id);
create index if not exists idx_rp_status on reel_packages(status);
create index if not exists idx_rp_topic on reel_packages(topic);

alter table reel_packages enable row level security;
create policy "Users own reel_packages" on reel_packages for all using (auth.uid() = user_id);
