import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface ChipRowProps {
  children: ReactNode;
  /** Padding / gap of the chips (applied to the scroll content or the wrapping row). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /**
   * Group semantics: `radiogroup` for single-choice chips (`selection="radio"`), `toolbar` /
   * `group` for filters. Spoken together with `accessibilityLabel`.
   */
  role?: 'radiogroup' | 'toolbar' | 'group';
  accessibilityLabel?: string;
  /** From this window width on the chips wrap instead of scrolling (default 600). */
  wrapFrom?: number;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});

/**
 * A row of chips: horizontal scroll on phones, wrapping lines on wide screens — a mouse can't
 * swipe a scroller whose scrollbar is hidden, so overflow chips would be unreachable there.
 */
export function ChipRow({
  children,
  contentContainerStyle,
  style,
  role,
  accessibilityLabel,
  wrapFrom = 600,
}: ChipRowProps) {
  const { width } = useWindowDimensions();
  if (width >= wrapFrom) {
    return (
      <View
        style={[styles.wrap, contentContainerStyle, style]}
        role={role}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={style}
      contentContainerStyle={contentContainerStyle}
      role={role}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </ScrollView>
  );
}
