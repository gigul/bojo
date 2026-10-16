import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

import { IS_WEB, spaceActivates, webOnly } from './a11y';
import { Text } from './Text';

const TRACK_W = 52;
const TRACK_H = 32;
const OUTLINE = 2;
const KNOB = 24;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 56,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.lg,
    },
    text: { flex: 1, gap: 2 },
    rowPressed: { backgroundColor: t.colors.surfaceAlt },
    rowDisabled: { opacity: 0.5 },
    // Off: outlined in `textMuted` (≥ 3:1 on every surface) with a muted knob — never a faint
    // grey-on-grey pill. On: lime track + graphite knob with a check (state not by colour alone).
    track: {
      width: TRACK_W,
      height: TRACK_H,
      borderRadius: TRACK_H / 2,
      borderWidth: OUTLINE,
      borderColor: t.colors.textMuted,
      backgroundColor: t.colors.surface,
      paddingHorizontal: (TRACK_H - 2 * OUTLINE - KNOB) / 2,
      justifyContent: 'center',
    },
    trackOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    knob: {
      width: KNOB,
      height: KNOB,
      borderRadius: KNOB / 2,
      backgroundColor: t.colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    knobOn: { alignSelf: 'flex-end', backgroundColor: t.colors.onPrimary },
  });

/** The switch drawing (decorative: the row around it is the accessible control). */
export function SwitchTrack({ value }: { value: boolean }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.track, value ? styles.trackOn : null]} aria-hidden>
      <View style={[styles.knob, value ? styles.knobOn : null]}>
        {value ? <Icon name="check" size={14} color="primary" /> : null}
      </View>
    </View>
  );
}

export interface SwitchRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  /** Title style: `bodyStrong` (default, settings rows) or `heading` (form sections). */
  titleVariant?: 'bodyStrong' | 'heading';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Labelled on/off row. The whole row is one accessible switch (a bigger target than a bare toggle).
 * Own drawing instead of RN <Switch>, which renders differently (and off-brand) on every platform.
 */
export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  titleVariant = 'bodyStrong',
  style,
  testID,
}: SwitchRowProps) {
  const styles = useThemedStyles(createStyles);
  const toggle = () => onValueChange(!value);
  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      {...(IS_WEB ? { role: 'switch' } : null)}
      {...webOnly({ onKeyDown: spaceActivates(toggle) })}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.rowPressed : null,
        disabled ? styles.rowDisabled : null,
        style,
      ]}
    >
      <View style={styles.text}>
        <Text variant={titleVariant}>{title}</Text>
        {subtitle ? (
          <Text variant="label" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <SwitchTrack value={value} />
    </Pressable>
  );
}
