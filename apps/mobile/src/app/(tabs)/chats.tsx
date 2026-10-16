// Chats tab: my conversations (event chats + match chats) with unread counts (ARCHITECTURE §2.2). Owner: c.
import type { ConversationListRow } from '@bojo/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, EmptyState, ErrorState, Screen, Skeleton, Text } from '@/components/ui';
import { useChatPeople, useConversations } from '@/features/chat';
import { sportName } from '@/features/events';
import { NotificationsBell } from '@/features/notifications';
import { Icon, SportIcon } from '@/icons';
import { useLanguage, type Language } from '@/i18n';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { formatDayLabel, formatEventWhenShort, formatTime, warsawDayDiff } from '@/lib/datetime';
import type { AnyT } from '@/lib/format';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

type Payload = Record<string, unknown>;

function payloadOf(c: ConversationListRow): Payload {
  const p = c.last_message_payload;
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Payload) : {};
}

const str = (p: Payload, key: string): string | null => {
  const v = p[key];
  return typeof v === 'string' && v.trim() ? v : null;
};

const createStyles = (t: Theme) =>
  StyleSheet.create({
    content: { width: '100%', maxWidth: t.layout.maxContentWidth, alignSelf: 'center', flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: t.layout.screenGutter,
      paddingRight: t.spacing.sm,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.sm,
    },
    list: { paddingBottom: t.spacing.xl, flexGrow: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.md,
      minHeight: 72,
    },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    sportIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1, minWidth: 0, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 4 },
    title: { flexShrink: 1 },
    when: { flexShrink: 0 },
    side: { alignItems: 'flex-end', gap: 6, minWidth: 44 },
    // Graphite in light mode (lime on white is 1.2:1), lime in dark mode (high contrast there).
    unread: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: t.scheme === 'light' ? t.colors.text : t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: t.layout.hairline,
      backgroundColor: t.colors.border,
      marginLeft: t.layout.screenGutter + 60,
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.md,
    },
    skeletonText: { flex: 1, gap: t.spacing.sm },
  });

function lastTime(iso: string | null, language: Language): string {
  if (!iso) return '';
  return warsawDayDiff(iso) === 0 ? formatTime(iso, language) : formatDayLabel(iso, language);
}

function conversationTitle(c: ConversationListRow, t: AnyT, fallback: string): string {
  if (c.kind === 'event') return c.title?.trim() || sportName(c.sport_id, t);
  return c.title?.trim() || fallback;
}

/** User ids named by the last system message of each chat ("Анна идёт"). */
function systemSubjects(rows: readonly ConversationListRow[] | undefined): string[] {
  const ids: string[] = [];
  for (const c of rows ?? []) {
    const id = c.last_message_kind === 'system' ? str(payloadOf(c), 'user_id') : null;
    if (id) ids.push(id);
  }
  return ids;
}

function ConversationRow({
  c,
  names,
}: {
  c: ConversationListRow;
  names: Record<string, { display_name: string }>;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['chat', 'vocab']);
  const language = useLanguage();
  const { userId } = useAuth();
  const baseTitle = conversationTitle(c, t, t('chat:list.someone'));
  // Several "Волейбол" chats look alike: event chats carry the game's time ("Волейбол · Пт 19:00").
  const when =
    c.kind === 'event' && c.event_starts_at
      ? formatEventWhenShort(c.event_starts_at, language)
      : null;
  const title = when ? t('chat:list.eventTitle', { title: baseTitle, when }) : baseTitle;
  const unread = c.unread_count;
  const payload = payloadOf(c);

  let preview: string;
  if (!c.last_message_kind) {
    // The title already carries the event time.
    preview = t('chat:list.noMessages');
  } else if (c.last_message_kind === 'event_invite') {
    const startsAt = str(payload, 'starts_at');
    const venue = str(payload, 'venue_name');
    const event = sportName(str(payload, 'sport_id'), t);
    preview =
      event && startsAt
        ? t(venue ? 'chat:list.inviteToAt' : 'chat:list.inviteTo', {
            event,
            when: formatEventWhenShort(startsAt, language),
            venue,
          })
        : t('chat:list.invite');
  } else if (c.last_message_kind === 'system') {
    const type = str(payload, 'type');
    const subject = str(payload, 'user_id');
    const name = subject ? names[subject]?.display_name : undefined;
    preview =
      type === 'joined'
        ? subject && subject === userId
          ? t('chat:list.youJoined')
          : name
            ? t('chat:system.joined', { name })
            : t('chat:system.joinedSomeone')
        : type === 'cancelled'
          ? t('chat:system.cancelled')
          : t('chat:list.system');
  } else {
    const body = (c.last_message_body ?? '').replace(/\s+/g, ' ').trim();
    preview = c.last_message_sender_id === userId ? t('list.you', { body }) : body;
  }
  const cancelled = c.kind === 'event' && c.event_status === 'cancelled';
  const time = lastTime(c.last_message_at, language);
  const label = [
    title,
    cancelled ? t('list.cancelled') : null,
    preview,
    time,
    unread > 0 ? t('list.unreadA11y', { count: unread }) : null,
    c.muted ? t('list.mutedA11y') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.conversation_id } })}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {c.kind === 'event' ? (
        <View style={styles.sportIcon}>
          <SportIcon sportId={c.sport_id ?? 'multi'} size={24} />
        </View>
      ) : (
        <Avatar name={baseTitle} path={c.avatar_path} size={48} />
      )}
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text variant={unread > 0 ? 'bodyStrong' : 'body'} numberOfLines={1} style={styles.title}>
            {baseTitle}
          </Text>
          {/* The time never truncates: it is what tells similar event chats apart. */}
          {when ? (
            <Text variant={unread > 0 ? 'bodyStrong' : 'body'} style={styles.when}>
              · {when}
            </Text>
          ) : null}
          {c.muted ? <Icon name="bell-off" size={14} color="textMuted" /> : null}
        </View>
        <Text variant="label" color={unread > 0 ? 'text' : 'textMuted'} numberOfLines={1}>
          {cancelled && preview !== t('chat:system.cancelled')
            ? `${t('chat:list.cancelled')} · ${preview}`
            : preview}
        </Text>
      </View>
      <View style={styles.side}>
        <Text variant="caption" color="textMuted">
          {time}
        </Text>
        {unread > 0 ? (
          <View style={styles.unread}>
            <Text
              variant="caption"
              color={theme.scheme === 'light' ? 'textInverse' : 'onPrimary'}
              maxFontSizeMultiplier={1.2}
            >
              {unread > 99 ? '99+' : String(unread)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ChatsTabScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['chat', 'common']);
  const { session, isLoading: authLoading } = useAuth();
  const requireAuth = useRequireAuth();
  const conversations = useConversations();
  const names = useChatPeople(systemSubjects(conversations.data)).data ?? {};

  let body;
  if (!session) {
    body = authLoading ? null : (
      <EmptyState
        icon="message-circle"
        title={t('common:states.signInRequired')}
        message={t('chat:list.signIn')}
        action={{ label: t('common:actions.signIn'), onPress: () => requireAuth('/chats') }}
      />
    );
  } else if (conversations.isPending) {
    body = (
      <View>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={styles.skeletonText}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="85%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (conversations.isError) {
    body = <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />;
  } else {
    body = (
      <FlatList
        data={conversations.data}
        keyExtractor={(c) => c.conversation_id}
        renderItem={({ item }) => <ConversationRow c={item} names={names} />}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={conversations.isRefetching}
            onRefresh={() => void conversations.refetch()}
            tintColor={theme.colors.textMuted}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="message-circle"
            title={t('chat:list.emptyTitle')}
            message={t('chat:list.emptyMessage')}
            action={{
              label: t('chat:list.toEvents'),
              onPress: () => router.navigate('/events'),
              variant: 'secondary',
            }}
          />
        }
      />
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']} padded={false}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {t('common:screens.chats')}
          </Text>
          {session ? <NotificationsBell /> : null}
        </View>
        {body}
      </View>
    </Screen>
  );
}
