create table if not exists integration_registry (
  id uuid default gen_random_uuid() primary key,
  provider text not null unique,
  name text not null,
  description text,
  category text not null default 'api',
  auth_type text not null default 'oauth',
  supports_oauth boolean default false,
  supports_api_key boolean default false,
  base_url text,
  docs_url text,
  icon text,
  is_active boolean default true,
  config_schema jsonb default '{}',
  rate_limit_window integer default 60,
  rate_limit_max integer default 100,
  created_at timestamptz default now()
);

insert into integration_registry (provider, name, description, category, auth_type, supports_oauth, supports_api_key, base_url, rate_limit_window, rate_limit_max)
values
  ('gmail', 'Gmail', 'Google Mail integration for email outreach', 'email', 'oauth', true, false, 'https://gmail.googleapis.com', 60, 100),
  ('outlook', 'Outlook', 'Microsoft Outlook integration', 'email', 'oauth', true, false, 'https://graph.microsoft.com', 60, 100),
  ('linkedin', 'LinkedIn', 'LinkedIn professional network integration', 'social', 'oauth', true, false, 'https://api.linkedin.com', 60, 100),
  ('apollo', 'Apollo.io', 'Apollo lead intelligence and data enrichment', 'crm', 'api_key', false, true, 'https://api.apollo.io', 60, 50),
  ('clay', 'Clay', 'Clay data enrichment platform', 'data', 'api_key', false, true, 'https://api.clay.com', 60, 30),
  ('instantly', 'Instantly', 'Instantly email warmup and deliverability', 'email', 'api_key', false, true, 'https://api.instantly.ai', 60, 60),
  ('smartlead', 'Smartlead', 'Smartlead multi-channel outreach', 'email', 'api_key', false, true, 'https://api.smartlead.com', 60, 60),
  ('calendly', 'Calendly', 'Calendly meeting scheduling', 'calendar', 'oauth', true, true, 'https://api.calendly.com', 60, 50),
  ('hubspot', 'HubSpot', 'HubSpot CRM integration', 'crm', 'oauth', true, true, 'https://api.hubapi.com', 60, 100),
  ('stripe', 'Stripe', 'Stripe payment processing', 'payment', 'api_key', false, true, 'https://api.stripe.com', 60, 100),
  ('twilio', 'Twilio', 'Twilio voice and SMS', 'voice', 'api_key', false, true, 'https://api.twilio.com', 60, 100),
  ('vapi', 'Vapi', 'Vapi AI voice agents', 'voice', 'api_key', false, true, 'https://api.vapi.ai', 60, 60),
  ('bland_ai', 'Bland AI', 'Bland AI calling platform', 'voice', 'api_key', false, true, 'https://api.bland.ai', 60, 60),
  ('retell_ai', 'Retell AI', 'Retell AI voice agents', 'voice', 'api_key', false, true, 'https://api.retellai.com', 60, 60),
  ('elevenlabs', 'ElevenLabs', 'ElevenLabs voice synthesis', 'voice', 'api_key', false, true, 'https://api.elevenlabs.io', 60, 30),
  ('openai_realtime', 'OpenAI Realtime', 'OpenAI Realtime API voice', 'ai', 'api_key', false, true, 'https://api.openai.com', 60, 100),
  ('facebook', 'Facebook', 'Facebook social media integration', 'social', 'oauth', true, false, 'https://graph.facebook.com', 60, 100),
  ('instagram', 'Instagram', 'Instagram social media integration', 'social', 'oauth', true, false, 'https://graph.instagram.com', 60, 100),
  ('x', 'X / Twitter', 'X (Twitter) social media integration', 'social', 'oauth', true, true, 'https://api.twitter.com', 60, 100),
  ('youtube', 'YouTube', 'YouTube video platform integration', 'video', 'oauth', true, false, 'https://www.googleapis.com/youtube/v3', 60, 100)
on conflict (provider) do nothing;

create table if not exists integration_credentials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  auth_type text not null default 'api_key',
  label text,
  credentials jsonb not null default '{}',
  scopes text[] default '{}',
  expires_at timestamptz,
  is_expired boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists integration_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  credential_id uuid references integration_credentials(id) on delete cascade,
  status text not null default 'disconnected',
  config jsonb default '{}',
  rate_limit_remaining integer default 0,
  rate_limit_reset_at timestamptz,
  total_requests integer default 0,
  successful_requests integer default 0,
  failed_requests integer default 0,
  last_connected_at timestamptz,
  last_error text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists integration_health_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  connection_id uuid references integration_connections(id) on delete cascade,
  provider text not null,
  event text not null,
  status text not null,
  status_code integer,
  message text,
  duration_ms integer,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_ic_user on integration_credentials(user_id);
create index if not exists idx_ic_provider on integration_credentials(provider);
create index if not exists idx_iconn_user on integration_connections(user_id);
create index if not exists idx_iconn_provider on integration_connections(provider);
create index if not exists idx_iconn_status on integration_connections(status);
create index if not exists idx_ihl_connection on integration_health_logs(connection_id);
create index if not exists idx_ihl_provider on integration_health_logs(provider);
create index if not exists idx_ihl_created on integration_health_logs(created_at);

alter table integration_registry enable row level security;
alter table integration_credentials enable row level security;
alter table integration_connections enable row level security;
alter table integration_health_logs enable row level security;

create policy "Users see registry" on integration_registry for select using (true);
create policy "Users see own credentials" on integration_credentials for all using (auth.uid() = user_id);
create policy "Users see own connections" on integration_connections for all using (auth.uid() = user_id);
create policy "Users see own health logs" on integration_health_logs for all using (auth.uid() = user_id);
