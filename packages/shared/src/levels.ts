// Skill levels (user_sports.level, events.level). ARCHITECTURE §9.3.
// UI text comes from i18n `vocab:levels.<1..5>` / `vocab:levels.any`; LEVEL_LABELS is the
// reference copy (also used by server-side push templates).

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

/** null = "any level" on events. */
export type EventLevel = Level | null;

export const LEVEL_KEYS = {
  1: 'beginner',
  2: 'amateur',
  3: 'intermediate',
  4: 'advanced',
  5: 'pro',
} as const satisfies Record<Level, string>;
export type LevelKey = (typeof LEVEL_KEYS)[Level];

export const LEVEL_LABELS = {
  ru: {
    1: 'Новичок',
    2: 'Любитель',
    3: 'Средний',
    4: 'Продвинутый',
    5: 'Профи',
    any: 'Любой уровень',
  },
  pl: {
    1: 'Początkujący',
    2: 'Amator',
    3: 'Średni',
    4: 'Zaawansowany',
    5: 'Profesjonalista',
    any: 'Dowolny poziom',
  },
  en: { 1: 'Beginner', 2: 'Amateur', 3: 'Intermediate', 4: 'Advanced', 5: 'Pro', any: 'Any level' },
} as const;

export function isLevel(x: unknown): x is Level {
  return typeof x === 'number' && (LEVELS as readonly number[]).includes(x);
}
