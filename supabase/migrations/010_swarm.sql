-- Swarm Intelligence — Cross-agent collaboration, memory, negotiation, consensus, conflict resolution

-- Swarm Rounds (top-level execution context for a swarm cycle)
create table if not exists swarm_rounds (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  objective      text not null,
  department     text,                              -- primary department driving this round
  status         text not null default 'initiated', -- initiated | gathering | negotiating | resolving | consensus | executing | completed | failed
  round_number   int not null default 1,
  context        jsonb default '{}',
  started_at     timestamptz default now(),
  completed_at   timestamptz,
  updated_at     timestamptz default now()
);
create index if not exists idx_swarm_rounds_user on swarm_rounds(user_id);
create index if not exists idx_swarm_rounds_status on swarm_rounds(status);
alter table swarm_rounds enable row level security;
create policy "Users see own swarm rounds" on swarm_rounds for all using (auth.uid() = user_id);

-- Swarm Round Participants (which agents are involved in a round)
create table if not exists swarm_round_participants (
  id             uuid default gen_random_uuid() primary key,
  round_id       uuid references swarm_rounds(id) on delete cascade,
  agent_id       uuid references agents(id),
  role           text not null,                     -- lead | contributor | mediator | observer
  department     text,
  vote_weight    real not null default 1.0,
  joined_at      timestamptz default now()
);
create index if not exists idx_swarm_participants_round on swarm_round_participants(round_id);
alter table swarm_round_participants enable row level security;
create policy "Users see own swarm participants" on swarm_round_participants for all using (
  round_id in (select id from swarm_rounds where user_id = auth.uid())
);

-- Swarm Shared Memory (structured cross-agent memory)
create table if not exists swarm_shared_memory (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  key            text not null,                     -- namespaced identifier
  value          jsonb not null default '{}',
  writer_agent_id uuid references agents(id),
  department     text,
  tags           text[] default '{}',
  version        int not null default 1,
  conflict_resolved boolean default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(user_id, key)
);
create index if not exists idx_swarm_shared_memory_user on swarm_shared_memory(user_id);
create index if not exists idx_swarm_shared_memory_tags on swarm_shared_memory using gin(tags);
alter table swarm_shared_memory enable row level security;
create policy "Users see own swarm shared memory" on swarm_shared_memory for all using (auth.uid() = user_id);

-- Swarm Messages (inter-agent communication within a swarm round)
create table if not exists swarm_messages (
  id             uuid default gen_random_uuid() primary key,
  round_id       uuid references swarm_rounds(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  from_agent_id  uuid references agents(id),
  to_agent_id    uuid references agents(id),        -- null = broadcast
  message_type   text not null default 'proposal',  -- proposal | counter_offer | vote | objection | resolution | information
  subject        text,
  body           text not null,
  context        jsonb default '{}',
  created_at     timestamptz default now()
);
create index if not exists idx_swarm_messages_round on swarm_messages(round_id);
create index if not exists idx_swarm_messages_type on swarm_messages(message_type);
alter table swarm_messages enable row level security;
create policy "Users see own swarm messages" on swarm_messages for all using (auth.uid() = user_id);

-- Swarm Consensus Votes
create table if not exists swarm_consensus_votes (
  id             uuid default gen_random_uuid() primary key,
  round_id       uuid references swarm_rounds(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  agent_id       uuid references agents(id),
  proposal_key   text not null,                     -- what is being voted on
  vote           text not null,                     -- approve | reject | abstain | amend
  rationale      text,
  vote_weight    real not null default 1.0,
  created_at     timestamptz default now()
);
create index if not exists idx_swarm_votes_round on swarm_consensus_votes(round_id);
create index if not exists idx_swarm_votes_proposal on swarm_consensus_votes(proposal_key);
alter table swarm_consensus_votes enable row level security;
create policy "Users see own swarm votes" on swarm_consensus_votes for all using (auth.uid() = user_id);

-- Swarm Conflicts (disagreements requiring resolution)
create table if not exists swarm_conflicts (
  id             uuid default gen_random_uuid() primary key,
  round_id       uuid references swarm_rounds(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  conflict_type  text not null,                     -- resource_allocation | priority | approach | budget | timeline | memory_write
  severity       text not null default 'medium',    -- low | medium | high | critical
  agents_involved uuid[] not null,
  mediator_agent_id uuid references agents(id),
  status         text not null default 'open',      -- open | mediating | resolved | escalated
  resolution     text,
  resolution_strategy text,                         -- auto_override | lead_decision | vote | escalate
  created_at     timestamptz default now(),
  resolved_at    timestamptz,
  updated_at     timestamptz default now()
);
create index if not exists idx_swarm_conflicts_round on swarm_conflicts(round_id);
create index if not exists idx_swarm_conflicts_status on swarm_conflicts(status);
alter table swarm_conflicts enable row level security;
create policy "Users see own swarm conflicts" on swarm_conflicts for all using (auth.uid() = user_id);

-- Swarm Collaborations (cross-department projects)
create table if not exists swarm_collaborations (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  departments    text[] not null,
  lead_agent_id  uuid references agents(id),
  status         text not null default 'active',    -- active | blocked | completed | cancelled
  progress       real not null default 0,           -- 0..100
  milestones     jsonb default '[]',
  started_at     timestamptz default now(),
  completed_at   timestamptz,
  updated_at     timestamptz default now()
);
create index if not exists idx_swarm_collaborations_user on swarm_collaborations(user_id);
create index if not exists idx_swarm_collaborations_status on swarm_collaborations(status);
alter table swarm_collaborations enable row level security;
create policy "Users see own swarm collaborations" on swarm_collaborations for all using (auth.uid() = user_id);

-- Swarm Collaboration Tasks (individual tasks within a collaboration)
create table if not exists swarm_collaboration_tasks (
  id             uuid default gen_random_uuid() primary key,
  collaboration_id uuid references swarm_collaborations(id) on delete cascade,
  agent_id       uuid references agents(id),
  department     text,
  title          text not null,
  description    text,
  status         text not null default 'pending',   -- pending | in_progress | completed | failed | blocked
  priority       text default 'medium',
  depends_on     uuid[] default '{}',               -- task IDs that must complete first
  output         text,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_swarm_collab_tasks_collab on swarm_collaboration_tasks(collaboration_id);
alter table swarm_collaboration_tasks enable row level security;
create policy "Users see own collab tasks" on swarm_collaboration_tasks for all using (
  collaboration_id in (select id from swarm_collaborations where user_id = auth.uid())
);
