import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    section: { gap: t.spacing.md },
    header: { gap: 2 },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    padded: { padding: t.spacing.lg, gap: t.spacing.md },
    divider: {
      height: t.layout.hairline,
      backgroundColor: t.colors.border,
      marginLeft: t.spacing.lg,
    },
  });

export interface SectionProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Wrap children in a surface card. */
  card?: boolean;
  /** Inner padding of the card (default true). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Titled block used across profile / edit-profile / settings / runs. */
export function Section({
  title,
  subtitle,
  children,
  card = false,
  padded = true,
  style,
}: SectionProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.header}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="label" color="textMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {card ? (
        <View style={[styles.card, padded ? styles.padded : null]}>{children}</View>
      ) : (
        children
      )}
    </View>
  );
}

export function Divider() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.divider} />;
}

/**
 * Labelled on/off row — promoted to the kit (one switch style app-wide, off state outlined at
 * ≥ 3:1). Re-exported here so profile / settings imports keep working.
 */
export { SwitchRow, type SwitchRowProps } from '@/components/ui';
