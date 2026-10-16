import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion, useThemedStyles, type Theme } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const OPEN_MS = 260;
const CLOSE_MS = 200;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.overlay,
    },
    // Full-screen wrapper: the panel's max height is measured against the screen, not its content.
    kav: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    panel: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.xl,
      borderTopRightRadius: t.radius.xl,
      borderWidth: t.scheme === 'dark' ? t.layout.hairline : 0,
      borderBottomWidth: 0,
      borderColor: t.colors.border,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.border,
      marginTop: t.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.sm,
      paddingLeft: t.layout.screenGutter,
      paddingRight: t.spacing.sm,
      paddingTop: t.spacing.xs,
      minHeight: 52,
    },
    title: { flex: 1 },
    // flexShrink lets tall content (e.g. a ScrollView) shrink to the panel and scroll.
    body: { flexShrink: 1, paddingHorizontal: t.layout.screenGutter, paddingTop: t.spacing.sm },
  });

/** Modal-based bottom sheet: scrim tap, close button and Android back all close it. */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  // A percentage maxHeight resolves against the auto-height wrapper on web, so cap by the window.
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  const [panelHeight, setPanelHeight] = useState(600);

  // Mount immediately when opened; unmount only after the closing animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : visible ? OPEN_MS : CLOSE_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, mounted, progress, reduceMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [panelHeight, 0] });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.overlay, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.closeSheet')}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
          pointerEvents="box-none"
        >
          <Animated.View
            accessibilityViewIsModal
            onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
            style={[
              styles.panel,
              {
                maxHeight: windowHeight * 0.92,
                paddingBottom: insets.bottom + 16,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text variant="heading" style={styles.title} accessibilityRole="header">
                {title ?? ''}
              </Text>
              <IconButton icon="x" onPress={onClose} accessibilityLabel={t('actions.close')} />
            </View>
            <View style={styles.body}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
