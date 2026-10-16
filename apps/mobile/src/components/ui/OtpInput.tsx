import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useThemedStyles, type Theme } from '@/theme';

import { Text } from './Text';

export interface OtpInputProps {
  /** Number of digits (default 6 — Supabase email OTP). */
  length?: number;
  value: string;
  /** Receives digits only, trimmed to `length`. */
  onChange: (value: string) => void;
  /** Called once all digits are entered (e.g. auto-submit). */
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  /** Red outline after a failed verification. */
  error?: boolean;
  editable?: boolean;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { position: 'relative', alignSelf: 'stretch' },
    row: { flexDirection: 'row', gap: t.spacing.sm, justifyContent: 'center' },
    cell: {
      flex: 1,
      maxWidth: 52,
      height: 58,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellActive: { borderColor: t.colors.primaryText },
    cellError: { borderColor: t.colors.danger },
    // The real input sits on top of the cells (nearly invisible) so paste, autofill and the
    // OS one-time-code suggestion all work, and screen readers see one labelled field.
    input: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.011,
      color: 'transparent',
      fontSize: 16,
    },
  });

/** One-time code input: a single hidden TextInput rendered as `length` boxes. */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  autoFocus = false,
  error = false,
  editable = true,
}: OtpInputProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('common');
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, '').slice(0, length);

  const handleChange = (text: string) => {
    const next = text.replace(/\D/g, '').slice(0, length);
    onChange(next);
    if (next.length === length && next !== digits) onComplete?.(next);
  };

  return (
    <Pressable style={styles.root} onPress={() => inputRef.current?.focus()}>
      <View style={styles.row} aria-hidden>
        {Array.from({ length }, (_, i) => {
          const isActive =
            focused && (i === digits.length || (i === length - 1 && digits.length === length));
          return (
            <View
              key={i}
              style={[
                styles.cell,
                isActive ? styles.cellActive : null,
                error ? styles.cellError : null,
              ]}
            >
              <Text variant="title" maxFontSizeMultiplier={1.3}>
                {digits[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={handleChange}
        maxLength={length}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        contextMenuHidden={false}
        accessibilityLabel={t('a11y.otp', { length })}
        aria-invalid={error}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
    </Pressable>
  );
}
