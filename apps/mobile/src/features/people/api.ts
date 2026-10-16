import type { CandidateRow, PersonSummaryRow, SwipeResult } from '@bojo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/** Page size of `match_candidates` (server max 50). */
export const CANDIDATES_PAGE = 20;

/**
 * Scored candidates (`match_candidates`, server-side scoring §5.4). There is no cursor: the server
 * excludes everyone the caller liked (ever) or passed (14 days), so re-fetching after swipes
 * returns the next best people.
 */
export function useCandidates(sportId: string | null, opts?: { enabled?: boolean }) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.candidates(sportId),
    enabled: userId !== null && (opts?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async (): Promise<CandidateRow[]> => {
      const { data, error } = await supabase.rpc('match_candidates', {
        p_limit: CANDIDATES_PAGE,
        ...(sportId ? { p_sport_id: sportId } : null),
      });
      if (error) throw error;
      const rows: CandidateRow[] = data ?? [];
      return rows;
    },
  });
}

export interface SwipeInput {
  targetId: string;
  liked: boolean;
  sportId?: string | null;
}

/** `swipe` → match_id/conversation_id when both liked each other (nulls otherwise). */
export function useSwipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, liked, sportId }: SwipeInput): Promise<SwipeResult> => {
      const { data, error } = await supabase.rpc('swipe', {
        p_target_id: targetId,
        p_liked: liked,
        ...(sportId ? { p_sport_id: sportId } : null),
      });
      if (error) throw error;
      const row: SwipeResult | undefined = data?.[0];
      return { match_id: row?.match_id ?? null, conversation_id: row?.conversation_id ?? null };
    },
    onSuccess: (result, { targetId }) => {
      void queryClient.invalidateQueries({ queryKey: ['people', 'swipe', targetId] });
      if (result.match_id) {
        void queryClient.invalidateQueries({ queryKey: qk.conversations });
        void queryClient.invalidateQueries({ queryKey: qk.person(targetId) });
      }
    },
  });
}

/** Public profile of another user (`person_summary`); `not_found` when missing or blocked. */
export function usePersonSummary(userId: string | undefined) {
  const { userId: me } = useAuth();
  return useQuery({
    queryKey: qk.person(userId ?? ''),
    enabled: me !== null && Boolean(userId),
    queryFn: async (): Promise<PersonSummaryRow> => {
      const { data, error } = await supabase.rpc('person_summary', { p_user_id: userId ?? '' });
      if (error) throw error;
      const row: PersonSummaryRow | undefined = data?.[0];
      if (!row) throw new Error('not_found');
      return row;
    },
  });
}

/** Whether I already said "want to play" to this person (own swipes are readable, RLS §4.2). */
export function useMyLike(targetId: string | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['people', 'swipe', targetId ?? ''],
    enabled: userId !== null && Boolean(targetId),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('swipes')
        .select('liked')
        .eq('swiper_id', userId ?? '')
        .eq('target_id', targetId ?? '')
        .maybeSingle();
      if (error) throw error;
      return data?.liked === true;
    },
  });
}
