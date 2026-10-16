// In-app inbox (`notifications` table, own rows via RLS) + `mark_notifications_read`.
import type { NotificationType } from '@bojo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export interface InboxItem {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

const INBOX_LIMIT = 100;
export const unreadNotificationsKey = [...qk.notifications, 'unread'] as const;

function asPayload(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function useNotifications() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.notifications,
    queryFn: async (): Promise<InboxItem[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id,type,payload,read_at,created_at')
        .eq('user_id', userId ?? '')
        .order('created_at', { ascending: false })
        .limit(INBOX_LIMIT);
      if (error) throw error;
      return (data ?? []).map((n) => ({ ...n, payload: asPayload(n.payload) }));
    },
    enabled: userId !== null,
  });
}

/** Unread inbox count for the bell badge (0 when anonymous). */
export function useUnreadNotificationsCount(): number {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: unreadNotificationsKey,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId ?? '')
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: userId !== null,
  });
  return userId ? (query.data ?? 0) : 0;
}

/** `mark_notifications_read(ids)`; no ids = all unread. Optimistic. */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const { error } = await supabase.rpc('mark_notifications_read', {
        p_ids: ids && ids.length > 0 ? ids : undefined,
      });
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: qk.notifications });
      const previous = qc.getQueryData<InboxItem[]>(qk.notifications);
      const previousCount = qc.getQueryData<number>(unreadNotificationsKey);
      const stamp = new Date().toISOString();
      let marked = 0;
      qc.setQueryData<InboxItem[]>(qk.notifications, (old) =>
        old?.map((n) => {
          if (n.read_at || (ids && ids.length > 0 && !ids.includes(n.id))) return n;
          marked += 1;
          return { ...n, read_at: stamp };
        }),
      );
      qc.setQueryData<number>(unreadNotificationsKey, (old) =>
        ids && ids.length > 0 ? Math.max(0, (old ?? 0) - marked) : 0,
      );
      return { previous, previousCount };
    },
    onError: (_e, _ids, ctx) => {
      qc.setQueryData(qk.notifications, ctx?.previous);
      qc.setQueryData(unreadNotificationsKey, ctx?.previousCount);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}
