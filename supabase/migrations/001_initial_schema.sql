-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enable pgvector extension for embeddings
create extension if not exists "vector";

-- ============================================================
-- TABLE 1: profiles (extends Supabase auth.users)
-- ============================================================
create table if not exists profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  full_name    text,
  email        text,
  role         text default 'admin', -- admin | manager | member
  avatar_url   text,
  created_at   timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- TABLE 5: projects
-- ============================================================
create table if not exists projects (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  client_id    uuid references clients(id),
  name         text not null,
  description  text,
  status       text default 'planning',     -- planning | active | paused | completed | cancelled
  priority     text default 'medium',       -- low | medium | high | critical
  start_date   date,
  end_date     date,
  budget       decimal(12,2),
  actual_cost  decimal(12,2) default 0,
  currency     text default 'PKR',
  service_type text,                        -- seo | social_media | paid_ads | web_dev | ai_automation
  health       text default 'good',         -- good | at_risk | critical (set by agent)
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_projects_user on projects(user_id);
create index if not exists idx_projects_client on projects(client_id);
create index if not exists idx_projects_status on projects(status);

-- ============================================================
-- TABLE 6: milestones
-- ============================================================
create table if not exists milestones (
  id           uuid default gen_random_uuid() primary key,
  project_id   uuid references projects(id) on delete cascade,
  name         text not null,
  description  text,
  status       text default 'pending',      -- pending | in_progress | completed | delayed
  due_date     date,
  completed_at timestamptz,
  order_index  integer default 0,
  created_at   timestamptz default now()
);

-- ============================================================
-- TABLE 7: tasks
-- ============================================================
create table if not exists tasks (
  id             uuid default gen_random_uuid() primary key,
  project_id     uuid references projects(id) on delete cascade,
  milestone_id   uuid references milestones(id),
  title          text not null,
  description    text,
  status         text default 'todo',       -- todo | in_progress | review | done | blocked
  priority       text default 'medium',
  due_date       date,
  completed_at   timestamptz,
  estimated_hrs  decimal(5,2),
  actual_hrs     decimal(5,2),
  tags           text[],
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_due on tasks(due_date);

-- ============================================================
-- TABLE 8: invoices
-- ============================================================
create table if not exists invoices (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  client_id      uuid references clients(id),
  project_id     uuid references projects(id),
  invoice_number text unique not null,      -- e.g., INV-2026-001
  status         text default 'draft',      -- draft | sent | paid | overdue | cancelled
  issue_date     date default current_date,
  due_date       date,
  paid_at        timestamptz,
  subtotal       decimal(12,2) default 0,
  tax_rate       decimal(5,2) default 0,
  tax_amount     decimal(12,2) default 0,
  discount       decimal(12,2) default 0,
  total          decimal(12,2) default 0,
  currency       text default 'PKR',
  notes          text,
  payment_method text,                      -- bank_transfer | cash | easypaisa | jazzcash
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_due on invoices(due_date);

-- ============================================================
-- TABLE 9: invoice_items
-- ============================================================
create table if not exists invoice_items (
  id           uuid default gen_random_uuid() primary key,
  invoice_id   uuid references invoices(id) on delete cascade,
  description  text not null,
  quantity     decimal(8,2) default 1,
  unit_price   decimal(12,2) not null,
  total        decimal(12,2) generated always as (quantity * unit_price) stored,
  order_index  integer default 0
);

-- ============================================================
-- TABLE 10: expenses
-- ============================================================
create table if not exists expenses (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  project_id   uuid references projects(id),
  client_id    uuid references clients(id),
  description  text not null,
  amount       decimal(12,2) not null,
  currency     text default 'PKR',
  category     text,                        -- software | ads_budget | freelancer | other
  expense_date date default current_date,
  is_billable  boolean default false,
  receipt_url  text,
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists idx_expenses_user on expenses(user_id);
create index if not exists idx_expenses_project on expenses(project_id);

-- ============================================================
-- TABLE 11: memories (Company Brain Vector Store)
-- ============================================================
create table if not exists memories (
  id           uuid default gen_random_uuid() primary key,
  content      text not null,              -- The text content of the memory
  embedding    vector(768),                -- nomic-embed-text is 768 dims
  memory_type  text not null,              -- episode | knowledge | procedure | insight
  entity_type  text,                       -- client | project | task | invoice | general
  entity_id    uuid,                       -- Reference to the entity
  importance   integer default 5,         -- 1-10, higher = more important
  source       text,                       -- agent_name or 'user' or 'system'
  metadata     jsonb default '{}',
  created_at   timestamptz default now()
);

-- CRITICAL: This index makes similarity search fast
create index if not exists memories_embedding_idx on memories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_memories_type on memories(memory_type);
create index if not exists idx_memories_entity on memories(entity_type, entity_id);

-- ============================================================
-- TABLE 12: agent_logs (Agent Execution History)
-- ============================================================
create table if not exists agent_logs (
  id           uuid default gen_random_uuid() primary key,
  agent_name   text not null,              -- project_monitor | client_intelligence | etc.
  run_type     text default 'scheduled',   -- scheduled | triggered | manual
  status       text default 'running',     -- running | completed | failed
  input        jsonb,
  output       jsonb,
  insights     text[],                     -- Key insights discovered
  actions_taken text[],                    -- What the agent did
  error_msg    text,
  duration_ms  integer,
  created_at   timestamptz default now()
);

create index if not exists idx_agent_logs_agent on agent_logs(agent_name);
create index if not exists idx_agent_logs_created on agent_logs(created_at);

-- ============================================================
-- TABLE 13: notifications (In-App Notifications)
-- ============================================================
create table if not exists notifications (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  type         text not null,              -- alert | info | warning | success
  title        text not null,
  message      text,
  source       text,                       -- agent_name or 'system'
  entity_type  text,
  entity_id    uuid,
  is_read      boolean default false,
  read_at      timestamptz,
  created_at   timestamptz default now()
);

create index if not exists idx_notifications_user on notifications(user_id, is_read);

-- ============================================================
-- TABLE 14: settings (App Configuration)
-- ============================================================
create table if not exists settings (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  key          text not null,
  value        jsonb,
  updated_at   timestamptz default now(),
  unique(user_id, key)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table projects enable row level security;
alter table milestones enable row level security;
alter table tasks enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table expenses enable row level security;
alter table memories enable row level security;
alter table agent_logs enable row level security;
alter table notifications enable row level security;
alter table settings enable row level security;

-- RLS Policies
create policy "Users see own data" on projects for all using (auth.uid() = user_id);
create policy "Users see own data" on invoices for all using (auth.uid() = user_id);
create policy "Users see own data" on expenses for all using (auth.uid() = user_id);
create policy "Users see own data" on notifications for all using (auth.uid() = user_id);
create policy "Users see own data" on settings for all using (auth.uid() = user_id);

-- Allow reading milestones and tasks linked to user's projects
create policy "Users see milestones for own projects" on milestones for select
  using (project_id in (select id from projects where user_id = auth.uid()));

create policy "Users see tasks for own projects" on tasks for select
  using (project_id in (select id from projects where user_id = auth.uid()));

-- Memories are readable by all (for RAG), writable by service role
create policy "Users see all memories" on memories for select using (true);
create policy "Service can insert memories" on memories for insert with check (true);
create policy "Service can update memories" on memories for update with check (true);

-- Agent logs are readable by all, writable by service role
create policy "Users see all agent logs" on agent_logs for select using (true);
create policy "Service can insert agent logs" on agent_logs for insert with check (true);
