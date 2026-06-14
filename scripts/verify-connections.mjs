import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== CHECKING CONNECTIONS ===\n');

  // Get credentials
  const { data: creds, error: credErr } = await supabase
    .from('integration_credentials')
    .select('*')
    .order('created_at', { ascending: false });

  if (credErr) console.error('Credential error:', credErr);
  else {
    console.log('--- CREDENTIALS ---');
    for (const c of creds) {
      const credObj = c.credentials || {};
      console.log(`Provider: ${c.provider}, ID: ${c.id}, Expired: ${c.is_expired}, Expires: ${c.expires_at}`);
      console.log(`  has access_token: ${!!credObj.access_token}`);
      console.log(`  has refresh_token: ${!!credObj.refresh_token}`);
      if (c.provider === 'facebook') {
        console.log(`  has page_access_token: ${!!credObj.page_access_token}`);
        console.log(`  selected_page_id: ${credObj.selected_page_id || 'none'}`);
        console.log(`  selected_page_name: ${credObj.selected_page_name || 'none'}`);
      }
    }
  }

  // Get connections
  const { data: conns, error: connErr } = await supabase
    .from('integration_connections')
    .select('*')
    .order('created_at', { ascending: false });

  if (connErr) console.error('Connection error:', connErr);
  else {
    console.log('\n--- CONNECTIONS ---');
    for (const c of conns) {
      console.log(`Provider: ${c.provider}, Status: ${c.status}, Active: ${c.is_active}`);
      console.log(`  Config: ${JSON.stringify(c.config || {})}`);
      console.log(`  Stats: ${c.total_requests || 0} total, ${c.successful_requests || 0} ok, ${c.failed_requests || 0} fail`);
      console.log(`  Last error: ${c.last_error || 'none'}`);
    }
  }

  // Check execution_logs for posts
  const { data: logs, error: logErr } = await supabase
    .from('execution_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (logErr) console.error('Log error:', logErr);
  else {
    console.log('\n--- EXECUTION LOGS (last 20) ---');
    for (const l of logs) {
      const date = new Date(l.created_at).toLocaleString();
      console.log(`[${date}] ${l.action} | ${l.status} | ${l.message || ''}`);
    }
  }

  // Check content_requests
  const { data: content, error: contentErr } = await supabase
    .from('content_requests')
    .select('id, title, platform, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (contentErr) console.error('Content error:', contentErr);
  else {
    console.log('\n--- CONTENT REQUESTS (last 10) ---');
    for (const c of content) {
      const date = new Date(c.created_at).toLocaleString();
      console.log(`[${date}] ${c.platform || '?'} | ${c.status} | ${c.title || '(no title)'}`);
    }
  }
}

main().catch(console.error).then(() => process.exit(0));
