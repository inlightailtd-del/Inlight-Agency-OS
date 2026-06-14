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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'inlightailtd@gmail.com',
    password: 'Inlight123!',
  });
  
  if (error) {
    console.error('Error:', error.message);
    // Try another common password
    const { data: d2, error: e2 } = await supabase.auth.signInWithPassword({
      email: 'inlightailtd@gmail.com',
      password: 'inlight123',
    });
    if (e2) console.error('Error 2:', e2.message);
    else console.log('Session:', JSON.stringify({ access_token: d2.session?.access_token?.substring(0, 30) + '...', user: d2.user?.email }));
    return;
  }
  
  console.log('Session:', JSON.stringify({ access_token: data.session?.access_token?.substring(0, 30) + '...', user: data.user?.email }));
}

main().catch(console.error).then(() => process.exit(0));
