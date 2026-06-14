create table if not exists outreach_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  goal text,
  target_audience text,
  channels text[] default '{}',
  sequence_id uuid,
  status text not null default 'draft',
  total_prospects integer default 0,
  sent_count integer default 0,
  reply_count integer default 0,
  meeting_count integer default 0,
  conversion_rate decimal(5,2) default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists prospect_lists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  source_id uuid,
  total_count integer default 0,
  qualified_count integer default 0,
  status text default 'building',
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists prospect_sources (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  provider text not null,
  config jsonb default '{}',
  total_scraped integer default 0,
  last_run_at timestamptz,
  status text default 'idle',
  created_at timestamptz default now()
);

create table if not exists outreach_sequences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  channel text not null default 'email',
  steps jsonb default '[]',
  total_steps integer default 1,
  delay_hours integer[] default '{}',
  total_sent integer default 0,
  total_replies integer default 0,
  total_bounces integer default 0,
  total_meetings integer default 0,
  performance_score integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists outreach_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  campaign_id uuid references outreach_campaigns(id) on delete cascade,
  sequence_id uuid references outreach_sequences(id),
  prospect_id uuid,
  prospect_name text,
  prospect_email text,
  channel text not null,
  subject text,
  body text,
  personalization text,
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  clicked_at timestamptz,
  bounced boolean default false,
  status text default 'draft',
  created_at timestamptz default now()
);

create table if not exists outreach_responses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  message_id uuid references outreach_messages(id) on delete cascade,
  response_type text not null default 'reply',
  content text,
  sentiment text default 'neutral',
  interest_level text default 'low',
  followup_required boolean default false,
  created_at timestamptz default now()
);

create table if not exists appointments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  prospect_id uuid,
  prospect_name text,
  prospect_email text,
  campaign_id uuid references outreach_campaigns(id),
  scheduled_at timestamptz,
  duration_min integer default 30,
  status text default 'scheduled',
  meeting_url text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists deal_pipeline (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  prospect_id uuid,
  prospect_name text,
  prospect_email text,
  campaign_id uuid references outreach_campaigns(id),
  stage text not null default 'discovery',
  value decimal(12,2) default 0,
  probability integer default 10,
  notes text,
  closed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_oc_user on outreach_campaigns(user_id);
create index if not exists idx_pl_user on prospect_lists(user_id);
create index if not exists idx_ps_user on prospect_sources(user_id);
create index if not exists idx_os_user on outreach_sequences(user_id);
create index if not exists idx_om_campaign on outreach_messages(campaign_id);
create index if not exists idx_om_prospect on outreach_messages(prospect_id);
create index if not exists idx_or_message on outreach_responses(message_id);
create index if not exists idx_appt_prospect on appointments(prospect_id);
create index if not exists idx_dp_prospect on deal_pipeline(prospect_id);

alter table outreach_campaigns enable row level security;
alter table prospect_lists enable row level security;
alter table prospect_sources enable row level security;
alter table outreach_sequences enable row level security;
alter table outreach_messages enable row level security;
alter table outreach_responses enable row level security;
alter table appointments enable row level security;
alter table deal_pipeline enable row level security;

create policy "Users see own campaigns" on outreach_campaigns for all using (auth.uid() = user_id);
create policy "Users see own lists" on prospect_lists for all using (auth.uid() = user_id);
create policy "Users see own sources" on prospect_sources for all using (auth.uid() = user_id);
create policy "Users see own sequences" on outreach_sequences for all using (auth.uid() = user_id);
create policy "Users see own messages" on outreach_messages for all using (auth.uid() = user_id);
create policy "Users see own responses" on outreach_responses for all using (auth.uid() = user_id);
create policy "Users see own appointments" on appointments for all using (auth.uid() = user_id);
create policy "Users see own deals" on deal_pipeline for all using (auth.uid() = user_id);
