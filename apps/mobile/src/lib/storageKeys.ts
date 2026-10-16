/** AsyncStorage keys (§2.6). Never store secrets or precise locations here. */
export const STORAGE_KEYS = {
  theme: 'bojo.theme',
  language: 'bojo.language',
  pushToken: 'bojo.pushToken',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
