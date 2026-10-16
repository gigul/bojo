// pickMode chrome shared by both maps: a centre crosshair (decorative) + the confirm button.
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui';
import { floatingShadow, useThemedStyles, type Theme } from '@/theme';

const CROSS = 40;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    crossWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ring: {
      width: CROSS,
      height: CROSS,
      borderRadius: CROSS / 2,
      borderWidth: 3,
      borderColor: t.colors.text,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    ringOuter: {
      width: CROSS + 6,
      height: CROSS + 6,
      borderRadius: (CROSS + 6) / 2,
      borderWidth: 3,
      borderColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.primary,
      borderWidth: 1.5,
      borderColor: t.colors.onPrimary,
    },
    footer: {
      position: 'absolute',
      left: t.spacing.lg,
      right: t.spacing.lg,
      alignItems: 'center',
    },
    button: {
      alignSelf: 'stretch',
      maxWidth: t.layout.maxContentWidth - 2 * t.layout.screenGutter,
      width: '100%',
      ...floatingShadow(t.scheme),
    },
  });

export function PickOverlay({
  onConfirm,
  bottomInset,
}: {
  onConfirm: () => void;
  bottomInset: number;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('map');
  return (
    <>
      <View
        pointerEvents="none"
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.crossWrap, { bottom: bottomInset }]}
      >
        <View style={styles.ringOuter}>
          <View style={styles.ring}>
            <View style={styles.dot} />
          </View>
        </View>
      </View>
      <View pointerEvents="box-none" style={[styles.footer, { bottom: bottomInset + 16 }]}>
        <Button
          title={t('pick.confirm')}
          onPress={onConfirm}
          icon="check"
          size="lg"
          accessibilityHint={t('pick.confirmHint')}
          style={styles.button}
        />
      </View>
    </>
  );
}
