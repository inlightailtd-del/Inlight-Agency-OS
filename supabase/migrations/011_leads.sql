create table if not exists leads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  company text,
  website text,
  email text,
  phone text,
  industry text,
  country text,
  source text not null default 'manual', -- website | linkedin | facebook | google_maps | manual
  status text not null default 'new', -- new | contacted | qualified | proposal | converted | lost
  score integer default 0,
  notes text,
  tags text[] default '{}',
  converted_client_id uuid references clients(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_leads_user on leads(user_id);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_source on leads(source);
alter table leads enable row level security;
create policy "Users see own leads" on leads for all using (auth.uid() = user_id);