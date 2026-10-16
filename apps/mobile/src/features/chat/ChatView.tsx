// Generic conversation screen body (event or match chat): Realtime `conversation:<id>` INSERTs with
// dedupe by id, optimistic send with a client UUID + retry, system/invite messages, read marking,
// mute, report, and "Propose a meeting" for match chats (ARCHITECTURE §5.3, §7).
import type { ConversationListRow, MessageKind } from '@bojo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useFocusEffect, useIsFocused } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  ListItem,
  Sheet,
  Text,
  useToast,
} from '@/components/ui';
import { useRealtimeChanges } from '@/features/events';
import { ReportSheet } from '@/features/safety';
import { Icon } from '@/icons';
import { useLanguage } from '@/i18n';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { formatDayLabel, toWarsaw } from '@/lib/datetime';
import { getRpcErrorCode, useErrorText } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

import {
  addMessageToCache,
  newMessageId,
  scheduleConversationsRefresh,
  toChatMessage,
  useChatPeople,
  useConversation,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
  useSetConversationMuted,
  type ChatMessage,
} from './api';
import { ChatHeaderTitle } from './components/ChatHeaderTitle';
import { Composer } from './components/Composer';
import { EventInviteCard } from './components/EventInviteCard';
import { MessageBubble, type SendState } from './components/MessageBubble';
import { DaySeparator, SystemMessage } from './components/SystemMessage';

interface PendingMessage extends ChatMessage {
  sendState: Exclude<SendState, 'sent'>;
}

type DisplayMessage = ChatMessage & { sendState?: SendState };

type ChatItem =
  | { type: 'day'; key: string; label: string }
  | {
      type: 'message';
      key: string;
      message: DisplayMessage;
      showName: boolean;
      showAvatar: boolean;
    };

interface RealtimeMessage extends Record<string, unknown> {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string;
  payload: unknown;
  created_at: string;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    list: { paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.md },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: t.layout.hairline,
      borderBottomColor: t.colors.border,
    },
    topBarText: { flex: 1 },
    banner: {
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.sm,
      backgroundColor: t.colors.surfaceAlt,
    },
    listEdge: { alignItems: 'center', paddingVertical: t.spacing.lg },
    empty: { flex: 1, justifyContent: 'center' },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    sheetList: { marginHorizontal: -t.layout.screenGutter },
  });

/**
 * Native keeps the classic inverted list. Web renders an inverted list with a CSS flip, so the DOM
 * (= reading / Tab order) would run newest → oldest; there the list is chronological and pinned to
 * the bottom instead.
 */
const CHRONOLOGICAL = Platform.OS === 'web';
/** Within this distance from the bottom the list keeps following new messages. */
const STICKY_PX = 120;

function dayKey(iso: string): string {
  const d = toWarsaw(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Common sport with the other person (pre-fills the propose-meeting flow). */
function useCommonSport(otherUserId: string | null) {
  return useQuery({
    queryKey: ['person', otherUserId ?? '', 'chat-common-sport'] as const,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('person_summary', {
        p_user_id: otherUserId ?? '',
      });
      if (error) throw error;
      const row = data?.[0];
      return row?.common_sport_ids?.[0] ?? row?.sport_ids?.[0] ?? null;
    },
    enabled: Boolean(otherUserId),
    staleTime: 5 * 60_000,
  });
}

export function ChatView({ conversationId }: { conversationId: string }) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['chat', 'common']);
  const language = useLanguage();
  const { userId, session, isLoading: authLoading } = useAuth();
  const requireAuth = useRequireAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const isFocused = useIsFocused();
  const headerHeight = useHeaderHeight();

  const conversation = useConversation(conversationId);
  const row: ConversationListRow | null | undefined = conversation.row;
  const isMember = Boolean(row);
  const messages = useMessages(conversationId, { enabled: isMember });
  const send = useSendMessage(conversationId);
  const { mutate: markRead } = useMarkConversationRead(conversationId);
  const setMuted = useSetConversationMuted(conversationId);
  const commonSport = useCommonSport(row?.kind === 'match' ? row.other_user_id : null);

  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [actionsFor, setActionsFor] = useState<DisplayMessage | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);
  const stickToBottom = useRef(true);
  const contentHeight = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (isMember) markRead();
    }, [isMember, markRead]),
  );

  useRealtimeChanges<RealtimeMessage>(
    userId && isMember
      ? {
          topic: `conversation:${conversationId}`,
          event: 'INSERT',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }
      : null,
    (raw) => {
      const message = toChatMessage(raw);
      addMessageToCache(qc, message);
      setPending((list) =>
        list.some((p) => p.id === message.id) ? list.filter((p) => p.id !== message.id) : list,
      );
      if (message.sender_id !== userId && isFocused) markRead();
      if (message.kind !== 'text' && row?.event_id) {
        void qc.invalidateQueries({ queryKey: qk.event(row.event_id) });
      }
      scheduleConversationsRefresh(qc);
    },
  );

  const deliver = (id: string, body: string) => {
    send.mutate(
      { id, body },
      {
        onSuccess: () => setPending((list) => list.filter((p) => p.id !== id)),
        onError: (e) => {
          // The insert may have landed before the connection dropped: a duplicate id means "sent".
          if ((e as { code?: unknown }).code === '23505') {
            setPending((list) => list.filter((p) => p.id !== id));
            void qc.invalidateQueries({ queryKey: qk.messages(conversationId) });
            return;
          }
          setPending((list) => list.map((p) => (p.id === id ? { ...p, sendState: 'failed' } : p)));
          const code = getRpcErrorCode(e);
          toast.show(
            code === 'rate_limited' ? t('chat:errors.rateLimited') : errorText(e),
            'danger',
          );
        },
      },
    );
  };

  const onSend = (body: string) => {
    if (!userId) return;
    stickToBottom.current = true; // own message: always jump to it (web chronological list)
    const id = newMessageId();
    const optimistic: PendingMessage = {
      id,
      conversation_id: conversationId,
      sender_id: userId,
      kind: 'text',
      body,
      payload: null,
      created_at: new Date().toISOString(),
      sendState: 'sending',
    };
    setPending((list) => [optimistic, ...list]);
    deliver(id, body);
  };

  const retry = (message: DisplayMessage) => {
    setPending((list) =>
      list.map((p) => (p.id === message.id ? { ...p, sendState: 'sending' } : p)),
    );
    deliver(message.id, message.body);
  };

  // --- build the newest-first item list ---------------------------------------------------
  const cached = messages.data?.pages.flat() ?? [];
  const cachedIds = new Set(cached.map((m) => m.id));
  const all: DisplayMessage[] = [...pending.filter((p) => !cachedIds.has(p.id)), ...cached];
  const personIds = new Set<string>();
  for (const m of all) {
    if (m.sender_id && m.sender_id !== userId) personIds.add(m.sender_id);
    const subject = m.kind === 'system' ? m.payload?.user_id : null;
    if (typeof subject === 'string') personIds.add(subject);
  }
  const people = useChatPeople([...personIds]).data ?? {};
  const isGroup = row?.kind === 'event';
  const nameOf = (id: string | null): string =>
    (id && people[id]?.display_name) ||
    (row?.kind === 'match' ? (row.title ?? '') : '') ||
    t('chat:list.someone');

  const items: ChatItem[] = [];
  all.forEach((m, i) => {
    const newer = all[i - 1];
    const older = all[i + 1];
    const sameDayOlder = older ? dayKey(older.created_at) === dayKey(m.created_at) : false;
    const runStart =
      !older || !sameDayOlder || older.sender_id !== m.sender_id || older.kind !== 'text';
    const runEnd =
      !newer ||
      dayKey(newer.created_at) !== dayKey(m.created_at) ||
      newer.sender_id !== m.sender_id ||
      newer.kind !== 'text';
    items.push({ type: 'message', key: m.id, message: m, showName: runStart, showAvatar: runEnd });
    if (!older || !sameDayOlder) {
      items.push({
        type: 'day',
        key: `day-${dayKey(m.created_at)}`,
        label: formatDayLabel(m.created_at, language),
      });
    }
  });

  const renderItem = ({ item }: { item: ChatItem }) => {
    if (item.type === 'day') return <DaySeparator label={item.label} />;
    const m = item.message;
    if (m.kind === 'system') {
      const subject = typeof m.payload?.user_id === 'string' ? m.payload.user_id : null;
      return (
        <SystemMessage
          payload={m.payload}
          personName={subject ? (people[subject]?.display_name ?? null) : null}
        />
      );
    }
    const own = m.sender_id === userId;
    if (m.kind === 'event_invite') {
      return <EventInviteCard message={m} own={own} senderName={nameOf(m.sender_id)} />;
    }
    const sendState = m.sendState ?? 'sent';
    const canAct = (!own && m.sender_id !== null) || sendState === 'failed';
    return (
      <MessageBubble
        message={m}
        own={own}
        senderName={nameOf(m.sender_id)}
        senderAvatar={m.sender_id ? (people[m.sender_id]?.avatar_path ?? null) : null}
        showName={item.showName}
        showAvatar={item.showAvatar}
        group={isGroup}
        sendState={sendState}
        onLongPress={canAct ? () => setActionsFor(m) : undefined}
        onRetry={() => retry(m)}
      />
    );
  };

  // --- header -----------------------------------------------------------------------------
  const header = (
    <Stack.Screen
      options={{
        title: row ? (row.title ?? t('common:screens.chat')) : t('common:screens.chat'),
        headerTitle: row ? () => <ChatHeaderTitle row={row} /> : undefined,
        headerRight: row
          ? () => (
              <View style={styles.headerRight}>
                <IconButton
                  icon={row.muted ? 'bell-off' : 'bell'}
                  onPress={() => {
                    setMuted.mutate(!row.muted);
                    toast.show(row.muted ? t('chat:mute.unmuted') : t('chat:mute.muted'));
                  }}
                  accessibilityLabel={row.muted ? t('chat:mute.unmute') : t('chat:mute.mute')}
                  selected={row.muted}
                />
              </View>
            )
          : undefined,
      }}
    />
  );

  // --- states -----------------------------------------------------------------------------
  if (!session && !authLoading) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <EmptyState
          icon="message-circle"
          title={t('common:states.signInRequired')}
          message={t('chat:signInMessage')}
          action={{
            label: t('common:actions.signIn'),
            onPress: () => requireAuth(`/chat/${conversationId}`),
          }}
        />
      </SafeAreaView>
    );
  }
  if (conversation.isError) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <ErrorState error={conversation.error} onRetry={() => void conversation.refetch()} />
      </SafeAreaView>
    );
  }
  if (row === null) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <EmptyState
          icon="slash"
          title={t('chat:unavailable.title')}
          message={t('chat:unavailable.message')}
          action={{
            label: t('chat:unavailable.toChats'),
            onPress: () => router.replace('/chats'),
            variant: 'secondary',
          }}
        />
      </SafeAreaView>
    );
  }

  const loading = row === undefined || messages.isPending;
  // Web: scroll the DOM node itself — VirtualizedList.scrollToEnd works from cached cell metrics,
  // which lag behind cells that grow after mount (invite cards loading their event).
  const pinToBottom = () => {
    const node = listRef.current?.getScrollableNode() as
      { scrollTop: number; scrollHeight: number } | undefined;
    if (node && typeof node.scrollHeight === 'number') node.scrollTop = node.scrollHeight;
    else listRef.current?.scrollToEnd({ animated: false });
  };
  const loadOlder = () => {
    if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
  };
  // "Начало переписки" / spinner at the oldest end of the list.
  const listEdge = messages.isFetchingNextPage ? (
    <View style={styles.listEdge}>
      <ActivityIndicator color={theme.colors.textMuted} />
    </View>
  ) : !messages.hasNextPage ? (
    <View style={styles.listEdge}>
      <Text variant="caption" color="textMuted">
        {t('chat:start')}
      </Text>
    </View>
  ) : null;
  const proposeMeeting = () => {
    if (!row?.match_id) return;
    const sportId = commonSport.data ?? undefined;
    router.push({
      pathname: '/event/create',
      params: sportId ? { matchId: row.match_id, sportId } : { matchId: row.match_id },
    });
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
      {header}
      {row?.kind === 'match' ? (
        <View style={styles.topBar}>
          <Text variant="label" color="textMuted" style={styles.topBarText} numberOfLines={2}>
            {t('chat:propose.hint')}
          </Text>
          <Button
            title={t('chat:propose.button')}
            icon="calendar"
            variant="secondary"
            onPress={proposeMeeting}
          />
        </View>
      ) : null}
      {row?.kind === 'event' && row.event_status === 'cancelled' ? (
        <View style={styles.banner}>
          <Text variant="label" color="textMuted">
            {t('chat:eventCancelled')}
          </Text>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={theme.colors.textMuted} />
          </View>
        ) : messages.isError ? (
          <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="message-circle"
            title={t('chat:empty.title')}
            message={row?.kind === 'match' ? t('chat:empty.match') : t('chat:empty.event')}
          />
        ) : (
          <FlatList
            ref={listRef}
            inverted={!CHRONOLOGICAL}
            data={CHRONOLOGICAL ? [...items].reverse() : items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            {...(CHRONOLOGICAL
              ? {
                  // Older pages load when scrolled to the top; the browser's scroll anchoring keeps
                  // the visible messages in place.
                  onStartReached: loadOlder,
                  onStartReachedThreshold: 0.3,
                  onScroll: (e: {
                    nativeEvent: {
                      contentOffset: { y: number };
                      contentSize: { height: number };
                      layoutMeasurement: { height: number };
                    };
                  }) => {
                    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                    // Scroll events caused by content growth (invite cards loading, the browser's
                    // scroll anchoring) are not the user leaving the bottom — ignore them.
                    if (contentSize.height !== contentHeight.current) return;
                    stickToBottom.current =
                      contentSize.height - (contentOffset.y + layoutMeasurement.height) < STICKY_PX;
                  },
                  scrollEventThrottle: 100,
                  onContentSizeChange: (_w: number, h: number) => {
                    contentHeight.current = h;
                    if (stickToBottom.current) pinToBottom();
                  },
                  onLayout: () => {
                    if (stickToBottom.current) pinToBottom();
                  },
                  ListHeaderComponent: listEdge,
                }
              : {
                  onEndReached: loadOlder,
                  onEndReachedThreshold: 0.3,
                  ListFooterComponent: listEdge,
                })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          />
        )}
        <Composer onSend={onSend} disabled={!row} />
      </KeyboardAvoidingView>

      <Sheet
        visible={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        title={t('chat:message.actions')}
      >
        <View style={styles.sheetList}>
          {actionsFor?.sendState === 'failed' ? (
            <>
              <ListItem
                title={t('chat:message.retry')}
                left={<IconSlotIcon name="rotate-cw" />}
                right={null}
                onPress={() => {
                  if (actionsFor) retry(actionsFor);
                  setActionsFor(null);
                }}
              />
              <ListItem
                title={t('chat:message.discard')}
                left={<IconSlotIcon name="trash-2" />}
                right={null}
                onPress={() => {
                  const id = actionsFor?.id;
                  setPending((list) => list.filter((p) => p.id !== id));
                  setActionsFor(null);
                }}
              />
            </>
          ) : (
            <ListItem
              title={t('chat:message.report')}
              left={<IconSlotIcon name="flag" danger />}
              right={null}
              onPress={() => {
                setReportMessageId(actionsFor?.id ?? null);
                setActionsFor(null);
              }}
            />
          )}
        </View>
      </Sheet>
      <ReportSheet
        visible={reportMessageId !== null}
        onClose={() => setReportMessageId(null)}
        targetType="message"
        targetId={reportMessageId ?? ''}
      />
    </SafeAreaView>
  );
}

function IconSlotIcon({
  name,
  danger = false,
}: {
  name: 'rotate-cw' | 'trash-2' | 'flag';
  danger?: boolean;
}) {
  return <Icon name={name} size={20} color={danger ? 'danger' : 'text'} />;
}
