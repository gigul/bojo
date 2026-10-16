import type { DayPart } from './enums';

/** ISO weekdays, 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Local (Europe/Warsaw) hour ranges [from, to) — must match private.day_part_of(). */
export const DAY_PART_HOURS: Readonly<Record<DayPart, readonly [number, number]>> = {
  morning: [6, 12],
  afternoon: [12, 17],
  evening: [17, 23],
};

export type SlotKey = `${Weekday}:${DayPart}`;

export function slotKey(w: Weekday, p: DayPart): SlotKey {
  return `${w}:${p}`;
}

/** Same rule as SQL private.day_part_of: hour < 12 → morning, < 17 → afternoon, else evening. */
export function dayPartOfHour(hour: number): DayPart {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
