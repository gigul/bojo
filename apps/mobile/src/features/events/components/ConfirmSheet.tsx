import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text, TextField } from '@/components/ui';
import { useThemedStyles, type Theme } from '@/theme';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Optional free-text input (e.g. the cancel reason). */
  input?: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    maxLength?: number;
  };
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    body: { gap: t.spacing.lg, paddingBottom: t.spacing.sm },
    actions: { gap: t.spacing.sm },
  });

/** Cross-platform confirmation (Alert.alert has no web support): a bottom sheet with two buttons. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  danger = false,
  loading = false,
  onConfirm,
  onClose,
  input,
}: ConfirmSheetProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('common');
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <>
        <View style={styles.body}>
          {message ? <Text color="textMuted">{message}</Text> : null}
          {input ? (
            <TextField
              label={input.label}
              value={input.value}
              onChangeText={input.onChange}
              placeholder={input.placeholder}
              maxLength={input.maxLength}
              multiline
            />
          ) : null}
          <View style={styles.actions}>
            <Button
              title={confirmLabel}
              variant={danger ? 'danger' : 'primary'}
              size="lg"
              fullWidth
              loading={loading}
              onPress={onConfirm}
            />
            <Button title={t('actions.cancel')} variant="ghost" fullWidth onPress={onClose} />
          </View>
        </View>
      </>
    </Sheet>
  );
}
