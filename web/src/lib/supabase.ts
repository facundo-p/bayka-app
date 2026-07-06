import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: copiá web/.env.example a web/.env (valores en mobile/eas.json).',
  );
}

/** Cliente único de Supabase para toda la web (mismo proyecto que mobile). */
export const supabase = createClient(url, anonKey);
