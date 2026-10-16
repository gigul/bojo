import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  step?: number;
  /** Display formatter for the value (default: the number). */
  formatValue?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.md,
      minHeight: t.minTouch,
    },
    label: { flexShrink: 1 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    value: { minWidth: 40, textAlign: 'center' },
    button: { backgroundColor: t.colors.surfaceAlt },
  });

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * − value + control. On iOS/Android the row is one "adjustable" element (swipe up/down with a
 * screen reader); on web the two buttons are separate labelled controls.
 */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  step = 1,
  formatValue,
  style,
}: StepperProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('common');
  const display = formatValue ? formatValue(value) : String(value);
  const canDecrease = value > min;
  const canIncrease = value < max;
  const decrease = () => onChange(clamp(value - step, min, max));
  const increase = () => onChange(clamp(value + step, min, max));
  const nativeAdjustable = Platform.OS !== 'web';

  return (
    <View
      style={[styles.row, style]}
      {...(nativeAdjustable
        ? {
            accessible: true,
            accessibilityRole: 'adjustable' as const,
            accessibilityLabel: label,
            accessibilityValue: { min, max, now: value, text: display },
            accessibilityActions: [{ name: 'increment' as const }, { name: 'decrement' as const }],
            onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => {
              if (e.nativeEvent.actionName === 'increment') increase();
              if (e.nativeEvent.actionName === 'decrement') decrease();
            },
          }
        : null)}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <IconButton
          icon="minus"
          onPress={decrease}
          disabled={!canDecrease}
          accessibilityLabel={`${label}: ${t('actions.decrease')}`}
          style={styles.button}
        />
        <Text
          variant="heading"
          style={styles.value}
          accessibilityLiveRegion="polite"
          accessibilityLabel={t('a11y.stepper', { label, value: display })}
        >
          {display}
        </Text>
        <IconButton
          icon="plus"
          onPress={increase}
          disabled={!canIncrease}
          accessibilityLabel={`${label}: ${t('actions.increase')}`}
          style={styles.button}
        />
      </View>
    </View>
  );
}
