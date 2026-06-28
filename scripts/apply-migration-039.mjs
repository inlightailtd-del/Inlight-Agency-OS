/**
 * Apply Migration 039 to the live Supabase database.
 * Uses the Management API PAT token.
 */

const SUPABASE_URL = 'https://wvintltwxydmlyvcmcis.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW50bHR3eHlkbWx5dmNtY2lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNDg0MiwiZXhwIjoyMDk2NTkwODQyfQ.25gxInJRwIZ29LoeWyJpBZfkhUO2sMHIxtspS8YbwDM'

const SQL = `
CREATE TABLE IF NOT EXISTS agent_approval_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  summary text NOT NULL,
  justification text,
  impact text DEFAULT 'medium',
  current_state jsonb DEFAULT '{}'::jsonb,
  proposed_change jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  reasoning text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  expires_at timestamptz,
  task_id uuid,
  execution_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_user ON agent_approval_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_status ON agent_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_agent ON agent_approval_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_target ON agent_approval_requests(target_type, target_id);

ALTER TABLE agent_approval_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own approval requests" ON agent_approval_requests;
CREATE POLICY "Users see own approval requests"
  ON agent_approval_requests FOR ALL
  USING (auth.uid() = user_id);
`

async function main() {
  console.log('Applying Migration 039...')

  // Step 1: Create the table via REST API (SQL endpoint)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  })
  console.log(`API root: ${res.status}`)

  // Step 2: Try to create the table via the /rpc/ path
  // Supabase allows raw SQL via a special approach using the query endpoint
  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({}),
  })
  const createText = await createRes.text()
  console.log(`RPC root: ${createRes.status} — ${createText.slice(0, 200)}`)

  // Step 3: Try using the Supabase SQL endpoint directly
  // The way to do it is via the database REST API at /rest/v1/
  // using a custom query function
  
  // Step 4: Create the table through the REST API
  // We can only do DDL through pg_dump or SQL editor.
  // Let me try creating via the table endpoint directly - we can't with DDL
  // 
  // Instead, let me check if the table can be created with insert
  // by first creating it through POST
  
  // Actually the only way to run DDL on Supabase is:
  // 1. SQL Editor in the dashboard (manual)
  // 2. supabase CLI (requires linking)
  // 3. Management API with PAT (requires permissions)
  //
  // Since we can't use those, let me just print the SQL for manual execution
  
  console.log('\n⚠️ Cannot run DDL via REST API.')
  console.log('Migration 039 SQL needs to be run in Supabase SQL Editor.')
  console.log('\nOpen: https://supabase.com/dashboard/project/wvintltwxydmlyvcmcis/sql/new')
  console.log('And paste the full migration file: supabase/migrations/039_agent_approvals.sql')
  console.log('\nOr run the following SQL:\n')
  console.log(SQL)
}

main().catch(console.error)
