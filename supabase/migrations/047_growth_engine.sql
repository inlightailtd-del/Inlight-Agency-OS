-- Growth Engine — Competitor tracking, market scanning, pricing, offers, revenue simulation, opportunities

create table if not exists growth_competitor_targets (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  name         text not null,
  website      text not null,
  pages        text[] default '{"/","/pricing","/features","/about"}',
  industry     text,
  is_active    boolean default true,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table growth_competitor_targets enable row level security;
create policy "Users see own competitor targets" on growth_competitor_targets for all using (auth.uid() = user_id);

create table if not exists growth_competitor_snapshots (
  id              uuid default gen_random_uuid() primary key,
  target_id       uuid references growth_competitor_targets(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  page_url        text not null,
  title           text,
  description     text,
  headings        jsonb default '[]',
  pricing_mentions jsonb default '[]',
  feature_mentions jsonb default '[]',
  cta_text        text,
  raw_text_sample text,
  detected_at     timestamptz default now()
);
create index if not exists idx_growth_snapshots_target on growth_competitor_snapshots(target_id);
alter table growth_competitor_snapshots enable row level security;
create policy "Users see own snapshots" on growth_competitor_snapshots for all using (auth.uid() = user_id);

create table if not exists growth_competitor_diffs (
  id            uuid default gen_random_uuid() primary key,
  target_id     uuid references growth_competitor_targets(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  previous_snapshot_id uuid references growth_competitor_snapshots(id),
  current_snapshot_id  uuid references growth_competitor_snapshots(id),
  changes       jsonb default '[]',
  significance  text default 'low',
  detected_at   timestamptz default now()
);
alter table growth_competitor_diffs enable row level security;
create policy "Users see own diffs" on growth_competitor_diffs for all using (auth.uid() = user_id);

create table if not exists growth_market_scans (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  industry         text,
  niche            text,
  trends_found     int default 0,
  top_trends       jsonb default '[]',
  sentiment_score  real,
  market_size      text,
  growth_rate      text,
  channels_analyzed jsonb default '[]',
  scan_source      text default 'full',
  scanned_at       timestamptz default now()
);
alter table growth_market_scans enable row level security;
create policy "Users see own market scans" on growth_market_scans for all using (auth.uid() = user_id);

create table if not exists growth_pricing_models (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  name             text not null,
  description      text,
  tiers            jsonb not null default '[]',
  competitor_benchmarks jsonb default '[]',
  cost_data        jsonb default '{}',
  strategy         text default 'value_based',
  status           text default 'draft',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table growth_pricing_models enable row level security;
create policy "Users see own pricing models" on growth_pricing_models for all using (auth.uid() = user_id);

create table if not exists growth_offers (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  name             text not null,
  tagline          text,
  description      text,
  offer_type       text default 'product',
  target_audience  text,
  pricing_tier     text,
  pricing_model_id uuid references growth_pricing_models(id),
  deliverables     jsonb default '[]',
  value_propositions jsonb default '[]',
  evidence         jsonb default '{}',
  status           text default 'draft',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table growth_offers enable row level security;
create policy "Users see own offers" on growth_offers for all using (auth.uid() = user_id);

create table if not exists growth_revenue_simulations (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  name             text,
  scenarios        jsonb not null default '[]',
  assumptions      jsonb default '{}',
  channel_breakdown jsonb default '[]',
  breakeven_analysis jsonb default '{}',
  status           text default 'draft',
  simulated_at     timestamptz default now()
);
alter table growth_revenue_simulations enable row level security;
create policy "Users see own simulations" on growth_revenue_simulations for all using (auth.uid() = user_id);

create table if not exists growth_opportunities (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  name             text not null,
  description      text,
  source           text default 'market_scan',
  market_fit       real,
  effort           real,
  revenue_potential text,
  timeframe        text,
  dependencies     jsonb default '[]',
  priority_score   real,
  status           text default 'identified',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table growth_opportunities enable row level security;
create policy "Users see own opportunities" on growth_opportunities for all using (auth.uid() = user_id);

create table if not exists growth_engine_runs (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  status           text not null default 'running',
  phases_completed jsonb default '[]',
  competitors_scraped int default 0,
  trends_detected     int default 0,
  pricing_generated  boolean default false,
  offers_generated  int default 0,
  simulations_run   int default 0,
  opportunities_found int default 0,
  errors            jsonb default '[]',
  summary           text,
  started_at        timestamptz default now(),
  completed_at      timestamptz
);
alter table growth_engine_runs enable row level security;
create policy "Users see own engine runs" on growth_engine_runs for all using (auth.uid() = user_id);
