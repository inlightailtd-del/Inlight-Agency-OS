-- CRM Migration: contacts table
create table if not exists contacts (
  id           uuid default gen_random_uuid() primary key,
  client_id    uuid references clients(id) on delete cascade,
  name         text not null,
  email        text,
  phone        text,
  whatsapp     text,
  title        text,
  is_primary   boolean default false,
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists idx_contacts_client on contacts(client_id);

alter table contacts enable row level security;
create policy "Users see contacts for own clients" on contacts for select
  using (client_id in (select id from clients where user_id = auth.uid()));
create policy "Users can insert contacts for own clients" on contacts for insert
  with check (client_id in (select id from clients where user_id = auth.uid()));
create policy "Users can update contacts for own clients" on contacts for update
  using (client_id in (select id from clients where user_id = auth.uid()))
  with check (client_id in (select id from clients where user_id = auth.uid()));
