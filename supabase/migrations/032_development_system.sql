-- Inlight Autonomous Development System
-- Development memory, architecture records, build history

create table if not exists development_memory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,                         -- architecture | pattern | decision | failure | fix | lesson | plan | task
  name text not null,
  description text,
  content jsonb not null default '{}',
  tags text[] default '{}',
  status text default 'active',               -- active | archived | superseded
  superseded_by uuid references development_memory(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table development_memory enable row level security;
create policy "Users own development_memory" on development_memory for all using (auth.uid() = user_id);
create index if not exists idx_devmem_user on development_memory(user_id);
create index if not exists idx_devmem_type on development_memory(type);
create index if not exists idx_devmem_tags on development_memory using gin(tags);
