import { DAY_PARTS, type DayPart, type Weekday } from '@bojo/shared';

import i18n from '@/i18n';
import type { AnyT } from '@/lib/format';

import { parseSlotKey } from './api';

const WORKDAYS = '1,2,3,4,5';
const WEEKEND = '6,7';
const EVERY_DAY = '1,2,3,4,5,6,7';

/**
 * Compact, human summary of availability slot keys ('2:evening'):
 *   {2:evening, 4:evening}                 → "вт, чт вечером"
 *   {1..5:evening}                         → "по будням вечером"
 *   {6,7: all parts} + {2:morning}         → "вт утром · по выходным весь день"
 * Weekdays that share exactly the same day parts are grouped; groups are ordered by their first
 * weekday and joined with " · ".
 * `t` is only a re-render dependency (see AnyT); lookups use the shared instance.
 */
export function summarizeSlots(slotKeys: readonly string[], _t: AnyT): string {
  const partsByDay = new Map<Weekday, Set<DayPart>>();
  for (const key of slotKeys) {
    const slot = parseSlotKey(key);
    if (!slot) continue;
    const parts = partsByDay.get(slot.weekday) ?? new Set<DayPart>();
    parts.add(slot.day_part);
    partsByDay.set(slot.weekday, parts);
  }
  // Group weekdays with an identical set of day parts.
  const groups = new Map<string, { parts: DayPart[]; days: Weekday[] }>();
  for (const day of [...partsByDay.keys()].sort((a, b) => a - b)) {
    const parts = DAY_PARTS.filter((p) => partsByDay.get(day)?.has(p));
    const signature = parts.join(',');
    const group = groups.get(signature) ?? { parts, days: [] };
    group.days.push(day);
    groups.set(signature, group);
  }

  const t = i18n.t.bind(i18n);
  const phrases: string[] = [];
  for (const { parts, days } of groups.values()) {
    const partsText =
      parts.length === DAY_PARTS.length
        ? t('profile:slots.allDay')
        : parts.map((p) => t(`profile:slots.part.${p}`)).join(t('profile:slots.partsJoin'));
    const signature = days.join(',');
    if (signature === EVERY_DAY) {
      phrases.push(t('profile:slots.everyDay', { parts: partsText }));
      continue;
    }
    let daysText: string;
    if (signature === WORKDAYS) daysText = t('profile:slots.workdays');
    else if (signature === WEEKEND) daysText = t('profile:slots.weekend');
    else daysText = days.map((d) => t(`profile:slots.dayShort.${d}`)).join(', ');
    phrases.push(t('profile:slots.group', { days: daysText, parts: partsText }));
  }
  return phrases.join(' · ');
}
