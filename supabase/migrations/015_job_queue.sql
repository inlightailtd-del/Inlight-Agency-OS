create table if not exists job_queue (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  job_type       text not null,         -- agent_execution | workflow | content_generation | lead_analysis
  payload        jsonb not null default '{}',
  status         text not null default 'pending',  -- pending | running | completed | failed
  priority       integer default 0,
  max_retries    integer default 3,
  retry_count    integer default 0,
  result         jsonb,
  error_msg      text,
  scheduled_at   timestamptz,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_job_queue_status on job_queue(status);
create index if not exists idx_job_queue_user on job_queue(user_id);
create index if not exists idx_job_queue_priority on job_queue(priority, created_at);

alter table job_queue enable row level security;
create policy "Users see own jobs" on job_queue for all using (auth.uid() = user_id);
