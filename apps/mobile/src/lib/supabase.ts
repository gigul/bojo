import type { Database } from '@bojo/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// A12: `supabase` is always a non-null typed client. Without env it points at the default local stack
// with a placeholder key (no crash on import) and the root layout shows a dev-only banner.
const ENV_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ENV_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const FALLBACK_URL = 'http://127.0.0.1:44321';
const PLACEHOLDER_KEY = 'supabase-anon-key-not-configured';

export const isSupabaseConfigured = Boolean(ENV_URL && ENV_ANON_KEY);

/** Base URL of the Supabase API the app talks to (also used to build public storage URLs). */
export const SUPABASE_URL = (ENV_URL || FALLBACK_URL).replace(/\/+$/, '');

/** Web: plain localStorage, but touched lazily (never at module load — A8 / A15). */
const webStorage: SupportedStorage = {
  getItem: (key) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: (key, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  },
};

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  ENV_ANON_KEY || PLACEHOLDER_KEY,
  {
    auth: {
      storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

if (__DEV__ && !isSupabaseConfigured) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing — using the local default. ' +
      'Copy apps/mobile/.env.example to apps/mobile/.env.',
  );
}

// Native: timers are unreliable in the background, so only auto-refresh the session while foregrounded.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
