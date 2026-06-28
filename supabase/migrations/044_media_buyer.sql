-- Media Buyer: Ad campaigns, ad sets, ads, creatives, performance tracking

create table if not exists ad_campaigns (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  goal            text,                    -- awareness | consideration | conversion | retargeting
  platform        text not null,           -- facebook | google | linkedin | tiktok
  daily_budget    numeric(10,2) default 0,
  total_budget    numeric(10,2) default 0,
  status          text default 'planned',  -- planned | active | paused | completed | archived
  start_date      date,
  end_date        date,
  target_audience jsonb default '{}',
  targeting_json  jsonb default '{}',
  performance     jsonb default '{"impressions":0,"clicks":0,"spend":0,"conversions":0}',
  roas            numeric(5,2) default 0,
  assignee_id     uuid references agents(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_ad_campaigns_user on ad_campaigns(user_id, status);
create index if not exists idx_ad_campaigns_platform on ad_campaigns(platform);

create table if not exists ad_sets (
  id              uuid default gen_random_uuid() primary key,
  campaign_id     uuid references ad_campaigns(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  bid_strategy    text default 'lowest_cost',  -- lowest_cost | bid_cap | target_cpa
  bid_amount      numeric(10,2) default 0,
  daily_budget    numeric(10,2) default 0,
  status          text default 'planned',
  targeting       jsonb default '{}',
  performance     jsonb default '{"impressions":0,"clicks":0,"spend":0,"conversions":0}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists ad_creatives (
  id              uuid default gen_random_uuid() primary key,
  ad_set_id       uuid references ad_sets(id) on delete cascade,
  campaign_id     uuid references ad_campaigns(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade not null,
  headline        text,
  primary_text    text,
  description     text,
  cta             text default 'Learn More',
  media_url       text,
  media_type      text default 'image',    -- image | video | carousel
  variant         text default 'a',        -- a | b for A/B testing
  platform        text not null,
  status          text default 'draft',    -- draft | active | paused | rejected
  performance     jsonb default '{"impressions":0,"clicks":0,"spend":0,"conversions":0,"ctr":0}',
  created_at      timestamptz default now()
);

create index if not exists idx_ad_creatives_campaign on ad_creatives(campaign_id);
create index if not exists idx_ad_creatives_user on ad_creatives(user_id);

-- Enable RLS
alter table ad_campaigns enable row level security;
alter table ad_sets enable row level security;
alter table ad_creatives enable row level security;

create policy "Users see own campaigns" on ad_campaigns for all using (auth.uid() = user_id);
create policy "Users see own ad sets" on ad_sets for all using (auth.uid() = user_id);
create policy "Users see own creatives" on ad_creatives for all using (auth.uid() = user_id);
