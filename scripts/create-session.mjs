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

async function main() {
  // Create admin session token
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'inlightailtd@gmail.com',
    password: 'TempPass123!',
    email_confirm: true,
  });
  
  if (error && !error.message.includes('already exists')) {
    console.error('Error:', error.message);
    return;
  }
  
  // Try signing in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'inlightailtd@gmail.com',
    password: 'TempPass123!',
  });
  
  if (signInError) {
    console.error('Sign in error:', signInError.message);
    return;
  }
  
  console.log('Signed in!');
  console.log('Access token:', signInData.session?.access_token?.substring(0, 50) + '...');
  console.log('Refresh token:', signInData.session?.refresh_token?.substring(0, 30) + '...');
  
  // Save tokens to file for browser to use
  const fs = await import('fs');
  fs.writeFileSync('scripts/session.json', JSON.stringify({
    access_token: signInData.session?.access_token,
    refresh_token: signInData.session?.refresh_token,
    user_id: signInData.user?.id,
  }, null, 2));
  
  // Set as cookie format
  console.log('\nSet these cookies in browser:');
  console.log(`sb-wvintltwxydmlyvcmcis-auth-token: ${JSON.stringify({access_token: signInData.session?.access_token, refresh_token: signInData.session?.refresh_token})}`);
}

main().catch(console.error).then(() => process.exit(0));
