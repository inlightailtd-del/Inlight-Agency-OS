import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabaseUrl = 'http://localhost:3000'; // For the cookie domain
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Get the user first
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) { console.error(usersError); return; }
  
  const user = users.find(u => u.email === 'inlightailtd@gmail.com');
  if (!user) { console.error('User not found'); return; }
  
  // Generate a new session using admin API
  // Actually let's use signInWithPassword with a password reset
  // Or use createSession via admin
  
  // Best approach: use signInWithOtp for passwordless
  const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
    email: 'inlightailtd@gmail.com',
    options: { shouldCreateUser: false }
  });
  
  if (otpError) {
    console.error('OTP error:', otpError.message);
    return;
  }
  
  console.log('OTP sent! Check email for magic link.');
  console.log(JSON.stringify(otpData));
}

main().catch(console.error).then(() => process.exit(0));
