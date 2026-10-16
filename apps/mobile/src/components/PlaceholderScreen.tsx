// WAVE-A placeholder body for routes owned by b2 / c / d. Owners replace the whole screen;
// delete this file once no route uses it.
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState, Screen, Text } from '@/components/ui';
import type { IconName } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

export interface PlaceholderScreenProps {
  title: string;
  icon?: IconName;
  /**
   * `stack` (default): the screen lives under a native Stack header → title goes to the header.
   * `tab`: headerless tab screen → large in-screen title and the top safe-area edge.
   */
  kind?: 'stack' | 'tab';
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    title: { marginTop: t.spacing.sm },
  });

export function PlaceholderScreen({
  title,
  icon = 'tool',
  kind = 'stack',
}: PlaceholderScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('common');
  const isTab = kind === 'tab';
  return (
    <Screen edges={isTab ? ['top', 'left', 'right'] : undefined}>
      {isTab ? (
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : (
        <Stack.Screen options={{ title }} />
      )}
      <EmptyState
        icon={icon}
        title={t('states.wip')}
        message={t('states.wipMessage')}
        action={
          __DEV__
            ? {
                label: t('screens.devUi'),
                onPress: () => router.push('/dev/ui'),
                variant: 'secondary',
              }
            : undefined
        }
      />
    </Screen>
  );
}
