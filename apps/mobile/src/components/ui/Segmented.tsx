import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, useThemedStyles, type Theme } from '@/theme';

import { IS_WEB, moveFocusInGroup, selectionA11y, spaceActivates, webOnly } from './a11y';
import { Text } from './Text';

export interface SegmentedOption<T> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Spoken name of the whole control. */
  accessibilityLabel?: string;
  /**
   * `tabs` when the control switches the content below (tablist / tab, aria-selected); `radio`
   * (default) when it picks a value (radiogroup / radio, aria-checked). Both use a roving tab stop
   * with arrow keys on web.
   */
  semantics?: 'tabs' | 'radio';
  style?: StyleProp<ViewStyle>;
}

const PAD = 3;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: PAD,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surfaceAlt,
    },
    item: {
      flex: 1,
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: t.colors.text },
    pressed: { opacity: 0.7 },
  });

/** Segmented control. Selected = inverted graphite pill (accent is reserved for main actions). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  semantics = 'radio',
  style,
}: SegmentedProps<T>) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const tabs = semantics === 'tabs';
  const itemRole = tabs ? 'tab' : 'radio';
  const groupRole = tabs ? 'tablist' : 'radiogroup';
  const hasSelection = options.some((o) => o.value === value);

  return (
    <View style={[styles.track, style]} role={groupRole} accessibilityLabel={accessibilityLabel}>
      {options.map((option, index) => {
        const selected = option.value === value;
        // Roving tab stop: only the selected segment is in the Tab order; arrows move between them.
        const tabbable = selected || (!hasSelection && index === 0);
        const select = () => onChange(option.value);
        return (
          <Pressable
            key={String(option.value)}
            onPress={select}
            {...selectionA11y(itemRole, selected)}
            accessibilityLabel={option.label}
            {...(IS_WEB ? { tabIndex: tabbable ? 0 : -1 } : null)}
            {...webOnly({
              onKeyDown: (e: Parameters<ReturnType<typeof spaceActivates>>[0]) => {
                const next = moveFocusInGroup(e, itemRole, groupRole);
                if (next) {
                  // Radios and (automatically activated) tabs follow focus.
                  next.click();
                  return;
                }
                if (!selected) spaceActivates(select)(e);
              },
            })}
            style={({ pressed }) => [
              styles.item,
              selected ? styles.selected : null,
              pressed && !selected ? styles.pressed : null,
            ]}
          >
            <Text
              variant={selected ? 'bodyStrong' : 'body'}
              color={selected ? theme.colors.textInverse : theme.colors.text}
              // Two lines rather than an ellipsis on narrow phones ("Площадки · 489+").
              numberOfLines={2}
              align="center"
              maxFontSizeMultiplier={1.4}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
