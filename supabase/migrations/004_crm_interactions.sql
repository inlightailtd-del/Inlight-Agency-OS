-- CRM Migration: interactions table
create table if not exists interactions (
  id             uuid default gen_random_uuid() primary key,
  client_id      uuid references clients(id) on delete cascade,
  contact_id     uuid references contacts(id),
  type           text not null,
  subject        text,
  notes          text,
  date           timestamptz default now(),
  duration_min   integer,
  next_action    text,
  next_action_date date,
  created_at     timestamptz default now()
);

create index if not exists idx_interactions_client on interactions(client_id);
create index if not exists idx_interactions_date on interactions(date);

alter table interactions enable row level security;
create policy "Users see interactions for own clients" on interactions for select
  using (client_id in (select id from clients where user_id = auth.uid()));
create policy "Users can insert interactions for own clients" on interactions for insert
  with check (client_id in (select id from clients where user_id = auth.uid()));
create policy "Users can update interactions for own clients" on interactions for update
  using (client_id in (select id from clients where user_id = auth.uid()))
  with check (client_id in (select id from clients where user_id = auth.uid()));
