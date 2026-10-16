// Hand-written, never generated: the client-facing source of truth for RPC results (ARCHITECTURE §9.2).
// Generated types lose nullability on function outputs; assigning generated results to these
// interfaces still type-checks.

import type { Database, Json } from './database.types';
import type {
  ConversationKind,
  DayPart,
  EventStatus,
  EventVisibility,
  MessageKind,
  ModerationStatus,
  NotificationType,
  ParticipantStatus,
  UserGoal,
  VenueKind,
  VenueSource,
} from './enums';
import type { Level } from './levels';
import type { Weekday } from './availability';

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}
export type EventDateRange = 'today' | 'tomorrow' | 'weekend' | 'week' | 'upcoming';
export interface EventsFeedParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sportIds?: string[];
  dateRange?: EventDateRange;
  districtKey?: string;
  venueId?: string;
  onlyWithSpots?: boolean;
  limit?: number;
}

export interface VenueMapRow {
  id: string;
  name: string | null;
  kind: VenueKind;
  lat: number;
  lng: number;
  sport_ids: string[];
  is_lit: boolean | null;
  is_free: boolean | null;
  surface: string | null;
  upcoming_events_count: number;
  /** the venue's district (helps tell unnamed OSM venues apart) */
  district_key: string | null;
  /** public scheduled events starting between now and the end of today (Europe/Warsaw) */
  today_events_count: number;
}
export interface VenueDetailRow {
  id: string;
  name: string | null;
  kind: VenueKind;
  lat: number;
  lng: number;
  district_key: string | null;
  address: string | null;
  surface: string | null;
  is_lit: boolean | null;
  is_free: boolean | null;
  is_indoor: boolean | null;
  access: string | null;
  opening_hours: string | null;
  website: string | null;
  phone: string | null;
  source: VenueSource;
  osm_type: string | null;
  osm_id: number | null;
  status: ModerationStatus;
  is_mock: boolean;
  sport_ids: string[];
  photo_count: number;
  upcoming_events_count: number;
  has_pending_edit_by_me: boolean;
  is_mine: boolean;
  created_at: string;
  updated_at: string;
  /** OSM import facts from osm_tags['bojo:flags']: 'on_school_grounds' | 'customers_only' | 'restricted_access'; [] if none */
  flags: string[];
}
export interface VenuePhotoRow {
  id: string;
  storage_path: string | null;
  external_url: string | null;
  attribution: string | null;
  is_mine: boolean;
  created_at: string;
}
export interface VenueEditProposal {
  name?: string;
  surface?: string;
  is_lit?: boolean;
  is_free?: boolean;
  is_indoor?: boolean;
  opening_hours?: string;
  sport_ids?: string[];
}

/** Up to 4 going participants (organizer first, then by joined_at); blocked users excluded. */
export interface ParticipantPreview {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
}

export interface EventCardRow {
  id: string;
  series_id: string | null;
  sport_id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  spots_total: number;
  spots_taken: number;
  spots_reserved: number;
  spots_left: number;
  level: number | null;
  status: EventStatus;
  visibility: EventVisibility;
  venue_id: string;
  venue_name: string | null;
  venue_kind: VenueKind;
  venue_lat: number;
  venue_lng: number;
  district_key: string | null;
  distance_km: number | null;
  organizer_id: string | null;
  organizer_name: string | null;
  organizer_avatar_path: string | null; // null for anon
  organizer_reliability: number | null;
  organizer_is_verified: boolean | null;
  my_status: ParticipantStatus | null;
  is_organizer: boolean;
  participants_preview: ParticipantPreview[] | null;
} // null for anon
export interface EventDetailRow extends EventCardRow {
  description: string | null;
  cancel_reason: string | null;
  venue_address: string | null;
  series_weekdays: number[] | null;
  conversation_id: string | null;
  can_join: boolean;
  attendance_open: boolean;
  created_at: string;
}
export interface ParticipantRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  is_verified: boolean;
  reliability_score: number | null;
  status: ParticipantStatus;
  is_organizer: boolean;
  level: number | null;
  joined_at: string;
  attended: boolean | null;
}
export interface CreateEventResult {
  event_id: string;
  series_id: string | null;
  conversation_id: string;
}
export interface JoinEventResult {
  spots_taken: number;
  spots_total: number;
  spots_reserved: number;
  conversation_id: string | null;
}
export interface AttendanceMark {
  user_id: string;
  attended: boolean;
}

export interface ConversationListRow {
  conversation_id: string;
  kind: ConversationKind;
  event_id: string | null;
  match_id: string | null;
  title: string | null;
  other_user_id: string | null;
  avatar_path: string | null;
  sport_id: string | null;
  event_starts_at: string | null;
  event_status: EventStatus | null;
  last_message_body: string | null;
  last_message_kind: MessageKind | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  /** payload of the last message: system {type, user_id?}, event_invite {event_id, sport_id, starts_at, venue_name}; null for text/none */
  last_message_payload: Json | null;
  /** excludes kind='system' messages and the caller's own */
  unread_count: number;
  muted: boolean;
}

/** distance_km_approx is one of DISTANCE_BUCKETS (3, 5, 10, 15, 25) measured between ~2 km cells; null when
 *  unknown or not visible. common_slots: max 3 unless matched (person_summary). */
export interface CandidateRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  district_key: string | null;
  goal: UserGoal | null;
  is_verified: boolean;
  reliability_score: number | null;
  sport_ids: string[];
  sport_levels: number[];
  common_sport_ids: string[];
  distance_km_approx: number | null;
  score: number;
  score_sport: number;
  score_level: number;
  score_schedule: number;
  score_distance: number;
  /** overlapping availability as slotKey() values ('2:evening'), sorted; [] if none */
  common_slots: string[];
}
export interface SwipeResult {
  match_id: string | null;
  conversation_id: string | null;
}
export interface ProposeMeetingResult {
  event_id: string;
  conversation_id: string;
}
export interface PersonSummaryRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  district_key: string | null;
  goal: UserGoal | null;
  is_verified: boolean;
  reliability_score: number | null;
  attended_count: number;
  sport_ids: string[];
  sport_levels: number[];
  common_sport_ids: string[];
  distance_km_approx: number | null;
  match_id: string | null;
  conversation_id: string | null;
  is_me: boolean;
  /** overlapping availability as slotKey() values ('2:evening'), sorted; [] if none */
  common_slots: string[];
}
export interface BlockedUserRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  blocked_at: string;
}
export interface HomeLocationResult {
  district_key: string | null;
}
export interface UserSportInput {
  sport_id: string;
  level: Level;
}
export interface AvailabilitySlotInput {
  weekday: Weekday;
  day_part: DayPart;
}
export interface PushClaimRow {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  payload: Json;
  locale: 'ru' | 'pl' | 'en';
  tokens: string[];
}

// table row aliases
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type ProfileRow = TableRow<'profiles'>;
export type MessageRow = TableRow<'messages'>;
export type NotificationRow = TableRow<'notifications'>;
export type ProfilePrivateRow = TableRow<'profile_private'>;
