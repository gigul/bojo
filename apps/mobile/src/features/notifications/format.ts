// Type-specific texts for in-app notifications (inbox rows + Realtime toasts). Payload shapes:
// ARCHITECTURE §9.2 NotificationPayloads. Push texts are rendered server-side (push-dispatch).
import { VENUE_KINDS, type NotificationType, type VenueKind } from '@bojo/shared';

import type { IconName } from '@/icons';
import i18n, { type Language } from '@/i18n';
import { formatEventWhen } from '@/lib/datetime';
import type { AnyT } from '@/lib/format';
import { venueName as formatVenueName } from '@/lib/venueName';

import { sportNameFor } from './sport';
import { isSafeInternalUrl } from './safeUrl';

export interface NotificationContent {
  title: string;
  body: string;
  icon: IconName;
}

const ICONS: Record<NotificationType, IconName> = {
  event_nearby: 'map-pin',
  event_joined: 'user-plus',
  event_cancelled: 'x-circle',
  event_invite: 'calendar',
  match: 'heart',
  message: 'message-circle',
  attendance_reminder: 'check-square',
};

function str(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  return typeof v === 'string' ? v : '';
}

function num(p: Record<string, unknown>, key: string): number {
  const v = p[key];
  return typeof v === 'number' ? v : 0;
}

/** Localised title/body for one notification. */
export function notificationContent(
  type: NotificationType,
  payload: Record<string, unknown>,
  _t: AnyT,
  language: Language,
): NotificationContent {
  const sport = sportNameFor(str(payload, 'sport_id'));
  const startsAt = str(payload, 'starts_at');
  const when = startsAt ? formatEventWhen(startsAt, language) : '';
  const venueName = str(payload, 'venue_name') || null;
  // Same naming as the cards: an unnamed pitch is called by its sport ("Теннисный корт").
  const kindRaw = str(payload, 'venue_kind');
  const kind: VenueKind = (VENUE_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as VenueKind)
    : 'pitch';
  const venue = formatVenueName(
    {
      name: venueName,
      kind,
      sportIds: [str(payload, 'sport_id')],
      districtKey: str(payload, 'district_key') || null,
    },
    _t,
  );
  const icon = ICONS[type] ?? 'bell';
  const lng = language;

  switch (type) {
    case 'event_nearby':
      return {
        icon,
        title: i18n.t('notifications:types.event_nearby.title', { lng, sport, when }),
        body: i18n.t('notifications:types.event_nearby.body', {
          lng,
          venue,
          count: num(payload, 'spots_left'),
        }),
      };
    case 'event_joined':
      return {
        icon,
        title: i18n.t('notifications:types.event_joined.title', {
          lng,
          name: str(payload, 'user_name'),
          sport,
        }),
        body:
          num(payload, 'spots_left') > 0
            ? i18n.t('notifications:types.event_joined.body', {
                lng,
                when,
                count: num(payload, 'spots_left'),
              })
            : i18n.t('notifications:types.event_joined.bodyFull', { lng, when }),
      };
    case 'event_cancelled':
      return {
        icon,
        title: i18n.t('notifications:types.event_cancelled.title', { lng, sport, when }),
        body: i18n.t('notifications:types.event_cancelled.body', { lng, venue }),
      };
    case 'event_invite':
      return {
        icon,
        title: i18n.t('notifications:types.event_invite.title', {
          lng,
          name: str(payload, 'from_name'),
          sport,
        }),
        body: i18n.t('notifications:types.event_invite.body', { lng, when, venue }),
      };
    case 'match':
      return {
        icon,
        title: i18n.t('notifications:types.match.title', {
          lng,
          name: str(payload, 'other_name'),
        }),
        body: i18n.t('notifications:types.match.body', { lng }),
      };
    case 'message':
      return {
        icon,
        title: i18n.t('notifications:types.message.title', {
          lng,
          name: str(payload, 'sender_name'),
        }),
        body:
          payload.conversation_kind === 'event'
            ? i18n.t('notifications:types.message.bodyEvent', { lng })
            : i18n.t('notifications:types.message.body', { lng }),
      };
    case 'attendance_reminder':
      return {
        icon,
        title: i18n.t('notifications:types.attendance_reminder.title', { lng }),
        body: i18n.t('notifications:types.attendance_reminder.body', { lng, sport, when }),
      };
    default:
      return { icon: 'bell', title: i18n.t('notifications:types.fallback', { lng }), body: '' };
  }
}

/** In-app route stored in every payload (`url`), or the inbox. */
export function notificationUrl(payload: Record<string, unknown>): string {
  const url = str(payload, 'url');
  return isSafeInternalUrl(url) ? url : '/notifications';
}
