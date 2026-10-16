// §2.4 public API (mounted once by the root layout): Realtime `notifications:<uid>` → toast + cache
// invalidation; guarded push registration (§6); notification taps → router.push(data.url).
import type { NotificationType } from '@bojo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import { scheduleConversationsRefresh } from '@/features/chat';
import { useRealtimeChanges } from '@/features/events';
import { useLanguage } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/queryKeys';

import { notificationContent, notificationUrl } from './format';
import { listenForPushTaps, registerForPush } from './push';

interface NotificationInsert extends Record<string, unknown> {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown> | null;
}

export function NotificationsBridge(): null {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const pathname = usePathname();
  const language = useLanguage();
  const { t } = useTranslation('notifications');

  // Signing in/out changes what the events RPCs return (identities, my_status): refetch them.
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const before = previousUser.current;
    previousUser.current = userId;
    if (before === undefined || before === userId) return;
    void qc.invalidateQueries({ queryKey: ['events'] });
    void qc.invalidateQueries({ queryKey: ['event'] });
  }, [userId, qc]);

  useRealtimeChanges<NotificationInsert>(
    userId
      ? {
          topic: `notifications:${userId}`,
          event: 'INSERT',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }
      : null,
    (row) => {
      const payload = row.payload ?? {};
      void qc.invalidateQueries({ queryKey: qk.notifications });
      if (row.type === 'message' || row.type === 'match' || row.type === 'event_invite') {
        scheduleConversationsRefresh(qc);
      }
      if (row.type.startsWith('event_')) {
        void qc.invalidateQueries({ queryKey: ['events'] });
        const eventId = payload.event_id;
        if (typeof eventId === 'string') {
          void qc.invalidateQueries({ queryKey: qk.event(eventId) });
        }
      }
      const url = notificationUrl(payload);
      if (url === pathname) return; // already looking at it (e.g. the open chat)
      const content = notificationContent(row.type, payload, t, language);
      toast.show(content.body ? `${content.title}. ${content.body}` : content.title);
    },
  );

  const channelName = useEffectEvent(() => t('channelName'));
  useEffect(() => {
    if (!userId) return;
    void registerForPush({ channelName: channelName() });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenForPushTaps((url) => {
      setTimeout(() => router.push(url as Href), 0);
    }).then((fn) => {
      if (cancelled) fn();
      else stop = fn;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return null;
}
