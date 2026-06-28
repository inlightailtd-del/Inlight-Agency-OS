-- ============================================================
-- 039_fix_agent_approvals.sql
-- SAFE, IDEMPOTENT version — can be run on an existing database
-- without duplicate-policy or FK constraint errors.
--
-- CHANGES FROM ORIGINAL 039:
--   1. agent_id is nullable (content workflow creates approvals
--      without an assigned agent)
--   2. CREATE POLICY IF NOT EXISTS (prevents duplicate-policy error)
--   3. Uses DO block to safely enable RLS (idempotent)
--   4. All other statements already use IF NOT EXISTS ✅
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. CREATE TABLE (if not exists)
--    agent_id is nullable — the content pipeline creates approval
--    requests for content items that have no assigned agent yet.
-- ═══════════════════════════════════════════════════════════════
create table if not exists agent_approval_requests (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  agent_id        uuid,                    -- nullable: content approvals have no agent
  action          text not null,
  target_type     text not null,
  target_id       uuid,
  summary         text not null,
  justification   text,
  impact          text default 'medium',
  current_state   jsonb default '{}',
  proposed_change jsonb not null default '{}',
  status          text not null default 'pending',
  reasoning       text,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  expires_at      timestamptz,
  task_id         uuid,
  execution_id    uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. INDEXES (all use IF NOT EXISTS — safe to re-run)
-- ═══════════════════════════════════════════════════════════════
create index if not exists idx_agent_approvals_user
  on agent_approval_requests(user_id);
create index if not exists idx_agent_approvals_status
  on agent_approval_requests(status);
create index if not exists idx_agent_approvals_agent
  on agent_approval_requests(agent_id);
create index if not exists idx_agent_approvals_target
  on agent_approval_requests(target_type, target_id);
create index if not exists idx_agent_approvals_pending
  on agent_approval_requests(user_id, status)
  where status = 'pending';

-- ═══════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY
--    DO block makes ENABLE ROW LEVEL SECURITY idempotent
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where relname = 'agent_approval_requests'
    and relrowsecurity = true
  ) then
    execute 'alter table agent_approval_requests enable row level security';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS POLICY (IF NOT EXISTS — prevents duplicate error)
-- ═══════════════════════════════════════════════════════════════
create policy if not exists "Users see own approval requests"
  on agent_approval_requests for all
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════
-- Run this to confirm the table exists:
--   SELECT EXISTS (
--     SELECT FROM information_schema.tables
--     WHERE table_name = 'agent_approval_requests'
--   );
--
-- Run this to confirm you can insert (will work with agent_id = null):
--   INSERT INTO agent_approval_requests (
--     user_id, agent_id, action, target_type, summary, proposed_change
--   ) VALUES (
--     '964b0cbe-cb92-40e0-9693-b9aaabf629ce',
--     null,
--     'content_action',
--     'content_request',
--     'Test approval from content workflow',
--     '{}'::jsonb
--   );
