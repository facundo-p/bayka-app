import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: copiá web/.env.example a web/.env.',
  );
}

/** Cliente único de Supabase para toda la web. A qué proyecto apunta lo define
 *  el par de variables de entorno del build (lo valida `envSupabase.ts`). */
export const supabase = createClient(url, anonKey);
