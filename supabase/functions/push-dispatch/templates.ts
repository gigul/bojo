// Localised push texts (ru / pl / en) per notification_type (ARCHITECTURE §6).
// Message bodies are NEVER included in push — only the sender's name.
// Wording avoids grammatical cases/plurals that would need per-word declension.

export type Locale = 'ru' | 'pl' | 'en';
export type NotificationType =
  | 'event_nearby'
  | 'event_joined'
  | 'event_cancelled'
  | 'event_invite'
  | 'match'
  | 'message'
  | 'attendance_reminder';

type Payload = Record<string, unknown>;

const SPORT_NAMES: Record<Locale, Record<string, string>> = {
  ru: {
    football: 'Футбол',
    basketball: 'Баскетбол',
    volleyball: 'Волейбол',
    tennis: 'Теннис',
    padel: 'Падел',
    table_tennis: 'Настольный теннис',
    swimming: 'Плавание',
    workout: 'Воркаут',
    running: 'Бег',
  },
  pl: {
    football: 'Piłka nożna',
    basketball: 'Koszykówka',
    volleyball: 'Siatkówka',
    tennis: 'Tenis',
    padel: 'Padel',
    table_tennis: 'Tenis stołowy',
    swimming: 'Pływanie',
    workout: 'Street workout',
    running: 'Bieganie',
  },
  en: {
    football: 'Football',
    basketball: 'Basketball',
    volleyball: 'Volleyball',
    tennis: 'Tennis',
    padel: 'Padel',
    table_tennis: 'Table tennis',
    swimming: 'Swimming',
    workout: 'Workout',
    running: 'Running',
  },
};

const VENUE_FALLBACK: Record<Locale, string> = {
  ru: 'Площадка',
  pl: 'Obiekt sportowy',
  en: 'Sports venue',
};
const SOMEONE: Record<Locale, string> = { ru: 'Игрок', pl: 'Gracz', en: 'A player' };
const INTL_LOCALE: Record<Locale, string> = { ru: 'ru-RU', pl: 'pl-PL', en: 'en-GB' };

function str(p: Payload, k: string): string | null {
  const v = p[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
function num(p: Payload, k: string): number | null {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function sportName(locale: Locale, sportId: string | null): string {
  if (!sportId) return '';
  return SPORT_NAMES[locale][sportId] ?? sportId;
}

function time(locale: Locale, iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function dateTime(locale: Locale, iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const join = (...parts: (string | null | undefined)[]) =>
  parts.filter((x) => x && x.length).join(' · ');

export interface PushText {
  title: string;
  body: string;
}

export function renderPush(
  type: NotificationType,
  rawLocale: string | null,
  payload: Payload,
): PushText {
  const l: Locale = rawLocale === 'pl' || rawLocale === 'en' ? rawLocale : 'ru';
  const sport = sportName(l, str(payload, 'sport_id'));
  const venue = str(payload, 'venue_name') ?? VENUE_FALLBACK[l];
  const at = str(payload, 'starts_at');
  const spots = num(payload, 'spots_left');

  switch (type) {
    case 'event_nearby':
      return {
        ru: {
          title: `${sport} рядом в ${time(l, at)}`,
          body: join(venue, spots != null ? `свободно мест: ${spots}` : null),
        },
        pl: {
          title: `${sport} w pobliżu o ${time(l, at)}`,
          body: join(venue, spots != null ? `wolne miejsca: ${spots}` : null),
        },
        en: {
          title: `${sport} nearby at ${time(l, at)}`,
          body: join(venue, spots != null ? `spots left: ${spots}` : null),
        },
      }[l];
    case 'event_joined': {
      const who = str(payload, 'user_name') ?? SOMEONE[l];
      return {
        ru: {
          title: `Новый игрок: ${who}`,
          body: join(sport, dateTime(l, at), spots != null ? `свободно мест: ${spots}` : null),
        },
        pl: {
          title: `Nowy gracz: ${who}`,
          body: join(sport, dateTime(l, at), spots != null ? `wolne miejsca: ${spots}` : null),
        },
        en: {
          title: `New player: ${who}`,
          body: join(sport, dateTime(l, at), spots != null ? `spots left: ${spots}` : null),
        },
      }[l];
    }
    case 'event_cancelled':
      return {
        ru: { title: 'Событие отменено', body: join(sport, dateTime(l, at), venue) },
        pl: { title: 'Wydarzenie odwołane', body: join(sport, dateTime(l, at), venue) },
        en: { title: 'Event cancelled', body: join(sport, dateTime(l, at), venue) },
      }[l];
    case 'event_invite': {
      const from = str(payload, 'from_name') ?? SOMEONE[l];
      return {
        ru: { title: `${from} приглашает вас`, body: join(sport, dateTime(l, at), venue) },
        pl: { title: `${from} zaprasza Cię`, body: join(sport, dateTime(l, at), venue) },
        en: { title: `${from} invited you`, body: join(sport, dateTime(l, at), venue) },
      }[l];
    }
    case 'match': {
      const other = str(payload, 'other_name') ?? SOMEONE[l];
      return {
        ru: { title: 'Это мэтч!', body: `Вы и ${other} хотите играть вместе. Напишите первым!` },
        pl: {
          title: 'Mamy dopasowanie!',
          body: `Ty i ${other} chcecie grać razem. Napisz pierwszy!`,
        },
        en: { title: "It's a match!", body: `You and ${other} want to play together. Say hi!` },
      }[l];
    }
    case 'message': {
      const sender = str(payload, 'sender_name') ?? SOMEONE[l];
      return {
        ru: { title: sender, body: 'Новое сообщение' },
        pl: { title: sender, body: 'Nowa wiadomość' },
        en: { title: sender, body: 'New message' },
      }[l];
    }
    case 'attendance_reminder':
      return {
        ru: {
          title: 'Как прошла игра?',
          body: join('Отметьте, кто пришёл', sport, dateTime(l, at)),
        },
        pl: {
          title: 'Jak poszła gra?',
          body: join('Zaznacz, kto przyszedł', sport, dateTime(l, at)),
        },
        en: { title: 'How did it go?', body: join('Mark who showed up', sport, dateTime(l, at)) },
      }[l];
  }
}
