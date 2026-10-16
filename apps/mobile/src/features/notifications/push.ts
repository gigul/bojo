// Native push (ARCHITECTURE §6). Web uses push.web.ts, so `expo-notifications` never enters the web
// bundle (A8). The module is imported lazily, only after every guard has passed:
// web / Expo Go on Android / not a physical device / no EAS projectId / permission denied → skip silently.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { STORAGE_KEYS } from '@/lib/storageKeys';
import { supabase } from '@/lib/supabase';

import { isSafeInternalUrl } from './safeUrl';

type Notifications = typeof NotificationsModule;

function easProjectId(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined)
    ?.eas?.projectId;
  const id =
    typeof fromExtra === 'string' && fromExtra ? fromExtra : Constants.easConfig?.projectId;
  return id || undefined;
}

/** True when remote push can work in this runtime at all. */
function pushSupported(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  if (
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return false; // Expo Go on Android has no remote push (SDK 53+)
  }
  if (!Device.isDevice) return false;
  return Boolean(easProjectId());
}

let modulePromise: Promise<Notifications> | null = null;
function loadNotifications(): Promise<Notifications> {
  modulePromise ??= import('expo-notifications');
  return modulePromise;
}

/**
 * Registers this device for push and stores the token server-side (`register_push_token`) and in
 * AsyncStorage (`bojo.pushToken`, used by sign-out). Returns the token or null when skipped.
 */
export async function registerForPush(opts: { channelName: string }): Promise<string | null> {
  if (!pushSupported()) return null;
  try {
    const N = await loadNotifications();
    if (Platform.OS === 'android') {
      // The channel must exist before the permission prompt on Android 13+.
      await N.setNotificationChannelAsync('default', {
        name: opts.channelName,
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    const current = await N.getPermissionsAsync();
    let granted = current.granted || current.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
    if (!granted && current.canAskAgain) {
      const asked = await N.requestPermissionsAsync();
      granted = asked.granted || asked.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
    }
    if (!granted) return null;
    const projectId = easProjectId();
    if (!projectId) return null;
    const { data: token } = await N.getExpoPushTokenAsync({ projectId });
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: platform,
    });
    if (error) return null;
    await AsyncStorage.setItem(STORAGE_KEYS.pushToken, token);
    return token;
  } catch {
    return null; // never surface push problems to the user
  }
}

const handledResponses = new Set<string>();

/**
 * Notification taps → `onUrl(data.url)` (also the tap that cold-started the app). Foreground
 * notifications are not shown as system banners: the in-app Realtime toast covers them.
 */
export async function listenForPushTaps(onUrl: (url: string) => void): Promise<() => void> {
  if (!pushSupported()) return () => undefined;
  try {
    const N = await loadNotifications();
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const handle = (response: NotificationsModule.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledResponses.has(id)) return;
      handledResponses.add(id);
      const url = (response.notification.request.content.data as { url?: unknown } | null)?.url;
      if (isSafeInternalUrl(url)) onUrl(url); // same check as the inbox: no //host or absolute URLs
    };
    handle(await N.getLastNotificationResponseAsync());
    const sub = N.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}
