import { TIMEZONE, type Weekday } from '@bojo/shared';
import { TZDate } from '@date-fns/tz';
import { format, type Locale as DateFnsLocale } from 'date-fns';
import { enGB, pl, ru } from 'date-fns/locale';

import i18n, { getLanguage, type Language } from '@/i18n';

/** Business calendar timezone (D15). All "today/tomorrow/weekday" logic uses Warsaw time. */
export const TZ = TIMEZONE;

const DATE_FNS_LOCALES: Record<Language, DateFnsLocale> = { ru, pl, en: enGB };
/** Short day + date, e.g. ru "Сб, 12 окт", pl "Sob, 12 paź", en "Sat 12 Oct". */
const DAY_PATTERN: Record<Language, string> = {
  ru: 'EEEEEE, d MMM',
  pl: 'EEEEEE, d MMM',
  en: 'EEE d MMM',
};

type DateInput = string | number | Date;

// NOTE for components: pass `useLanguage()` as `locale`. The React Compiler memoises calls by their
// arguments, so a helper that silently read the global language would not re-render on a switch.

/** A Date pinned to Europe/Warsaw (getHours() etc. return Warsaw wall-clock values). */
export function toWarsaw(input: DateInput): TZDate {
  if (typeof input === 'string') return new TZDate(input, TZ);
  return new TZDate(input instanceof Date ? input.getTime() : input, TZ);
}

export function warsawNow(): TZDate {
  return TZDate.tz(TZ);
}

/**
 * UTC ISO string for "today in Warsaw + dayOffset days, at hh:mm Warsaw time" — the way the
 * create-event flow builds `p_starts_at`. DST-safe.
 */
export function warsawDateTimeISO(dayOffset: number, hh: number, mm: number): string {
  const now = warsawNow();
  const local = new TZDate(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hh,
    mm,
    0,
    0,
    TZ,
  );
  return new Date(local.getTime()).toISOString();
}

/** Calendar-day difference in Warsaw: 0 = today, 1 = tomorrow, -1 = yesterday. */
export function warsawDayDiff(input: DateInput, now: DateInput = Date.now()): number {
  const a = toWarsaw(input);
  const b = toWarsaw(now);
  const dayA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const dayB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((dayA - dayB) / 86_400_000);
}

/** ISO weekday (1 = Mon … 7 = Sun) in Warsaw. */
export function warsawWeekday(input: DateInput): Weekday {
  const day = toWarsaw(input).getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

function tidy(text: string): string {
  // date-fns ru month abbreviations end with "." ("окт.") — drop it; capitalise the weekday.
  const noDots = text.replace(/\./g, '');
  return noDots.charAt(0).toUpperCase() + noDots.slice(1);
}

/** "18:00" (24 h, Warsaw). */
export function formatTime(input: DateInput, locale: Language = getLanguage()): string {
  return format(toWarsaw(input), 'HH:mm', { locale: DATE_FNS_LOCALES[locale] });
}

/** "Сб, 12 окт" / "Sob, 12 paź" / "Sat 12 Oct" (Warsaw). */
export function formatDate(input: DateInput, locale: Language): string {
  return tidy(format(toWarsaw(input), DAY_PATTERN[locale], { locale: DATE_FNS_LOCALES[locale] }));
}

/** "Сегодня" / "Завтра" / "Вчера" or the short date. */
export function formatDayLabel(input: DateInput, locale: Language): string {
  const diff = warsawDayDiff(input);
  if (diff === 0) return i18n.t('common:time.today', { lng: locale });
  if (diff === 1) return i18n.t('common:time.tomorrow', { lng: locale });
  if (diff === -1) return i18n.t('common:time.yesterday', { lng: locale });
  return formatDate(input, locale);
}

/** "Сегодня 18:00" / "Завтра 10:00" / "Сб, 12 окт, 10:00". */
export function formatEventWhen(input: DateInput, locale: Language): string {
  const diff = warsawDayDiff(input);
  const time = formatTime(input, locale);
  if (diff >= -1 && diff <= 1) return `${formatDayLabel(input, locale)} ${time}`;
  return `${formatDate(input, locale)}, ${time}`;
}

/**
 * Compact "when" for one-line titles: "Сегодня 18:00", "Пт 19:00" (this week), else
 * "Сб, 24 окт, 10:00".
 */
export function formatEventWhenShort(input: DateInput, locale: Language): string {
  const diff = warsawDayDiff(input);
  const time = formatTime(input, locale);
  if (diff >= -1 && diff <= 1) return `${formatDayLabel(input, locale)} ${time}`;
  if (diff > 1 && diff < 7) {
    const day = tidy(format(toWarsaw(input), 'EEEEEE', { locale: DATE_FNS_LOCALES[locale] }));
    return `${day} ${time}`;
  }
  return `${formatDate(input, locale)}, ${time}`;
}

/** "18:00–19:30". */
export function formatTimeRange(
  start: DateInput,
  end: DateInput,
  locale: Language = getLanguage(),
): string {
  return `${formatTime(start, locale)}–${formatTime(end, locale)}`;
}
