create table if not exists creative_assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  reel_package_id uuid references reel_packages(id) on delete cascade,
  asset_type text not null,          -- thumbnail | cover | carousel_slide | b_roll | logo | icon | background
  prompt text not null,
  enhanced_prompt text,
  negative_prompt text,
  model text default 'dall-e-3',
  style text,
  aspect_ratio text default '9:16',
  image_url text,
  status text default 'pending',     -- pending | generating | completed | failed
  error_message text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists creative_prompts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  reel_package_id uuid references reel_packages(id) on delete cascade,
  prompt_type text not null,         -- thumbnail | cover | carousel | b_roll_pack
  prompt_text text not null,
  enhanced_text text,
  style_reference text,
  color_palette text[] default '{}',
  mood text,
  lighting text,
  composition text,
  performance_score numeric(5,2),
  times_used integer default 0,
  win_rate numeric(5,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists creative_generation_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  asset_id uuid references creative_assets(id) on delete cascade,
  prompt text not null,
  model text default 'dall-e-3',
  status text default 'queued',       -- queued | processing | completed | failed
  image_url text,
  error_message text,
  priority integer default 0,
  queued_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_ca_user on creative_assets(user_id);
create index if not exists idx_ca_package on creative_assets(reel_package_id);
create index if not exists idx_ca_type on creative_assets(asset_type);
create index if not exists idx_cp_user on creative_prompts(user_id);
create index if not exists idx_cp_type on creative_prompts(prompt_type);
create index if not exists idx_cgq_status on creative_generation_queue(status);

alter table creative_assets enable row level security;
alter table creative_prompts enable row level security;
alter table creative_generation_queue enable row level security;

create policy "Users own creative_assets" on creative_assets for all using (auth.uid() = user_id);
create policy "Users own creative_prompts" on creative_prompts for all using (auth.uid() = user_id);
create policy "Users own creative_generation_queue" on creative_generation_queue for all using (auth.uid() = user_id);

-- Performance tracking on prompts
create table if not exists creative_prompt_performance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  prompt_id uuid references creative_prompts(id) on delete cascade,
  prompt_type text not null,
  generation_count integer default 0,
  avg_score numeric(5,2),
  best_score numeric(5,2),
  last_used timestamptz,
  created_at timestamptz default now(),
  unique(user_id, prompt_id)
);

alter table creative_prompt_performance enable row level security;
create policy "Users own creative_prompt_performance" on creative_prompt_performance for all using (auth.uid() = user_id);
