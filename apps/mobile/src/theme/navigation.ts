import {
  DarkTheme,
  DefaultTheme,
  type NativeStackNavigationOptions,
  type Theme as NavigationTheme,
} from 'expo-router';

import { FONT_FACES, type Theme } from './tokens';

/** Maps our tokens onto the React Navigation theme (headers, tab bar, card backgrounds). */
export function toNavigationTheme(theme: Theme): NavigationTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const { colors } = theme;
  const fonts: NavigationTheme['fonts'] = theme.fontsLoaded
    ? {
        regular: { fontFamily: FONT_FACES.medium, fontWeight: 'normal' },
        medium: { fontFamily: FONT_FACES.semibold, fontWeight: 'normal' },
        bold: { fontFamily: FONT_FACES.bold, fontWeight: 'normal' },
        heavy: { fontFamily: FONT_FACES.extrabold, fontWeight: 'normal' },
      }
    : base.fonts;
  return {
    dark: theme.scheme === 'dark',
    colors: {
      primary: colors.primaryText,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
    fonts,
  };
}

/** Themed defaults for every native Stack (root and nested layouts) — headers blend into the screen. */
export function stackScreenOptions(theme: Theme): NativeStackNavigationOptions {
  const { colors } = theme;
  return {
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleStyle: { ...theme.typography.heading, color: colors.text },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.background },
  };
}
