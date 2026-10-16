import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, useThemedStyles, type Theme } from '@/theme';

import {
  IS_WEB,
  moveFocusInGroup,
  selectionA11y,
  spaceActivates,
  VisuallyHidden,
  webOnly,
  type SelectionKind,
} from './a11y';
import { renderIconSlot, type IconSlot } from './iconSlot';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  /**
   * Active filter / choice: lime fill + graphite outline + check mark (never colour alone — the
   * outline and the check keep ≥ 3:1 against the idle chip).
   */
  selected?: boolean;
  /** Without onPress the chip is a static tag (e.g. venue attributes). */
  onPress?: () => void;
  /**
   * How `selected` is announced (web ARIA / native accessibilityState):
   * `toggle` (default, multi-select filters) → pressed; `radio` (single choice; wrap the chips in a
   * `role="radiogroup"` container, e.g. `ChipRow role="radiogroup"`) → checked; `none` → a plain
   * button whose selection is only visual (e.g. a chip that opens a picker sheet).
   */
  selection?: Exclude<SelectionKind, 'tab'>;
  /**
   * `highlight`: a static tag that marks something as shared/notable — outline + check on the
   * neutral surface (no lime fill, so it never looks like an active filter).
   */
  appearance?: 'default' | 'highlight';
  /** Feather name, element, or render fn `({ color, size }) => <SportIcon … />`. */
  icon?: IconSlot;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const CHIP_HEIGHT = 36;
// 2 px: 1.5 is floored to 1 device pixel on low-density screens.
const OUTLINE = 2;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: CHIP_HEIGHT,
      paddingHorizontal: 14 - OUTLINE,
      borderRadius: t.radius.pill,
      borderWidth: OUTLINE,
      borderColor: 'transparent',
      backgroundColor: t.colors.surfaceAlt,
    },
    withIcon: { paddingLeft: 10 - OUTLINE },
    // Light: the graphite outline separates lime from the paper chips (1.14:1 by fill alone).
    // Dark: lime vs the dark chip is already ~12:1, the outline just keeps the size stable.
    selected: {
      backgroundColor: t.colors.primary,
      borderColor: t.scheme === 'light' ? t.colors.text : t.colors.primary,
    },
    highlight: { backgroundColor: t.colors.surface, borderColor: t.colors.text },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.4 },
    // Web has no hitSlop: a transparent 44 pt hit box around the 36 pt pill.
    webHit: {
      minHeight: t.minTouch,
      justifyContent: 'center',
      borderRadius: t.radius.pill,
    },
  });

export function Chip({
  label,
  selected = false,
  onPress,
  selection = 'toggle',
  appearance = 'default',
  icon,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const highlight = appearance === 'highlight';
  const filled = selected && !highlight;
  const fg = filled ? theme.colors.onPrimary : theme.colors.text;
  const showCheck = selected || highlight;
  // Without a pictogram the check leads; with one it trails (the pictogram keeps its place).
  const leading = icon ?? (showCheck ? 'check' : undefined);
  const trailing = icon !== undefined && showCheck ? 'check' : undefined;
  const spoken = accessibilityLabel ?? label;

  const content = (
    <>
      {renderIconSlot(leading, fg, 16)}
      <Text
        variant={showCheck ? 'bodyStrong' : 'body'}
        color={fg}
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
        aria-hidden={IS_WEB && spoken !== label ? true : undefined}
      >
        {label}
      </Text>
      {renderIconSlot(trailing, fg, 16)}
    </>
  );

  const pill = [
    styles.base,
    leading ? styles.withIcon : null,
    highlight ? styles.highlight : filled ? styles.selected : null,
  ];

  if (!onPress) {
    // A static tag is just text for assistive tech: no aria-label on a role-less element (web);
    // natively the chip is one element with its label.
    return (
      <View
        style={[pill, style]}
        accessible={!IS_WEB && spoken !== label ? true : undefined}
        accessibilityLabel={!IS_WEB ? spoken : undefined}
        testID={testID}
      >
        {content}
        {spoken !== label ? <VisuallyHidden>{spoken}</VisuallyHidden> : null}
      </View>
    );
  }

  const keyboard =
    selection === 'radio'
      ? webOnly({
          onKeyDown: (e: Parameters<ReturnType<typeof spaceActivates>>[0]) => {
            // Arrows move to the previous / next radio of the group and check it (APG radio).
            const next = moveFocusInGroup(e, 'radio', 'radiogroup');
            if (next) {
              next.click();
              return;
            }
            spaceActivates(onPress)(e);
          },
        })
      : null;

  if (IS_WEB) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        {...selectionA11y(selection, selected, disabled)}
        aria-label={spoken}
        accessibilityHint={accessibilityHint}
        testID={testID}
        {...webOnly({ dataSet: { hit: 'pill' } })}
        {...keyboard}
        style={[styles.webHit, disabled ? styles.disabled : null]}
      >
        {({ pressed }) => (
          <View style={[pill, pressed ? styles.pressed : null, style]}>{content}</View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      {...selectionA11y(selection, selected, disabled)}
      accessibilityLabel={spoken}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        pill,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}
