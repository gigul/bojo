import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { useRequireAuth } from '@/lib/auth';
import { useThemedStyles, type Theme } from '@/theme';

import { useUnreadNotificationsCount } from './api';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { position: 'relative' },
    badge: {
      position: 'absolute',
      top: 4,
      right: 2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.danger,
      borderWidth: 2,
      borderColor: t.colors.background,
    },
    badgeText: { fontSize: 10, lineHeight: 12 },
  });

/** Bell → /notifications with an unread counter (inbox entry point in the Events and Chats tabs). */
export function NotificationsBell() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('notifications');
  const requireAuth = useRequireAuth();
  const count = useUnreadNotificationsCount();
  return (
    <View style={styles.wrap}>
      <IconButton
        icon="bell"
        onPress={() => {
          if (requireAuth('/notifications')) router.push('/notifications');
        }}
        accessibilityLabel={count > 0 ? t('bell.a11yUnread', { count }) : t('bell.a11y')}
      />
      {count > 0 ? (
        <View style={styles.badge} pointerEvents="none" aria-hidden>
          <Text
            variant="caption"
            color="textInverse"
            allowFontScaling={false}
            style={styles.badgeText}
          >
            {count > 9 ? '9+' : String(count)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
