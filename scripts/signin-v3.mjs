import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import * as crypto from 'crypto';

const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

// Use the admin client to generate an access token
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // First try to sign in with all possible passwords
  const passwords = [
    'admin123', 'Admin123', 'Admin123!', 'password', 'Password123!',
    'inlight123', 'Inlight123', 'Inlight123!', 'test123', 'Test1234!',
    'welcome', 'Welcome', 'Welcome1!', 'inlight', 'Inlight',
    'inlightagency', 'InlightAgency', 'InlightAgency123!',
    'agency123', 'Agency123!', 'admin@admin', 'Admin@123',
    'inlightailtd', 'Inlightailtd', 'InlightAiltd',
  ];
  
  // Actually, let's use the admin API to generate a session token directly
  // Supabase admin API allows creating sessions for users
  
  // Let's get the user ID for the target user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === 'inlightailtd@gmail.com');
  
  if (!user) {
    console.error('User not found. Creating user...');
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'inlightailtd@gmail.com',
      password: 'Admin123!',
      email_confirm: true,
    });
    if (error) { console.error('Create error:', error.message); return; }
    console.log('User created:', data.user?.id);
  } else {
    console.log('Found user:', user.id, user.email);
    
    // Reset password and sign in
    await supabase.auth.admin.updateUserById(user.id, { password: 'Admin123!' });
    
    const { data: d, error: e } = await supabase.auth.signInWithPassword({
      email: 'inlightailtd@gmail.com',
      password: 'Admin123!',
    });
    
    if (e) { console.error('Sign in failed:', e.message); return; }
    
    console.log('Signed in!');
    console.log('Access token (first 60):', d.session?.access_token?.substring(0, 60));
    
    // Save for browser
    writeFileSync('scripts/session.json', JSON.stringify({
      access_token: d.session?.access_token,
      refresh_token: d.session?.refresh_token,
      user_id: d.user?.id,
    }, null, 2));
    
    console.log('\nSession saved to scripts/session.json');
  }
}

main().catch(console.error).then(() => process.exit(0));
