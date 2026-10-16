// Notification payload shapes (ARCHITECTURE §9.2). Stored in public.notifications.payload and
// forwarded as push `data`. Every payload contains `url` (an in-app route, see §2.2 deep links).

import type { ConversationKind, NotificationType, VenueKind } from './enums';

interface WithUrl {
  /** In-app route: /event/<id>, /event/<id>/attendance, /chat/<conversationId>, /person/<id>, /notifications */
  url: string;
}

export interface EventNearbyPayload extends WithUrl {
  event_id: string;
  sport_id: string;
  venue_name: string | null;
  venue_kind: VenueKind;
  starts_at: string;
  spots_left: number;
}

export interface EventJoinedPayload extends WithUrl {
  event_id: string;
  sport_id: string;
  starts_at: string;
  user_id: string;
  user_name: string;
  spots_left: number;
}

export interface EventCancelledPayload extends WithUrl {
  event_id: string;
  sport_id: string;
  starts_at: string;
  venue_name: string | null;
}

export interface EventInvitePayload extends WithUrl {
  event_id: string;
  sport_id: string;
  starts_at: string;
  venue_name: string | null;
  from_user_id: string;
  from_name: string;
  conversation_id: string;
}

export interface MatchPayload extends WithUrl {
  match_id: string;
  conversation_id: string;
  other_user_id: string;
  other_name: string;
}

export interface MessagePayload extends WithUrl {
  conversation_id: string;
  conversation_kind: ConversationKind;
  event_id: string | null;
  sender_id: string;
  sender_name: string;
}

export interface AttendanceReminderPayload extends WithUrl {
  event_id: string;
  sport_id: string;
  starts_at: string;
}

export interface NotificationPayloads {
  event_nearby: EventNearbyPayload;
  event_joined: EventJoinedPayload;
  event_cancelled: EventCancelledPayload;
  event_invite: EventInvitePayload;
  match: MatchPayload;
  message: MessagePayload;
  attendance_reminder: AttendanceReminderPayload;
}

export type NotificationPayload<T extends NotificationType = NotificationType> =
  NotificationPayloads[T];

/** Discriminated union convenient for switch(n.type) in the inbox UI. */
export type TypedNotification = {
  [T in NotificationType]: { type: T; payload: NotificationPayloads[T] };
}[NotificationType];

/** Push `data` attached by push-dispatch. */
export interface PushData {
  url: string;
  notification_id: string;
  type: NotificationType;
}
