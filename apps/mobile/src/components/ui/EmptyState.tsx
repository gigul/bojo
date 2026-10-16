import { isValidElement, type ReactElement } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, useThemedStyles, type Theme } from '@/theme';

import { Button, type ButtonVariant } from './Button';
import { renderIconSlot, type IconSlot } from './iconSlot';
import { Text } from './Text';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  /** Default `primary`. */
  variant?: ButtonVariant;
}

export interface EmptyStateProps {
  /** Feather name, element, or render fn `({ color, size }) => …` (e.g. a SportIcon). */
  icon: IconSlot;
  title: string;
  message?: string;
  /** A button spec, or any element (e.g. two buttons). */
  action?: EmptyStateAction | ReactElement;
  style?: StyleProp<ViewStyle>;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.xxl,
      gap: t.spacing.md,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surfaceAlt,
      marginBottom: t.spacing.xs,
    },
    text: { maxWidth: 360 },
    action: { marginTop: t.spacing.sm },
  });

function isActionSpec(action: EmptyStateAction | ReactElement): action is EmptyStateAction {
  return !isValidElement(action);
}

export function EmptyState({ icon, title, message, action, style }: EmptyStateProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.root, style]}>
      <View style={styles.iconWrap} aria-hidden>
        {renderIconSlot(icon, theme.colors.textMuted, 32)}
      </View>
      <Text variant="heading" align="center" style={styles.text} accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text color="textMuted" align="center" style={styles.text}>
          {message}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.action}>
          {isActionSpec(action) ? (
            <Button
              title={action.label}
              onPress={action.onPress}
              variant={action.variant ?? 'primary'}
            />
          ) : (
            action
          )}
        </View>
      ) : null}
    </View>
  );
}
