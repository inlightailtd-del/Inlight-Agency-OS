create table if not exists voice_agents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  role text not null,
  voice_provider text default 'elevenlabs',
  voice_id text,
  personality text,
  language text default 'en',
  greeting_message text,
  talking_speed decimal(3,1) default 1.0,
  status text default 'idle',
  total_calls integer default 0,
  successful_calls integer default 0,
  total_duration_min integer default 0,
  performance_score integer default 0,
  config jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists call_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  goal text,
  target_count integer default 100,
  agent_id uuid references voice_agents(id),
  call_script text,
  status text not null default 'draft',
  total_calls integer default 0,
  connected_calls integer default 0,
  appointments_booked integer default 0,
  deals_closed integer default 0,
  conversion_rate decimal(5,2) default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists call_lists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  source text,
  total_numbers integer default 0,
  called integer default 0,
  connected integer default 0,
  qualified integer default 0,
  appointments integer default 0,
  status text default 'ready',
  created_at timestamptz default now()
);

create table if not exists call_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  campaign_id uuid references call_campaigns(id),
  agent_id uuid references voice_agents(id),
  prospect_name text,
  prospect_phone text,
  prospect_email text,
  status text not null default 'pending',
  duration_seconds integer default 0,
  call_provider text default 'twilio',
  call_sid text,
  ai_used boolean default true,
  sentiment text,
  interest_level text,
  outcome text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists call_transcripts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references call_sessions(id) on delete cascade,
  speaker text not null,
  content text not null,
  timestamp_sec integer default 0,
  sentiment text,
  topic text,
  created_at timestamptz default now()
);

create table if not exists call_recordings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references call_sessions(id) on delete cascade,
  url text,
  duration_seconds integer default 0,
  file_size_bytes bigint default 0,
  format text default 'mp3',
  transcribed boolean default false,
  created_at timestamptz default now()
);

create table if not exists call_outcomes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references call_sessions(id) on delete cascade,
  outcome_type text not null,
  description text,
  interested boolean default false,
  qualified boolean default false,
  meeting_booked boolean default false,
  deal_closed boolean default false,
  objection_type text,
  followup_required boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table if not exists appointment_bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references call_sessions(id),
  campaign_id uuid references call_campaigns(id),
  prospect_name text,
  prospect_email text,
  prospect_phone text,
  scheduled_at timestamptz,
  duration_min integer default 30,
  status text default 'scheduled',
  meeting_url text,
  confirmation_sent boolean default false,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_va_user on voice_agents(user_id);
create index if not exists idx_cc_user on call_campaigns(user_id);
create index if not exists idx_cl_user on call_lists(user_id);
create index if not exists idx_cs_campaign on call_sessions(campaign_id);
create index if not exists idx_cs_agent on call_sessions(agent_id);
create index if not exists idx_ct_session on call_transcripts(session_id);
create index if not exists idx_cr_session on call_recordings(session_id);
create index if not exists idx_co_session on call_outcomes(session_id);
create index if not exists idx_ab_session on appointment_bookings(session_id);
create index if not exists idx_ab_campaign on appointment_bookings(campaign_id);

alter table voice_agents enable row level security;
alter table call_campaigns enable row level security;
alter table call_lists enable row level security;
alter table call_sessions enable row level security;
alter table call_transcripts enable row level security;
alter table call_recordings enable row level security;
alter table call_outcomes enable row level security;
alter table appointment_bookings enable row level security;

create policy "Users see own voice agents" on voice_agents for all using (auth.uid() = user_id);
create policy "Users see own call campaigns" on call_campaigns for all using (auth.uid() = user_id);
create policy "Users see own call lists" on call_lists for all using (auth.uid() = user_id);
create policy "Users see own call sessions" on call_sessions for all using (auth.uid() = user_id);
create policy "Users see own transcripts" on call_transcripts for all using (auth.uid() = user_id);
create policy "Users see own recordings" on call_recordings for all using (auth.uid() = user_id);
create policy "Users see own outcomes" on call_outcomes for all using (auth.uid() = user_id);
create policy "Users see own bookings" on appointment_bookings for all using (auth.uid() = user_id);
