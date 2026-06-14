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

async function refreshGmail() {
  console.log('--- REFRESHING GMAIL TOKEN ---');
  const { data: creds } = await supabase
    .from('integration_credentials')
    .select('id, credentials')
    .eq('provider', 'gmail')
    .eq('is_expired', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!creds || creds.length === 0) {
    console.log('No Gmail credentials found');
    return;
  }

  const cred = creds[0];
  const current = cred.credentials;
  const refreshToken = current.refresh_token;
  console.log(`Credential ID: ${cred.id}`);
  console.log(`Has refresh_token: ${!!refreshToken}`);

  if (!refreshToken) {
    console.log('No refresh token available. Need to reconnect Gmail.');
    return;
  }

  // Exchange refresh token for new access token
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  console.log(`Refresh status: ${res.status}`);

  if (!res.ok) {
    console.log(`Refresh failed: ${data.error_description || data.error || res.statusText}`);
    return;
  }

  const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  const updatedCredentials = {
    ...current,
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('integration_credentials')
    .update({
      credentials: updatedCredentials,
      expires_at: newExpiresAt,
      is_expired: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cred.id);

  // Update connection
  await supabase
    .from('integration_connections')
    .update({ status: 'connected', last_error: null, updated_at: new Date().toISOString() })
    .eq('credential_id', cred.id);

  console.log(`Token refreshed! New expiry: ${newExpiresAt}`);

  // Test it
  console.log('\n--- VERIFYING GMAIL ---');
  const testRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const testData = await testRes.json();
  console.log(`Status: ${testRes.status}`);
  if (testRes.ok) {
    console.log(`Messages: ${testData.resultSizeEstimate || 0} ✅`);
  } else {
    console.log(`Error: ${testData.error?.message || testRes.statusText} ❌`);
  }
}

refreshGmail().catch(console.error).then(() => process.exit(0));
