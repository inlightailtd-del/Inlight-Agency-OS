import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testGmail() {
  console.log('--- TESTING GMAIL ---');
  const { data: creds } = await supabase
    .from('integration_credentials')
    .select('credentials, expires_at')
    .eq('provider', 'gmail')
    .eq('is_expired', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!creds || creds.length === 0) {
    console.log('GMAIL: No credentials found');
    return false;
  }

  const token = creds[0].credentials.access_token;
  const expires = creds[0].expires_at;
  console.log(`Token expires: ${expires}`);
  console.log(`Token expired: ${new Date(expires) < new Date()}`);

  // Try listing messages (read-only)
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    console.log(`Messages found: ${data.resultSizeEstimate || 0}`);
    return true;
  } else {
    console.log(`Error: ${data.error?.message || res.statusText}`);
    return false;
  }
}

async function testLinkedIn() {
  console.log('\n--- TESTING LINKEDIN ---');
  const { data: creds } = await supabase
    .from('integration_credentials')
    .select('credentials, expires_at')
    .eq('provider', 'linkedin')
    .eq('is_expired', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!creds || creds.length === 0) {
    console.log('LINKEDIN: No credentials found');
    return false;
  }

  const token = creds[0].credentials.access_token;
  const expires = creds[0].expires_at;
  console.log(`Token expires: ${expires}`);
  console.log(`Token expired: ${new Date(expires) < new Date()}`);

  // Try getting user info
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    console.log(`User: ${data.name || data.sub} (${data.email || ''})`);
    return true;
  } else {
    console.log(`Error: ${data.error_description || data.error || res.statusText}`);
    return false;
  }
}

async function main() {
  const gmailOk = await testGmail();
  const linkedinOk = await testLinkedIn();
  console.log(`\n=== SUMMARY ===`);
  console.log(`Gmail: ${gmailOk ? '✅ CONNECTED' : '❌ FAILED'}`);
  console.log(`LinkedIn: ${linkedinOk ? '✅ CONNECTED' : '❌ FAILED'}`);
}

main().catch(console.error).then(() => process.exit(0));
