import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/icons';
import {
  darkColors,
  lightColors,
  useReduceMotion,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@/theme';

import { Text } from './Text';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface ToastApi {
  /** Shows a short message at the top of the screen (replaces the current one). */
  show: (text: string, tone?: ToastTone) => void;
  hide: () => void;
}

interface ToastState {
  id: number;
  text: string;
  tone: ToastTone;
}

const DURATION_MS = 3500;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const TONE_ICON: Record<ToastTone, IconName> = {
  neutral: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-circle',
};

const ToastContext = createContext<ToastApi | null>(null);

const createStyles = (t: Theme) =>
  StyleSheet.create({
    host: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      maxWidth: t.layout.maxContentWidth - 2 * t.layout.screenGutter,
      marginHorizontal: t.layout.screenGutter,
      minHeight: 48,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radius.lg,
      // Inverted surface (graphite on light, paper on dark) — a classic snackbar.
      backgroundColor: t.colors.text,
      boxShadow: t.scheme === 'dark' ? undefined : '0px 6px 18px rgba(18, 20, 17, 0.18)',
    },
    text: { flexShrink: 1 },
  });

function ToastView({ toast, onHide }: { toast: ToastState | null; onHide: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { t } = useTranslation('common');
  const [progress] = useState(() => new Animated.Value(0));
  // Icons sit on the inverted surface, so they use the opposite scheme's status colours.
  const inverted = theme.scheme === 'dark' ? lightColors : darkColors;
  const toneColor: Record<ToastTone, string> = {
    neutral: theme.colors.textInverse,
    success: inverted.success,
    warning: inverted.warning,
    danger: inverted.danger,
  };

  useEffect(() => {
    if (!toast) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    const timer = setTimeout(onHide, DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, progress, reduceMotion, onHide]);

  if (!toast) return null;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View style={{ opacity: progress, transform: reduceMotion ? [] : [{ translateY }] }}>
        <Pressable
          onPress={onHide}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={toast.text}
          accessibilityHint={t('a11y.dismissToast')}
          style={styles.toast}
        >
          <Icon name={TONE_ICON[toast.tone]} size={20} color={toneColor[toast.tone]} />
          <Text color="textInverse" style={styles.text}>
            {toast.text}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const hide = useCallback(() => setToast(null), []);
  const show = useCallback((text: string, tone: ToastTone = 'neutral') => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text, tone }));
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, []);
  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastView toast={toast} onHide={hide} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
