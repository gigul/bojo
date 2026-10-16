// Static imports of every namespace for every language (ARCHITECTURE §2.5) so Metro bundles them and
// TypeScript can type `t()` keys from the Russian source of truth.
// To add a namespace: create locales/{ru,pl,en}/<ns>.json, import it here and add it to NAMESPACES.

import ruCommon from './locales/ru/common.json';
import ruAuth from './locales/ru/auth.json';
import ruErrors from './locales/ru/errors.json';
import ruVocab from './locales/ru/vocab.json';
import ruMap from './locales/ru/map.json';
import ruVenues from './locales/ru/venues.json';
import ruEvents from './locales/ru/events.json';
import ruChat from './locales/ru/chat.json';
import ruNotifications from './locales/ru/notifications.json';
import ruOnboarding from './locales/ru/onboarding.json';
import ruProfile from './locales/ru/profile.json';
import ruPeople from './locales/ru/people.json';
import ruRuns from './locales/ru/runs.json';
import ruSafety from './locales/ru/safety.json';
import ruSettings from './locales/ru/settings.json';
import plCommon from './locales/pl/common.json';
import plAuth from './locales/pl/auth.json';
import plErrors from './locales/pl/errors.json';
import plVocab from './locales/pl/vocab.json';
import plMap from './locales/pl/map.json';
import plVenues from './locales/pl/venues.json';
import plEvents from './locales/pl/events.json';
import plChat from './locales/pl/chat.json';
import plNotifications from './locales/pl/notifications.json';
import plOnboarding from './locales/pl/onboarding.json';
import plProfile from './locales/pl/profile.json';
import plPeople from './locales/pl/people.json';
import plRuns from './locales/pl/runs.json';
import plSafety from './locales/pl/safety.json';
import plSettings from './locales/pl/settings.json';
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enErrors from './locales/en/errors.json';
import enVocab from './locales/en/vocab.json';
import enMap from './locales/en/map.json';
import enVenues from './locales/en/venues.json';
import enEvents from './locales/en/events.json';
import enChat from './locales/en/chat.json';
import enNotifications from './locales/en/notifications.json';
import enOnboarding from './locales/en/onboarding.json';
import enProfile from './locales/en/profile.json';
import enPeople from './locales/en/people.json';
import enRuns from './locales/en/runs.json';
import enSafety from './locales/en/safety.json';
import enSettings from './locales/en/settings.json';

export const NAMESPACES = [
  'common',
  'auth',
  'errors',
  'vocab',
  'map',
  'venues',
  'events',
  'chat',
  'notifications',
  'onboarding',
  'profile',
  'people',
  'runs',
  'safety',
  'settings',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NS = 'common' satisfies Namespace;

const ru = {
  common: ruCommon,
  auth: ruAuth,
  errors: ruErrors,
  vocab: ruVocab,
  map: ruMap,
  venues: ruVenues,
  events: ruEvents,
  chat: ruChat,
  notifications: ruNotifications,
  onboarding: ruOnboarding,
  profile: ruProfile,
  people: ruPeople,
  runs: ruRuns,
  safety: ruSafety,
  settings: ruSettings,
};

const pl = {
  common: plCommon,
  auth: plAuth,
  errors: plErrors,
  vocab: plVocab,
  map: plMap,
  venues: plVenues,
  events: plEvents,
  chat: plChat,
  notifications: plNotifications,
  onboarding: plOnboarding,
  profile: plProfile,
  people: plPeople,
  runs: plRuns,
  safety: plSafety,
  settings: plSettings,
};

const en = {
  common: enCommon,
  auth: enAuth,
  errors: enErrors,
  vocab: enVocab,
  map: enMap,
  venues: enVenues,
  events: enEvents,
  chat: enChat,
  notifications: enNotifications,
  onboarding: enOnboarding,
  profile: enProfile,
  people: enPeople,
  runs: enRuns,
  safety: enSafety,
  settings: enSettings,
};

/** Russian is the source of truth for keys (and for `t()` typing). */
export type Resources = typeof ru;

export const resources = { ru, pl, en } satisfies Record<string, Record<Namespace, object>>;
