import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  // Generate a magic link for the user
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'inlightailtd@gmail.com',
  });
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Link generated!');
  console.log(data.properties?.action_link || 'No action link');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).then(() => process.exit(0));
