import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export interface RunnerPrefs {
  /** Fastest comfortable pace, s/km (150–900). */
  paceFast: number;
  /** Easy pace, s/km (≥ paceFast). */
  paceSlow: number;
  /** Preferred distance, km (1–100). */
  distanceKm: number;
}

export const PACE_LIMITS = { min: 150, max: 900, step: 15 } as const;
export const DEFAULT_RUNNER_PREFS: RunnerPrefs = { paceFast: 330, paceSlow: 390, distanceKm: 5 };

/** Own `runner_profiles` row (module 4 stub; owner-only RLS). null when never saved. */
export function useRunnerProfile() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.runner,
    enabled: userId !== null,
    queryFn: async (): Promise<RunnerPrefs | null> => {
      const { data, error } = await supabase
        .from('runner_profiles')
        .select('pace_fast_sec_per_km, pace_slow_sec_per_km, preferred_distance_km')
        .eq('user_id', userId ?? '')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        paceFast: data.pace_fast_sec_per_km ?? DEFAULT_RUNNER_PREFS.paceFast,
        paceSlow: data.pace_slow_sec_per_km ?? DEFAULT_RUNNER_PREFS.paceSlow,
        distanceKm: Number(data.preferred_distance_km ?? DEFAULT_RUNNER_PREFS.distanceKm),
      };
    },
  });
}

/** Upsert (direct write allowed by RLS `runner_profiles_own`). */
export function useSaveRunnerProfile() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: RunnerPrefs): Promise<void> => {
      if (!userId) throw new Error('not_authenticated');
      const { error } = await supabase.from('runner_profiles').upsert(
        {
          user_id: userId,
          pace_fast_sec_per_km: Math.min(prefs.paceFast, prefs.paceSlow),
          pace_slow_sec_per_km: Math.max(prefs.paceFast, prefs.paceSlow),
          preferred_distance_km: prefs.distanceKm,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_void, prefs) => {
      queryClient.setQueryData(qk.runner, prefs);
    },
  });
}
