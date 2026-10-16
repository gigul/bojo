import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useReduceMotion, useThemedStyles, type Theme } from '@/theme';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label of the confirming button (default common:actions.confirm). */
  confirmLabel?: string;
  /** Label of the cancelling button (default common:actions.cancel). */
  cancelLabel?: string;
  /** Red confirm button for irreversible / harmful actions (block, delete). */
  destructive?: boolean;
}

export interface ConfirmDialogProps extends Partial<ConfirmOptions> {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Spinner on the confirm button (dialog stays open). */
  loading?: boolean;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.layout.screenGutter,
    },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: t.colors.overlay },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.xl,
      borderWidth: t.scheme === 'dark' ? t.layout.hairline : 0,
      borderColor: t.colors.border,
      padding: t.spacing.xl,
      gap: t.spacing.md,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginTop: t.spacing.sm },
    action: { flexGrow: 1, flexBasis: 120 },
  });

/**
 * Themed, accessible confirmation dialog (works the same on iOS, Android and web —
 * RN `Alert.alert` is a no-op on web). Escape / Android back = cancel.
 */
export function ConfirmDialog({
  visible,
  title = '',
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('common');
  const reduceMotion = useReduceMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel ?? t('actions.cancel')}
        />
        <View
          style={styles.card}
          accessibilityViewIsModal
          role="alertdialog"
          aria-modal
          aria-label={title}
        >
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {message ? <Text color="textMuted">{message}</Text> : null}
          <View style={styles.actions}>
            <Button
              title={cancelLabel ?? t('actions.cancel')}
              variant="secondary"
              onPress={onCancel}
              disabled={loading}
              style={styles.action}
            />
            <Button
              title={confirmLabel ?? t('actions.confirm')}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={styles.action}
              testID="confirm-dialog-confirm"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export interface ConfirmDialogApi {
  /** Opens the dialog; resolves true on confirm, false on cancel/dismiss. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Render this element somewhere in the screen tree. */
  dialog: ReactNode;
}

/**
 * Promise-based confirm without a global provider:
 *   const { confirm, dialog } = useConfirmDialog();
 *   if (!(await confirm({ title, destructive: true }))) return;
 *   …
 *   return <>{…}{dialog}</>;
 */
export function useConfirmDialog(): ConfirmDialogApi {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setVisible(false);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <ConfirmDialog
      visible={visible}
      {...(options ?? {})}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
}
