// Onboarding (owner d). The root layout redirects signed-in users without `onboarded_at` here;
// the last step calls complete_onboarding → refreshProfile() → router.replace('/(tabs)').
// Each step saves to the server on "Next", so the flow is resumable (index.tsx fast-forwards).
import { Stack } from 'expo-router';
import { useMemo } from 'react';

import { stackScreenOptions, useTheme } from '@/theme';

export default function OnboardingLayout() {
  const theme = useTheme();
  const screenOptions = useMemo(
    () => ({ ...stackScreenOptions(theme), headerShown: false }),
    [theme],
  );
  return <Stack screenOptions={screenOptions} />;
}
