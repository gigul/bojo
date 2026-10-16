import type { ConversationListRow } from '@bojo/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Text } from '@/components/ui';
import { sportName } from '@/features/events';
import { SportIcon } from '@/icons';
import { useLanguage } from '@/i18n';
import { formatEventWhen } from '@/lib/datetime';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      maxWidth: 260,
      minHeight: t.minTouch,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flexShrink: 1 },
    pressed: { opacity: 0.7 },
  });

/** Event chat: pictogram + title/time → event. Match chat: avatar + name → person. */
export function ChatHeaderTitle({ row }: { row: ConversationListRow }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('chat');
  const language = useLanguage();
  const isEvent = row.kind === 'event';
  const title = isEvent
    ? row.title?.trim() || sportName(row.sport_id, t)
    : row.title?.trim() || t('list.someone');
  const subtitle = isEvent
    ? [
        row.title?.trim() ? sportName(row.sport_id, t) : null,
        row.event_starts_at ? formatEventWhen(row.event_starts_at, language) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : t('header.match');

  const open = () => {
    if (isEvent && row.event_id)
      router.push({ pathname: '/event/[id]', params: { id: row.event_id } });
    else if (!isEvent && row.other_user_id)
      router.push({ pathname: '/person/[id]', params: { id: row.other_user_id } });
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityHint={isEvent ? t('header.openEvent') : t('header.openPerson')}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {isEvent ? (
        <View style={styles.icon}>
          <SportIcon sportId={row.sport_id ?? 'multi'} size={20} />
        </View>
      ) : (
        <Avatar name={title} path={row.avatar_path} size={36} />
      )}
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
