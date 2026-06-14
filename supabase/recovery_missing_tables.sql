-- ============================================================
-- RECOVERY: Missing Tables Deployment
-- Safe to run on current database
-- Paste into Supabase SQL Editor and execute
-- ============================================================

-- ============================================================
-- 1. KNOWLEDGE DOCS (Migration 005)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  content        TEXT,
  category       TEXT NOT NULL DEFAULT 'general',
  department     TEXT,
  status         TEXT NOT NULL DEFAULT 'published',
  tags           TEXT[] DEFAULT '{}',
  version        INTEGER DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_user ON knowledge_docs(user_id);
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own knowledge docs" ON knowledge_docs FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS knowledge_doc_versions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id         UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,
  title          TEXT NOT NULL,
  content        TEXT,
  changed_by     UUID REFERENCES auth.users(id),
  change_summary TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE knowledge_doc_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see versions for own docs" ON knowledge_doc_versions FOR SELECT
  USING (doc_id IN (SELECT id FROM knowledge_docs WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert versions for own docs" ON knowledge_doc_versions
  FOR INSERT WITH CHECK (doc_id IN (SELECT id FROM knowledge_docs WHERE user_id = auth.uid()));

-- ============================================================
-- 2. AGENTS (Migration 006)
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  type           TEXT NOT NULL DEFAULT 'general',
  role           TEXT,
  status         TEXT NOT NULL DEFAULT 'offline',
  department     TEXT,
  assigned_tasks   INTEGER DEFAULT 0,
  assigned_projects INTEGER DEFAULT 0,
  performance_score INTEGER DEFAULT 0,
  total_executions  INTEGER DEFAULT 0,
  success_rate     INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
  config         JSONB DEFAULT '{}',
  last_active_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own agents" ON agents FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 3. AUTOMATIONS (Migration 007)
-- ============================================================
CREATE TABLE IF NOT EXISTS automations (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL DEFAULT 'internal',
  status         TEXT NOT NULL DEFAULT 'draft',
  trigger_type   TEXT DEFAULT 'manual',
  schedule_cron  TEXT,
  total_runs     INTEGER DEFAULT 0,
  success_runs   INTEGER DEFAULT 0,
  failed_runs    INTEGER DEFAULT 0,
  last_run_at    TIMESTAMPTZ,
  performance_score INTEGER DEFAULT 0,
  config         JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own automations" ON automations FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS automation_runs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id  UUID REFERENCES automations(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending',
  started_at     TIMESTAMPTZ DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  duration_ms    INTEGER,
  result         JSONB,
  error_msg      TEXT,
  triggered_by   TEXT DEFAULT 'manual'
);

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see runs for own automations" ON automation_runs FOR SELECT
  USING (automation_id IN (SELECT id FROM automations WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert runs for own automations" ON automation_runs
  FOR INSERT WITH CHECK (automation_id IN (SELECT id FROM automations WHERE user_id = auth.uid()));

-- ============================================================
-- 4. COMMAND CENTER (Migration 008)
-- ============================================================
CREATE TABLE IF NOT EXISTS commands (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  command        TEXT NOT NULL,
  response       TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  category       TEXT,
  agent_id       UUID REFERENCES agents(id),
  automation_id  UUID REFERENCES automations(id),
  execution_time_ms INTEGER,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commands_user ON commands(user_id);
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own commands" ON commands FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS execution_logs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  command_id     UUID REFERENCES commands(id) ON DELETE CASCADE,
  action         TEXT NOT NULL,
  module         TEXT,
  entity_type    TEXT,
  entity_id      UUID,
  result         JSONB,
  status         TEXT NOT NULL DEFAULT 'success',
  message        TEXT,
  duration_ms    INTEGER,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_logs_user ON execution_logs(user_id);
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own execution logs" ON execution_logs FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 5. ORCHESTRATOR (Migration 009)
-- ============================================================
CREATE TABLE IF NOT EXISTS orchestrator_tasks (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  agent_id       UUID REFERENCES agents(id),
  status         TEXT NOT NULL DEFAULT 'pending',
  priority       TEXT DEFAULT 'medium',
  result         TEXT,
  assigned_at    TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orch_tasks_user ON orchestrator_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_orch_tasks_agent ON orchestrator_tasks(agent_id);
ALTER TABLE orchestrator_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own orchestrator tasks" ON orchestrator_tasks FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS agent_messages (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  from_agent_id  UUID REFERENCES agents(id),
  to_agent_id    UUID REFERENCES agents(id),
  message        TEXT NOT NULL,
  context        JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_user ON agent_messages(user_id);
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own agent messages" ON agent_messages FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS orchestrator_memory (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key            TEXT NOT NULL,
  value          JSONB NOT NULL DEFAULT '{}',
  agent_id       UUID REFERENCES agents(id),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_orch_memory_user ON orchestrator_memory(user_id);
ALTER TABLE orchestrator_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own orchestrator memory" ON orchestrator_memory FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 6. CONTENT ENGINE (Migration 010)
-- ============================================================
CREATE TABLE IF NOT EXISTS content_requests (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  content_type   TEXT NOT NULL DEFAULT 'blog',
  description    TEXT,
  platform       TEXT,
  tone           TEXT DEFAULT 'professional',
  status         TEXT NOT NULL DEFAULT 'draft',
  word_count     INTEGER,
  generated_content TEXT,
  feedback       TEXT,
  score          INTEGER DEFAULT 0,
  tags           TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_requests_user ON content_requests(user_id);
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own content requests" ON content_requests FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 7. LEADS (Migration 011)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  company        TEXT,
  website        TEXT,
  email          TEXT,
  phone          TEXT,
  industry       TEXT,
  country        TEXT,
  source         TEXT NOT NULL DEFAULT 'manual',
  status         TEXT NOT NULL DEFAULT 'new',
  score          INTEGER DEFAULT 0,
  notes          TEXT,
  tags           TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own leads" ON leads FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 8. AI EXECUTION ENGINE (Migration 012)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL DEFAULT 'ollama',
  model          TEXT NOT NULL DEFAULT 'llama3.1',
  api_url        TEXT DEFAULT 'http://localhost:11434',
  api_key        TEXT,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_user ON ai_provider_configs(user_id);
ALTER TABLE ai_provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own AI configs" ON ai_provider_configs FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS agent_executions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id       UUID REFERENCES agents(id),
  command_id     UUID REFERENCES commands(id),
  task_id        UUID REFERENCES orchestrator_tasks(id),
  prompt         TEXT NOT NULL,
  response       TEXT,
  model          TEXT,
  provider       TEXT,
  tokens_used    INTEGER DEFAULT 0,
  duration_ms    INTEGER DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'running',
  error_msg      TEXT,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_executions_user ON agent_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent ON agent_executions(agent_id);
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own agent executions" ON agent_executions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS agent_memory (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id       UUID REFERENCES agents(id),
  category       TEXT NOT NULL DEFAULT 'general',
  content        JSONB NOT NULL DEFAULT '{}',
  tags           TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id);
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own agent memory" ON agent_memory FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after deployment to verify all tables exist

SELECT 'knowledge_docs' AS table_name, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_docs') AS exists
UNION ALL SELECT 'knowledge_doc_versions', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_doc_versions')
UNION ALL SELECT 'agents', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agents')
UNION ALL SELECT 'automations', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'automations')
UNION ALL SELECT 'automation_runs', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_runs')
UNION ALL SELECT 'commands', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'commands')
UNION ALL SELECT 'execution_logs', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'execution_logs')
UNION ALL SELECT 'orchestrator_tasks', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'orchestrator_tasks')
UNION ALL SELECT 'agent_messages', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_messages')
UNION ALL SELECT 'orchestrator_memory', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'orchestrator_memory')
UNION ALL SELECT 'content_requests', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'content_requests')
UNION ALL SELECT 'leads', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'leads')
UNION ALL SELECT 'ai_provider_configs', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_provider_configs')
UNION ALL SELECT 'agent_executions', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_executions')
UNION ALL SELECT 'agent_memory', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_memory');