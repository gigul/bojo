import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      minHeight: 24,
      paddingHorizontal: 10,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surfaceAlt,
    },
  });

/**
 * "Verified" mark (profiles.is_verified — set manually by a moderator in the MVP).
 * `compact` = icon only (next to a name), still announced by screen readers.
 */
export function VerifiedBadge({ compact = false, size = 18 }: { compact?: boolean; size?: number }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('profile');
  if (compact) {
    return <Icon name="check-circle" size={size} color="primaryText" accessibilityLabel={t('verified.label')} />;
  }
  return (
    <View style={styles.pill} accessible accessibilityLabel={t('verified.label')}>
      <Icon name="check-circle" size={14} color="primaryText" />
      <Text variant="label" maxFontSizeMultiplier={1.4}>
        {t('verified.label')}
      </Text>
    </View>
  );
}
