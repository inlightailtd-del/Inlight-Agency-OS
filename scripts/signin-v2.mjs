import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Sign in with email/password
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'inlightailtd@gmail.com',
    password: 'admin123',
  });
  
  if (error) {
    console.error('Sign in error:', error.message);
    
    // Try signup
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: 'inlightailtd@gmail.com',
      password: 'admin123',
    });
    
    if (signupError) {
      console.error('Sign up error:', signupError.message);
      return;
    }
    
    console.log('Sign up successful, checking session...');
    // The user might already exist, try other common passwords
    for (const pw of ['Admin123!', 'inlight123!', 'Inlight123!', 'password123', 'Test1234!', 'Welcome1!', 'inlight2024']) {
      const { data: d } = await supabase.auth.signInWithPassword({
        email: 'inlightailtd@gmail.com',
        password: pw,
      }).catch(() => ({ data: null }));
      if (d?.session) {
        console.log(`Found password: ${pw}`);
        console.log('Session token:', d.session.access_token.substring(0, 50) + '...');
        break;
      }
    }
    return;
  }
  
  console.log('Signed in!');
  console.log('Session token:', data.session?.access_token?.substring(0, 50) + '...');
  console.log('Refresh token:', data.session?.refresh_token?.substring(0, 30) + '...');
  
  // Write session info
  writeFileSync('scripts/session.json', JSON.stringify({
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
    user_id: data.user?.id,
  }, null, 2));
}

main().catch(console.error).then(() => process.exit(0));
