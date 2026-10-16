import { router, type NativeStackNavigationOptions } from 'expo-router';
import { Platform } from 'react-native';

import { IconButton } from './IconButton';

/** Header back button: 44 pt target, localised label (web; native stacks draw their own). */
export function HeaderBackButton({ label, tintColor }: { label: string; tintColor?: string }) {
  return (
    <IconButton
      icon="arrow-left"
      onPress={() => router.back()}
      accessibilityLabel={label}
      color={tintColor}
      style={{ marginLeft: -6 }}
    />
  );
}

/**
 * Stack options that give every pushed screen a localised back button. Native: the system button
 * keeps its gestures and size; `headerBackTitle` makes VoiceOver say "Назад" instead of the previous
 * screen's title (the label itself stays hidden by `headerBackButtonDisplayMode: 'minimal'`).
 * Web: the default button is a 30 px link named "<previous title>, back" — replaced by ours.
 */
export function headerBackOptions(label: string): NativeStackNavigationOptions {
  if (Platform.OS !== 'web') return { headerBackTitle: label };
  return {
    headerBackTitle: label,
    headerLeft: ({ canGoBack, tintColor }) =>
      canGoBack ? (
        <HeaderBackButton
          label={label}
          tintColor={typeof tintColor === 'string' ? tintColor : undefined}
        />
      ) : null,
  };
}
