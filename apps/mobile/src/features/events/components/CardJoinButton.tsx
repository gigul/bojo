import type { EventCardRow } from '@bojo/shared';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useLanguage } from '@/i18n';
import { useRequireAuth } from '@/lib/auth';
import { formatEventWhen } from '@/lib/datetime';
import { useThemedStyles, useTheme, type Theme } from '@/theme';

import { useJoinEvent } from '../api';
import { eventTitle, sportName } from '../format';
import { useNow } from '../useNow';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    pill: {
      minHeight: 44,
      minWidth: 88,
      paddingHorizontal: 18,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      backgroundColor: t.colors.text,
    },
    pressed: { opacity: 0.8 },
    disabled: { backgroundColor: t.colors.surfaceAlt },
    status: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  });

export function successHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** "Иду" right on the card; joined / organizer / full states (DESIGN.md EventCard). */
export function CardJoinButton({ event }: { event: EventCardRow }) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('events');
  const requireAuth = useRequireAuth();
  const join = useJoinEvent();
  const now = useNow();
  const language = useLanguage();

  if (event.status !== 'scheduled' || new Date(event.starts_at).getTime() <= now) return null;

  if (event.is_organizer) {
    return (
      <View style={styles.status}>
        <Icon name="star" size={16} color="primaryText" />
        <Text variant="label" color="textMuted">
          {t('card.organizer')}
        </Text>
      </View>
    );
  }
  if (event.my_status === 'going') {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Icon name="check-circle" size={16} color="primaryText" />
        <Text variant="label">{t('card.going')}</Text>
      </View>
    );
  }

  const full = event.spots_left <= 0;
  const invited = event.my_status === 'invited';
  const label = full ? t('card.full') : invited ? t('card.accept') : t('card.join');
  // Every card has one: say which game it is ("Иду: Теннис, сегодня 18:00").
  const sport = sportName(event.sport_id, t);
  const own = eventTitle(event, t);
  const which = {
    event: own === sport ? sport : `${sport} · ${own}`,
    when: formatEventWhen(event.starts_at, language),
  };
  const spoken = full
    ? t('card.fullA11y', which)
    : invited
      ? t('card.acceptA11y', which)
      : t('card.joinA11y', which);
  const onPress = () => {
    if (!requireAuth(`/event/${event.id}`)) return;
    join.mutate(event.id, { onSuccess: successHaptic });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={full || join.isPending}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled: full, busy: join.isPending }}
      style={({ pressed }) => [
        styles.pill,
        full ? styles.disabled : null,
        pressed && !full ? styles.pressed : null,
      ]}
    >
      {join.isPending ? (
        <ActivityIndicator size="small" color={theme.colors.textInverse} />
      ) : (
        <Text
          variant="bodyStrong"
          color={full ? 'textMuted' : 'textInverse'}
          maxFontSizeMultiplier={1.4}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
