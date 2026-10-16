// The ONE way to name a venue in the UI. ~94 % of OSM venues have no name, so an unnamed pitch is
// called by its sport ("Теннисный корт" / "Kort tenisowy") and, where a line has to tell venues
// apart, gets its district ("Kort tenisowy · Śródmieście"). Every screen (map, sheet list, venue
// page, event cards, event page, create flow, chats, notifications) goes through here, so one
// venue never has two different names.
import { isDistrictKey, isSportId, type VenueKind } from '@bojo/shared';

import i18n from '@/i18n';

import type { AnyT } from './format';

export interface VenueNameSource {
  /** OSM / user-given name (may be null or blank). */
  name: string | null | undefined;
  kind: VenueKind;
  /** The venue's sports — or `[event.sport_id]` for an event row. Picks the sport-based name. */
  sportIds?: readonly (string | null | undefined)[] | null;
  /** District key: the differentiator for unnamed venues. */
  districtKey?: string | null;
}

export interface VenueNameOptions {
  /**
   * Append " · <district>" to unnamed venues (default true). Pass false where the district is
   * already shown right next to the name (venue page subtitle, event page venue row).
   */
  district?: boolean;
}

/** "Теннисный корт", "Бассейн", or the venue's own name. */
function baseName(v: VenueNameSource): string {
  const own = v.name?.trim();
  if (own) return own;
  if (v.kind === 'pitch') {
    const sports = (v.sportIds ?? []).filter(isSportId);
    const [first] = sports;
    if (sports.length === 1 && first) return i18n.t(`vocab:venueNames.${first}`);
    if (sports.length > 1) return i18n.t('vocab:venueNames.multi');
  }
  return i18n.t(`vocab:venueKinds.${v.kind}`);
}

/**
 * Display name of a venue. Named venues keep their name; unnamed ones get a sport-based name plus
 * (by default) the district: "Kort tenisowy · Śródmieście".
 * `t` is only a memo key for the React Compiler (see AnyT in ./format).
 */
export function venueName(v: VenueNameSource, _t: AnyT, opts: VenueNameOptions = {}): string {
  const base = baseName(v);
  if (v.name?.trim() || opts.district === false) return base;
  const district = isDistrictKey(v.districtKey) ? i18n.t(`vocab:districts.${v.districtKey}`) : null;
  return district ? `${base} · ${district}` : base;
}
