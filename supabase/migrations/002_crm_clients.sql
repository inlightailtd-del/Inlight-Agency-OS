-- CRM Migration: clients table
create table if not exists clients (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  name           text not null,
  industry       text,
  status         text default 'active',
  phone          text,
  email          text,
  address        text,
  city           text,
  website        text,
  notes          text,
  monthly_retainer decimal(12,2),
  currency       text default 'PKR',
  tags           text[],
  health_score   integer default 50,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_clients_user on clients(user_id);
create index if not exists idx_clients_status on clients(status);

alter table clients enable row level security;
create policy "Users see own data" on clients for select using (auth.uid() = user_id);
create policy "Users can insert own clients" on clients for insert with check (auth.uid() = user_id);
create policy "Users can update own clients" on clients for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
