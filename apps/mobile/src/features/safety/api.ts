import type { BlockedUserRow, ReportReason, ReportTarget } from '@bojo/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/** Everything that may show (or hide) a blocked user — refreshed after block / unblock (Appendix B). */
export function invalidateAfterBlock(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.conversations }),
    queryClient.invalidateQueries({ queryKey: ['people'] }),
    queryClient.invalidateQueries({ queryKey: qk.blocked }),
    queryClient.invalidateQueries({ queryKey: ['person'] }),
    queryClient.invalidateQueries({ queryKey: ['events'] }),
    queryClient.invalidateQueries({ queryKey: ['event'] }),
  ]).then(() => undefined);
}

export async function blockUserRpc(userId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
}

export async function unblockUserRpc(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
}

/** The caller's blocks with names (`blocked_users`, DEFINER — profiles_read hides blocked users). */
export function useBlockedUsers() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.blocked,
    enabled: userId !== null,
    queryFn: async (): Promise<BlockedUserRow[]> => {
      const { data, error } = await supabase.rpc('blocked_users');
      if (error) throw error;
      const rows: BlockedUserRow[] = data ?? [];
      return rows;
    },
  });
}

export interface ReportInput {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details?: string | null;
}

/** `submit_report` (20/day, one report per target — a repeat updates the reason). */
export function useSubmitReport() {
  return useMutation({
    mutationFn: async ({ targetType, targetId, reason, details }: ReportInput): Promise<string> => {
      const trimmed = details?.trim();
      const { data, error } = await supabase.rpc('submit_report', {
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason: reason,
        ...(trimmed ? { p_details: trimmed } : null),
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidateAfterBlock() {
  const queryClient = useQueryClient();
  return () => invalidateAfterBlock(queryClient);
}
