-- Night Shift System
-- Autonomous overnight execution engine for processing goals via DevLoopV3

-- ============================================================
-- 1. night_shift_goals — Goal queue for night shift processing
-- ============================================================

create table if not exists night_shift_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  objective     text not null,
  priority      integer not null default 5,
  category      text not null default 'general',
  status        text not null default 'queued'
                check (status in ('queued', 'running', 'completed', 'failed', 'skipped')),
  tags          text[] default '{}',
  max_retries   integer not null default 2,
  retry_count   integer not null default 0,
  scheduled_for timestamptz,
  result_summary text,
  result_data   jsonb,
  error_message  text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table night_shift_goals enable row level security;

create policy "Users see own night shift goals"
  on night_shift_goals for all
  using (auth.uid() = user_id);

create index if not exists idx_night_shift_goals_user_status
  on night_shift_goals (user_id, status);

create index if not exists idx_night_shift_goals_priority
  on night_shift_goals (user_id, priority asc, created_at asc)
  where status = 'queued';

-- ============================================================
-- 2. night_shift_reports — Nightly execution reports
-- ============================================================

create table if not exists night_shift_reports (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  report_date           date not null,
  period                text not null default 'night'
                        check (period in ('night', 'day', 'custom')),
  total_goals           integer not null default 0,
  completed_goals       integer not null default 0,
  failed_goals          integer not null default 0,
  skipped_goals         integer not null default 0,
  total_phases          integer not null default 0,
  total_commits         integer not null default 0,
  total_errors          integer not null default 0,
  total_duration_seconds integer not null default 0,
  quality_score         numeric(4,1),
  summary               text,
  top_issues            text[] default '{}',
  suggested_next        text[] default '{}',
  lessons               jsonb default '[]',
  created_at            timestamptz not null default now()
);

alter table night_shift_reports enable row level security;

create policy "Users see own night shift reports"
  on night_shift_reports for all
  using (auth.uid() = user_id);

create index if not exists idx_night_shift_reports_user_date
  on night_shift_reports (user_id, report_date desc);

-- ============================================================
-- 3. night_shift_schedule — Per-user scheduling configuration
-- ============================================================

create table if not exists night_shift_schedule (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  is_active         boolean not null default true,
  interval_minutes  integer not null default 60,
  max_cycles        integer not null default 10,
  updated_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint uq_night_shift_schedule_user unique (user_id)
);

alter table night_shift_schedule enable row level security;

create policy "Users see own night shift schedule"
  on night_shift_schedule for all
  using (auth.uid() = user_id);
