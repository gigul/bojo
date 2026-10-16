import type { ProfileRow } from '@bojo/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { syncProfileLocale } from '@/i18n';

import { qk } from './queryKeys';
import { STORAGE_KEYS } from './storageKeys';
import { supabase } from './supabase';

export interface AuthContextValue {
  session: Session | null;
  userId: string | null;
  profile: ProfileRow | null;
  /** True until the stored session is restored and (when signed in) the profile is first loaded. */
  isLoading: boolean;
  refreshProfile(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Best effort: drop this device's push token server-side before the session goes away (§2.6). */
async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.pushToken);
    if (!token) return;
    await supabase.rpc('unregister_push_token', { p_token: token });
    await AsyncStorage.removeItem(STORAGE_KEYS.pushToken);
  } catch {
    // offline / already gone — signing out must still succeed
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setSessionLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setSessionLoading(false);
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      } else if (event === 'SIGNED_IN' && next) {
        // Never call supabase synchronously inside this callback (supabase-js deadlock note).
        const id = next.user.id;
        setTimeout(() => {
          void syncProfileLocale(id);
        }, 0);
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const profileQuery = useQuery({
    queryKey: qk.me,
    queryFn: () => (userId ? fetchProfile(userId) : Promise.resolve(null)),
    enabled: userId !== null,
  });

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await unregisterPushToken();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Server unreachable: still clear the local session so the UI signs out.
      await supabase.auth.signOut({ scope: 'local' });
    }
    queryClient.clear();
  }, [queryClient]);

  const profile = userId ? (profileQuery.data ?? null) : null;
  const isLoading = sessionLoading || (userId !== null && profileQuery.isPending);

  const value = useMemo<AuthContextValue>(
    () => ({ session, userId, profile, isLoading, refreshProfile, signOut }),
    [session, userId, profile, isLoading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Guard for actions that need an account:
 *   const requireAuth = useRequireAuth();
 *   if (!requireAuth()) return;   // pushes /sign-in?next=<current path> when anonymous
 */
export function useRequireAuth(): (next?: string) => boolean {
  const { session } = useAuth();
  const pathname = usePathname();
  return useCallback(
    (next?: string) => {
      if (session) return true;
      router.push({ pathname: '/sign-in', params: { next: next ?? pathname } });
      return false;
    },
    [session, pathname],
  );
}
