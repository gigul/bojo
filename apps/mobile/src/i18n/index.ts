// Must stay the first import: Intl.PluralRules polyfill (plural suffixes _one/_few/_many/_other).
import 'intl-pluralrules';

import { LOCALES, type Locale } from '@bojo/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import { STORAGE_KEYS } from '@/lib/storageKeys';
import { supabase } from '@/lib/supabase';

import { DEFAULT_NS, NAMESPACES, resources } from './resources';

export type Language = Locale;
export const SUPPORTED_LANGUAGES: readonly Language[] = LOCALES;
export const FALLBACK_LANGUAGE: Language = 'ru';

export function isLanguage(v: unknown): v is Language {
  return typeof v === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}

/** Device locale if supported, else Russian. */
export function detectDeviceLanguage(): Language {
  try {
    for (const locale of getLocales()) {
      const code = locale.languageCode?.toLowerCase();
      if (isLanguage(code)) return code;
    }
  } catch {
    // expo-localization unavailable (tests / exotic platforms) → fallback
  }
  return FALLBACK_LANGUAGE;
}

/** The app-wide i18next instance (also registered with react-i18next for useTranslation). */
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  ns: [...NAMESPACES],
  defaultNS: DEFAULT_NS,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
  react: { useSuspense: false },
});

/** Currently active language. */
export function getLanguage(): Language {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  return isLanguage(lng) ? lng : FALLBACK_LANGUAGE;
}

/** Reactive current language (re-renders on change). */
export function useLanguage(): Language {
  const { i18n: instance } = useTranslation();
  const lng = instance.resolvedLanguage ?? instance.language;
  return isLanguage(lng) ? lng : FALLBACK_LANGUAGE;
}

/**
 * Applies the saved language (AsyncStorage `bojo.language`) if any. Called once at startup;
 * the splash screen waits for it so the first frame is already in the right language.
 */
export async function loadSavedLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.language);
    if (isLanguage(saved) && saved !== getLanguage()) await i18n.changeLanguage(saved);
  } catch {
    // storage unavailable → keep the device language
  }
}

/** Writes the active language to `profile_private.locale` (server-side push texts use it). */
export async function syncProfileLocale(
  userId: string,
  lng: Language = getLanguage(),
): Promise<void> {
  const { error } = await supabase
    .from('profile_private')
    .update({ locale: lng })
    .eq('user_id', userId);
  if (error && __DEV__) console.warn('[i18n] could not sync profile_private.locale', error.message);
}

/** Switches the UI language, persists it and, when signed in, updates `profile_private.locale`. */
export async function setLanguage(lng: Language): Promise<void> {
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(STORAGE_KEYS.language, lng).catch(() => undefined);
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (userId) await syncProfileLocale(userId, lng);
}

export { DEFAULT_NS, NAMESPACES, type Namespace } from './resources';
export default i18n;
