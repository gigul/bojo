// Mirrors every Postgres enum in supabase/migrations (ARCHITECTURE §3.1).
// Values are exactly the SQL labels. No TS `enum` (erasable syntax only).

export const VENUE_KINDS = [
  'pitch',
  'sports_centre',
  'swimming_pool',
  'fitness_station',
  'track',
  'running_route',
  'other',
] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

export const VENUE_SOURCES = ['osm', 'user'] as const;
export type VenueSource = (typeof VENUE_SOURCES)[number];

export const MODERATION_STATUSES = ['active', 'pending', 'hidden'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const VENUE_EDIT_KINDS = ['create', 'update', 'close'] as const;
export type VenueEditKind = (typeof VENUE_EDIT_KINDS)[number];

export const EDIT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type EditStatus = (typeof EDIT_STATUSES)[number];

export const EVENT_STATUSES = ['scheduled', 'cancelled', 'completed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_VISIBILITIES = ['public', 'private'] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const PARTICIPANT_STATUSES = ['invited', 'going', 'left', 'removed'] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const CONVERSATION_KINDS = ['event', 'match'] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export const MESSAGE_KINDS = ['text', 'system', 'event_invite'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const MATCH_STATUSES = ['active', 'unmatched'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** 06–12, 12–17, 17–23 Europe/Warsaw (see availability.ts DAY_PART_HOURS). */
export const DAY_PARTS = ['morning', 'afternoon', 'evening'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

export const USER_GOALS = ['fun', 'fitness', 'competition', 'learning'] as const;
export type UserGoal = (typeof USER_GOALS)[number];

export const REPORT_TARGETS = ['user', 'event', 'venue', 'venue_photo', 'message'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  'spam',
  'abuse',
  'fake',
  'no_show',
  'inappropriate',
  'wrong_info',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'reviewed', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'event_nearby',
  'event_joined',
  'event_cancelled',
  'event_invite',
  'match',
  'message',
  'attendance_reminder',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const PUSH_STATUSES = ['pending', 'sending', 'sent', 'skipped', 'failed'] as const;
export type PushStatus = (typeof PUSH_STATUSES)[number];

export const PUSH_PLATFORMS = ['ios', 'android'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export const RUN_SOURCES = ['manual', 'strava', 'apple_health', 'google_fit'] as const;
export type RunSource = (typeof RUN_SOURCES)[number];

/** Supported UI / push locales (profile_private.locale). */
export const LOCALES = ['ru', 'pl', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
