import type { ConfigContext, ExpoConfig } from 'expo/config';

// Single source of app config (no app.json). Env is read from apps/mobile/.env (see .env.example).
// Brand colours mirror src/theme/tokens.ts (DESIGN.md): background light #F7F7F4 / dark #0E0F0D,
// accent lime #C8F031.

const LIGHT_BG = '#F7F7F4';
const DARK_BG = '#0E0F0D';
const ACCENT = '#C8F031';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Bojo',
  slug: 'bojo',
  scheme: 'bojo',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  backgroundColor: LIGHT_BG,
  locales: {
    ru: './native-locales/ru.json',
    pl: './native-locales/pl.json',
    en: './native-locales/en.json',
  },
  ios: {
    bundleIdentifier: 'app.bojo.mobile',
    supportsTablet: true,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    package: 'app.bojo.mobile',
    adaptiveIcon: {
      backgroundColor: ACCENT,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
    name: 'Bojo',
    shortName: 'Bojo',
    themeColor: LIGHT_BG,
    backgroundColor: LIGHT_BG,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: LIGHT_BG,
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
        dark: {
          backgroundColor: DARK_BG,
          image: './assets/images/splash-icon-dark.png',
        },
      },
    ],
    'expo-localization',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Bojo uses your location to show sports venues and games near you. It is never shared with other users.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Bojo needs access to your photos so you can add a profile picture or a photo of a venue.',
        cameraPermission: 'Bojo uses the camera so you can take a photo of a venue.',
        microphonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        color: ACCENT,
      },
    ],
    [
      'react-native-maps',
      {
        // Only needed for standalone/dev builds (Google Maps on Android). Expo Go needs no key.
        // An empty value makes the plugin remove the manifest key, which is what we want locally.
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        // Only used if PROVIDER_GOOGLE is ever used on iOS (Apple Maps needs no key).
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
      },
    ],
    'expo-font',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...config.extra,
    // Required by Notifications.getExpoPushTokenAsync({ projectId }). Without it remote push is disabled.
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined },
  },
});
