import { useId, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme, useThemedStyles, type Theme } from '@/theme';

import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Error message shown under the field (announced politely). */
  error?: string | null;
  /** Helper text under the field when there is no error. */
  hint?: string;
  /** Style of the outer container. */
  containerStyle?: StyleProp<ViewStyle>;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: { gap: t.spacing.xs + 2 },
    input: {
      ...t.typography.body,
      color: t.colors.text,
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    multiline: { minHeight: 96, textAlignVertical: 'top' },
    focused: { borderColor: t.colors.primaryText },
    invalid: { borderColor: t.colors.danger },
    disabled: { opacity: 0.5 },
  });

export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  containerStyle,
  onFocus,
  onBlur,
  editable = true,
  multiline,
  accessibilityLabel,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const labelId = useId();
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text variant="label" color="textMuted" nativeID={labelId}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.primaryText}
        cursorColor={theme.colors.primaryText}
        keyboardAppearance={theme.scheme}
        maxFontSizeMultiplier={2}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityLabelledBy={labelId}
        accessibilityHint={error ?? hint}
        accessibilityState={{ disabled: !editable }}
        aria-invalid={hasError}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          focused ? styles.focused : null,
          hasError ? styles.invalid : null,
          !editable ? styles.disabled : null,
        ]}
        {...inputProps}
      />
      {hasError ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite" role="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
