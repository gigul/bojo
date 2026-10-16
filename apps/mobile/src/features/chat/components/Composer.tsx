import { TEXT_LIMITS } from '@bojo/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

import { IconButton } from '@/components/ui';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.sm,
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    input: {
      ...t.typography.body,
      flex: 1,
      color: t.colors.text,
      minHeight: 44,
      maxHeight: 132,
      paddingHorizontal: 16,
      paddingTop: 11,
      paddingBottom: 11,
      borderRadius: 22,
      backgroundColor: t.colors.surfaceAlt,
    },
  });

/** Message input + send. Enter sends on web (Shift+Enter = new line). */
export function Composer({
  onSend,
  disabled = false,
}: {
  onSend: (body: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('chat');
  const [text, setText] = useState('');
  const [contentHeight, setContentHeight] = useState(0);
  // Web textareas don't grow by themselves (scrollHeight already includes the padding); native
  // multiline inputs do, within minHeight/maxHeight.
  const webHeight = Math.min(132, Math.max(44, Math.ceil(contentHeight)));
  const canSend = !disabled && text.trim().length > 0;

  const submit = () => {
    const body = text.trim();
    if (!body || disabled) return;
    onSend(body);
    setText('');
    setContentHeight(0);
  };

  const onKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    const native = e.nativeEvent as TextInputKeyPressEventData & {
      shiftKey?: boolean;
      isComposing?: boolean;
    };
    if (native.key === 'Enter' && !native.shiftKey && !native.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <View style={styles.bar}>
      <TextInput
        value={text}
        onChangeText={setText}
        onKeyPress={onKeyPress}
        onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
        multiline
        maxLength={TEXT_LIMITS.message}
        placeholder={t('composer.placeholder')}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.primaryText}
        cursorColor={theme.colors.primaryText}
        keyboardAppearance={theme.scheme}
        accessibilityLabel={t('composer.a11y')}
        maxFontSizeMultiplier={1.6}
        editable={!disabled}
        style={[styles.input, Platform.OS === 'web' ? { height: webHeight } : null]}
      />
      <IconButton
        icon="send"
        variant="primary"
        onPress={submit}
        disabled={!canSend}
        accessibilityLabel={t('composer.send')}
      />
    </View>
  );
}
