// In-app notifications inbox (ARCHITECTURE §2.2, §6). Owner: c.
import { router, Stack, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Skeleton, Text } from '@/components/ui';
import {
  notificationContent,
  notificationUrl,
  useMarkNotificationsRead,
  useNotifications,
  type InboxItem,
} from '@/features/notifications';
import { Icon } from '@/icons';
import { useLanguage } from '@/i18n';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { formatEventWhen } from '@/lib/datetime';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    list: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingVertical: t.spacing.sm,
      flexGrow: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.md,
    },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surfaceAlt,
    },
    text: { flex: 1, gap: 2 },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 6,
      // Lime on paper is 1.2:1 — graphite in light mode; lime stays in dark mode (high contrast).
      backgroundColor: t.scheme === 'light' ? t.colors.text : t.colors.primary,
    },
    dotSpacer: { width: 10 },
    divider: {
      height: t.layout.hairline,
      backgroundColor: t.colors.border,
      marginLeft: t.layout.screenGutter + 52,
    },
    skeletonRow: {
      flexDirection: 'row',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.md,
    },
    skeletonText: { flex: 1, gap: t.spacing.sm },
  });

function InboxRow({ item, onPress }: { item: InboxItem; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('notifications');
  const language = useLanguage();
  const content = notificationContent(item.type, item.payload, t, language);
  const unread = item.read_at === null;
  const time = formatEventWhen(item.created_at, language);
  const label = [unread ? t('inbox.unread') : null, content.title, content.body, time]
    .filter(Boolean)
    .join('. ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.icon}>
        <Icon name={content.icon} size={20} color={unread ? 'text' : 'textMuted'} />
      </View>
      <View style={styles.text}>
        <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={2}>
          {content.title}
        </Text>
        {content.body ? (
          <Text variant="label" color="textMuted" numberOfLines={2}>
            {content.body}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {time}
        </Text>
      </View>
      {unread ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['notifications', 'common']);
  const { session, isLoading: authLoading } = useAuth();
  const requireAuth = useRequireAuth();
  const inbox = useNotifications();
  const markRead = useMarkNotificationsRead();
  const items = inbox.data ?? [];
  const hasUnread = items.some((n) => n.read_at === null);

  const open = (item: InboxItem) => {
    if (item.read_at === null) markRead.mutate([item.id]);
    router.push(notificationUrl(item.payload) as Href);
  };

  const header = (
    <Stack.Screen
      options={{
        title: t('common:screens.notifications'),
        headerRight: hasUnread
          ? () => (
              <Button
                title={t('notifications:inbox.readAll')}
                variant="ghost"
                onPress={() => markRead.mutate(undefined)}
              />
            )
          : undefined,
      }}
    />
  );

  if (!session && !authLoading) {
    return (
      <View style={styles.root}>
        {header}
        <EmptyState
          icon="bell"
          title={t('common:states.signInRequired')}
          message={t('notifications:inbox.signIn')}
          action={{
            label: t('common:actions.signIn'),
            onPress: () => requireAuth('/notifications'),
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      {inbox.isPending ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={styles.skeletonText}>
                <Skeleton width="80%" height={16} />
                <Skeleton width="50%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : inbox.isError ? (
        <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <InboxRow item={item} onPress={() => open(item)} />}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={inbox.isRefetching}
              onRefresh={() => void inbox.refetch()}
              tintColor={theme.colors.textMuted}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title={t('notifications:inbox.emptyTitle')}
              message={t('notifications:inbox.emptyMessage')}
            />
          }
        />
      )}
    </View>
  );
}
