-- AI Runtime Migration
-- Creates tables for AI provider configuration, execution tracking, and agent memory

-- ============================================================
-- 1. AI Provider Configurations
-- Stores user-specific AI provider settings (Ollama, OpenAI, Anthropic, Groq)
-- ============================================================
create table if not exists ai_provider_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null default 'ollama', -- ollama | openai | anthropic | groq
  model text not null default 'llama3.1',
  api_url text default 'http://localhost:11434',
  api_key text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, provider, model)
);

-- Indexes
create index if not exists idx_ai_provider_configs_user on ai_provider_configs(user_id);
create index if not exists idx_ai_provider_configs_active on ai_provider_configs(user_id, is_active);

-- RLS
alter table ai_provider_configs enable row level security;
create policy "Users see own AI configs" on ai_provider_configs for all using (auth.uid() = user_id);

-- ============================================================
-- 2. Agent Executions
-- Tracks every AI execution with prompt, response, timing, and status
-- ============================================================
create table if not exists agent_executions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  agent_id uuid references agents(id),
  command_id uuid references commands(id),
  task_id uuid references orchestrator_tasks(id),
  prompt text not null,
  response text,
  model text,
  provider text,
  tokens_used integer default 0,
  duration_ms integer default 0,
  status text not null default 'running', -- running | completed | failed
  error_msg text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_agent_executions_user on agent_executions(user_id);
create index if not exists idx_agent_executions_agent on agent_executions(agent_id);
create index if not exists idx_agent_executions_status on agent_executions(status);
create index if not exists idx_agent_executions_created on agent_executions(created_at);

-- RLS
alter table agent_executions enable row level security;
create policy "Users see own agent executions" on agent_executions for all using (auth.uid() = user_id);

-- ============================================================
-- 3. Agent Memory
-- Stores execution history, context, outputs, and learning data
-- ============================================================
create table if not exists agent_memory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  agent_id uuid references agents(id),
  category text not null default 'general', -- context | output | error | learning
  content jsonb not null default '{}',
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_agent_memory_user on agent_memory(user_id);
create index if not exists idx_agent_memory_agent on agent_memory(agent_id);
create index if not exists idx_agent_memory_category on agent_memory(category);

-- RLS
alter table agent_memory enable row level security;
create policy "Users see own agent memory" on agent_memory for all using (auth.uid() = user_id);