// §2.4 public API: total unread messages for the Chats tab badge (0 when anonymous).
import { useQueryClient } from '@tanstack/react-query';

import { useRealtimeChanges } from '@/features/events';
import { useAuth } from '@/lib/auth';

import { scheduleConversationsRefresh, useConversations } from './api';

interface MessageInsert extends Record<string, unknown> {
  sender_id: string | null;
}

export function useUnreadTotal(): number {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const { data } = useConversations();

  // Any new message in one of my conversations (RLS-filtered) refreshes the counts. Notifications alone
  // are not enough: `message` notifications are deduped per 5 minutes and skipped for muted chats.
  useRealtimeChanges<MessageInsert>(
    userId ? { topic: `inbox:${userId}`, event: 'INSERT', table: 'messages' } : null,
    (row) => {
      if (row.sender_id !== userId) scheduleConversationsRefresh(qc);
    },
  );

  if (!userId || !data) return 0;
  return data.reduce((sum, c) => sum + c.unread_count, 0);
}
