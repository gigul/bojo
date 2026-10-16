import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { STORAGE_KEYS } from '@/lib/storageKeys';

import { buildTheme, type ColorScheme, type Theme, type ThemeMode } from './tokens';
import { useWebDocumentTheme } from './webDocument';

/** Never hold the splash longer than this waiting for fonts; we fall back to the system font. */
const FONT_TIMEOUT_MS = Platform.OS === 'web' ? 2500 : 5000;

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

function isThemeMode(v: unknown): v is ThemeMode {
  return typeof v === 'string' && (THEME_MODES as readonly string[]).includes(v);
}

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Saved mode read and fonts settled (loaded, failed or timed out). */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [modeLoaded, setModeLoaded] = useState(false);
  const [fontTimedOut, setFontTimedOut] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    ...Feather.font,
  });

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEYS.theme)
      .then((saved) => {
        if (!cancelled && isThemeMode(saved)) setModeState(saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setModeLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setFontTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (fontError && __DEV__)
      console.warn('[theme] Manrope failed to load, using system font', fontError);
  }, [fontError]);

  // Native: make system UI (alerts, keyboards, date pickers, maps) follow the in-app choice.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);

  const scheme: ColorScheme =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const fontsUsable = fontsLoaded && !fontError;
  const theme = useMemo(() => buildTheme(scheme, fontsUsable), [scheme, fontsUsable]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme.colors.background]);

  useWebDocumentTheme(theme);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEYS.theme, next).catch(() => undefined);
  }, []);

  const ready = modeLoaded && (fontsLoaded || Boolean(fontError) || fontTimedOut);

  const value = useMemo(() => ({ theme, mode, setMode, ready }), [theme, mode, setMode, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function useTheme(): Theme {
  return useThemeContext().theme;
}

export function useThemeMode(): { mode: ThemeMode; setMode: (m: ThemeMode) => void } {
  const { mode, setMode } = useThemeContext();
  return { mode, setMode };
}

/** Extension: true once the saved theme mode is read and fonts have settled (for the splash screen). */
export function useThemeReady(): boolean {
  return useThemeContext().ready;
}

/**
 * Convention for component styles:
 *   const createStyles = (t: Theme) => StyleSheet.create({ ... });   // module level
 *   const styles = useThemedStyles(createStyles);                     // in the component
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
