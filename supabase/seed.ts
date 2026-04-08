import { createClient } from '@supabase/supabase-js';

// Load .env manually since this runs outside Expo
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Admin client — uses service role key, bypasses RLS
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const USERS = [
  { email: 'mili@bayka.org', password: 'Bayka1!', nombre: 'Mili', rol: 'admin' },
  { email: 'militec@bayka.org', password: 'Bayka1!', nombre: 'Mili Tec', rol: 'tecnico' },
  { email: 'mati@bayka.org', password: 'Bayka1!', nombre: 'Mati', rol: 'admin' },
  { email: 'facu@bayka.org', password: 'Bayka1!', nombre: 'Facu', rol: 'admin' },
  { email: 'facutec@bayka.org', password: 'Bayka1!', nombre: 'Facu Tec', rol: 'tecnico' },
];

async function seed() {
  console.log('Creating Bayka organization...');
  const { error: orgError } = await supabase.from('organizations').upsert({
    id: ORG_ID,
    nombre: 'Bayka',
  }, { onConflict: 'id' });
  if (orgError) {
    console.error('Organization error:', orgError.message);
    process.exit(1);
  }
  console.log('Organization created: Bayka');

  for (const user of USERS) {
    console.log(`Creating user: ${user.email}...`);

    // Create in Supabase Auth (email_confirm skips email verification)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`  User ${user.email} already exists — skipping auth creation`);
        // Look up existing user ID
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users.find(u => u.email === user.email);
        if (!existing) {
          console.error(`  Could not find existing user ${user.email}`);
          continue;
        }
        // Upsert profile for existing user
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: existing.id,
          nombre: user.nombre,
          rol: user.rol,
          organizacion_id: ORG_ID,
        }, { onConflict: 'id' });
        if (profileError) console.error(`  Profile error for ${user.email}:`, profileError.message);
        else console.log(`  Profile upserted for ${user.email}`);
        continue;
      }
      console.error(`  Auth error for ${user.email}:`, authError.message);
      continue;
    }

    const userId = authData.user.id;

    // Insert profile row (MUST be done after auth user creation — Pitfall 6)
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      nombre: user.nombre,
      rol: user.rol,
      organizacion_id: ORG_ID,
    });

    if (profileError) {
      console.error(`  Profile error for ${user.email}:`, profileError.message);
    } else {
      console.log(`  Created: ${user.email} (${user.rol})`);
    }
  }

  console.log('\nSeed complete. Test credentials:');
  USERS.forEach(u => console.log(`  ${u.rol}: ${u.email} / ${u.password}`));
}

seed().catch(console.error);
