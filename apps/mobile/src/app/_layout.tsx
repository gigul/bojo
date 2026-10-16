// i18n must initialise before any screen renders (side-effect import, Intl.PluralRules polyfill first).
import i18n, { loadSavedLanguage } from '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import {
  router,
  Stack,
  ThemeProvider as NavigationThemeProvider,
  useRootNavigationState,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { headerBackOptions, Text, ToastProvider } from '@/components/ui';
import { NotificationsBridge } from '@/features/notifications';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  stackScreenOptions,
  ThemeProvider,
  toNavigationTheme,
  useTheme,
  useThemeReady,
} from '@/theme';

// Keep the native splash until fonts, saved theme and saved language are ready (never forever:
// fonts time out in ThemeProvider, storage reads always settle).
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Deep links (push taps, shared URLs) open on top of the tabs, so every screen has a way back.
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <ToastProvider>
                  <RootNavigator />
                </ToastProvider>
              </AuthProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const themeReady = useThemeReady();
  const { t } = useTranslation('common');
  const [languageReady, setLanguageReady] = useState(false);
  const ready = themeReady && languageReady;
  const navigationTheme = useMemo(() => toNavigationTheme(theme), [theme]);
  const screenOptions = useMemo(
    () => ({ ...stackScreenOptions(theme), ...headerBackOptions(t('actions.back')) }),
    [theme, t],
  );

  useEffect(() => {
    loadSavedLanguage().finally(() => setLanguageReady(true));
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return <View style={[styles.flex, { backgroundColor: theme.colors.background }]} />;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('appName') }} />
        <Stack.Screen
          name="sign-in"
          options={{ presentation: 'modal', headerShown: false, title: t('screens.signIn') }}
        />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="event/create" options={{ headerShown: false }} />
        <Stack.Screen name="dev/ui" options={{ title: t('screens.devUi') }} />
        <Stack.Screen name="+not-found" options={{ title: t('screens.notFound') }} />
      </Stack>
      <OnboardingGate />
      <NotificationsBridge />
      {__DEV__ && !isSupabaseConfigured ? <DevConfigBanner /> : null}
    </NavigationThemeProvider>
  );
}

/**
 * §2.2 auth gating: a signed-in user without `onboarded_at` is sent to /onboarding from anywhere
 * except the sign-in modal; an anonymous user can't stay inside /onboarding.
 * (A root layout can't render <Redirect> before its navigator mounts, so this uses router.replace.)
 */
function OnboardingGate() {
  const { session, profile, isLoading } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const first = segments[0];
  const inOnboarding = first === 'onboarding';
  const inSignIn = first === 'sign-in';
  const needsOnboarding = session !== null && profile !== null && profile.onboarded_at === null;

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;
    if (needsOnboarding && !inOnboarding && !inSignIn) {
      router.replace('/onboarding');
    } else if (session === null && inOnboarding) {
      router.replace('/');
    }
  }, [navigationState?.key, isLoading, needsOnboarding, inOnboarding, inSignIn, session]);

  return null;
}

/** Dev-only hint when apps/mobile/.env is missing (A12). Never blocks touches. */
function DevConfigBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  return (
    <View
      pointerEvents="none"
      style={[styles.banner, { bottom: insets.bottom + 72, backgroundColor: theme.colors.warning }]}
    >
      <Text variant="caption" color="textInverse" align="center">
        {t('dev.supabaseMissing')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    opacity: 0.92,
  },
});
