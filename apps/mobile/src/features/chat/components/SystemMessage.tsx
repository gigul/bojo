import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: t.spacing.sm },
    pill: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 4,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surfaceAlt,
      maxWidth: '86%',
    },
  });

/** Centered caption for `kind='system'` messages ({type:'joined', user_id} / {type:'cancelled'}). */
export function SystemMessage({
  payload,
  personName,
}: {
  payload: Record<string, unknown> | null;
  personName: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('chat');
  const type = typeof payload?.type === 'string' ? payload.type : '';
  const text =
    type === 'joined'
      ? personName
        ? t('system.joined', { name: personName })
        : t('system.joinedSomeone')
      : type === 'cancelled'
        ? t('system.cancelled')
        : t('system.generic');
  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Text variant="caption" color="textMuted" align="center">
          {text}
        </Text>
      </View>
    </View>
  );
}

/** Day separator ("Сегодня", "Сб, 17 окт"). */
export function DaySeparator({ label }: { label: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}
