import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { conTimeout } from './fetchConTimeout';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl ?? '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn('[Supabase] Not configured — check .env and app.config.js');
} else {
  console.log('[Supabase] Configured with URL:', SUPABASE_URL);
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // Un solo lugar para el timeout de PostgREST, Storage y Auth (#451): sin
      // esto una request que nunca responde deja el sync colgado para siempre.
      global: { fetch: conTimeout() },
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : (null as unknown as SupabaseClient);
