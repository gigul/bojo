// Cross-platform confirmation (RN's Alert is a no-op on web): title, message and two buttons in a Sheet.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    body: { gap: t.spacing.lg, paddingBottom: t.spacing.sm },
    actions: { gap: t.spacing.sm },
  });

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  loading = false,
  destructive = false,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('common');
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        {message ? <Text color="textMuted">{message}</Text> : null}
        {children}
        <View style={styles.actions}>
          <Button
            title={confirmLabel}
            onPress={onConfirm}
            loading={loading}
            variant={destructive ? 'danger' : 'primary'}
            size="lg"
            fullWidth
          />
          <Button title={t('actions.cancel')} onPress={onClose} variant="ghost" fullWidth />
        </View>
      </View>
    </Sheet>
  );
}
