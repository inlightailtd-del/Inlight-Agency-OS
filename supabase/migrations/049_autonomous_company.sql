-- Autonomous Company Phase 15
-- Tables for support tickets and company approval system

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category TEXT NOT NULL DEFAULT 'general',
  customer_name TEXT,
  customer_email TEXT,
  assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  resolution TEXT,
  auto_response TEXT,
  auto_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own support tickets"
  ON support_tickets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON support_tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(user_id, priority, status);

-- Company Approvals
CREATE TABLE IF NOT EXISTS company_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE company_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own company approvals"
  ON company_approvals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_company_approvals_status ON company_approvals(user_id, status);

-- CTO reviews
ALTER TABLE development_memory ADD COLUMN IF NOT EXISTS cto_reviewed BOOLEAN DEFAULT false;
ALTER TABLE development_memory ADD COLUMN IF NOT EXISTS cto_score INTEGER;

-- Video projects SEO metadata
ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS seo_tags TEXT[] DEFAULT '{}';
