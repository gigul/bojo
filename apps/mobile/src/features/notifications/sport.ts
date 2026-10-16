import { isSportId } from '@bojo/shared';

import i18n from '@/i18n';

/** Localised sport name from a payload `sport_id` ('' when missing). */
export function sportNameFor(sportId: string): string {
  if (!sportId) return '';
  return isSportId(sportId) ? i18n.t(`vocab:sports.${sportId}`) : sportId;
}
