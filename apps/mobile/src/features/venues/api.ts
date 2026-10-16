// React Query hooks for venues (ARCHITECTURE §5.1). `useVenuesInBbox` is cross-feature API (§2.4).
import {
  BUCKETS,
  venuePhotoObjectPath,
  type BBox,
  type Json,
  type VenueDetailRow,
  type VenueEditProposal,
  type VenueKind,
  type VenueMapRow,
  type VenuePhotoRow,
} from '@bojo/shared';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/queryKeys';
import { uploadImage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import { snapBBox, VENUES_BBOX_LIMIT } from './model';

/** Normalises a sport filter for the query key: sorted, de-duplicated, null when empty. */
function normaliseSports(sportIds?: readonly string[] | null): string[] | null {
  if (!sportIds || sportIds.length === 0) return null;
  return [...new Set(sportIds)].sort();
}

/**
 * Venues in the visible map area (`venues_in_bbox`, anon-callable). The bbox is snapped outward to a
 * coarse grid so small pans reuse the cached result; previous data stays on screen while the next
 * area loads. A result of `VENUES_BBOX_LIMIT` rows means it was truncated (`isVenuesTruncated`).
 */
export function useVenuesInBbox(
  bbox: BBox | null,
  sportIds?: string[] | null,
): UseQueryResult<VenueMapRow[]> {
  const snapped = useMemo(() => (bbox ? snapBBox(bbox) : null), [bbox]);
  const sports = useMemo(() => normaliseSports(sportIds), [sportIds]);
  return useQuery({
    queryKey: qk.venuesBbox(snapped, sports),
    queryFn: async (): Promise<VenueMapRow[]> => {
      if (!snapped) return [];
      const { data, error } = await supabase.rpc('venues_in_bbox', {
        p_min_lng: snapped.minLng,
        p_min_lat: snapped.minLat,
        p_max_lng: snapped.maxLng,
        p_max_lat: snapped.maxLat,
        p_sport_ids: sports ?? undefined,
        p_limit: VENUES_BBOX_LIMIT,
      });
      if (error) throw error;
      const rows: VenueMapRow[] = data ?? [];
      return rows;
    },
    enabled: snapped !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** One venue (`venue_detail`). Throws `not_found` (PostgREST error) for hidden/unknown ids. */
export function useVenueDetail(venueId: string | undefined): UseQueryResult<VenueDetailRow> {
  return useQuery({
    queryKey: qk.venue(venueId ?? ''),
    queryFn: async (): Promise<VenueDetailRow> => {
      const { data, error } = await supabase.rpc('venue_detail', { p_venue_id: venueId ?? '' });
      if (error) throw error;
      const row: VenueDetailRow | undefined = data?.[0];
      if (!row) throw new Error('not_found');
      return row;
    },
    enabled: Boolean(venueId),
  });
}

/** Active photos (+ the caller's own), newest first (`venue_photos_list`). */
export function useVenuePhotos(venueId: string | undefined): UseQueryResult<VenuePhotoRow[]> {
  return useQuery({
    queryKey: qk.venuePhotos(venueId ?? ''),
    queryFn: async (): Promise<VenuePhotoRow[]> => {
      const { data, error } = await supabase.rpc('venue_photos_list', {
        p_venue_id: venueId ?? '',
      });
      if (error) throw error;
      const rows: VenuePhotoRow[] = data ?? [];
      return rows;
    },
    enabled: Boolean(venueId),
  });
}

/** Import flags written by the OSM importer into `osm_tags['bojo:flags']` (docs/OSM_IMPORT.md). */
export type VenueFlag = 'on_school_grounds' | 'customers_only' | 'restricted_access';
const KNOWN_FLAGS: readonly VenueFlag[] = [
  'on_school_grounds',
  'customers_only',
  'restricted_access',
];
const RESTRICTED_ACCESS = new Set(['members', 'students', 'residents', 'permit', 'private']);

/**
 * Access flags of a venue, from `venue_detail.flags` (the importer's `osm_tags['bojo:flags']`, returned by
 * the RPC for anonymous and signed-in users alike — no direct table read), plus what `access` implies.
 */
export function useVenueFlags(venue: VenueDetailRow | undefined): VenueFlag[] {
  const serverFlags = venue?.flags;
  const access = venue?.access?.toLowerCase() ?? null;
  return useMemo(() => {
    const flags = new Set<VenueFlag>(
      (serverFlags ?? []).filter((f): f is VenueFlag => KNOWN_FLAGS.includes(f as VenueFlag)),
    );
    if (access === 'customers') flags.add('customers_only');
    if (access && RESTRICTED_ACCESS.has(access)) flags.add('restricted_access');
    return KNOWN_FLAGS.filter((f) => flags.has(f));
  }, [serverFlags, access]);
}

export interface AddVenueInput {
  name: string;
  kind: VenueKind;
  lat: number;
  lng: number;
  sportIds: string[];
  surface: string | null;
  isLit: boolean | null;
  isFree: boolean | null;
  isIndoor: boolean | null;
  openingHours: string | null;
}

/** `add_venue` → new venue id. Errors: outside_service_area, duplicate_venue (details = id), rate_limited. */
export function useAddVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddVenueInput): Promise<string> => {
      const { data, error } = await supabase.rpc('add_venue', {
        p_name: input.name.trim(),
        p_kind: input.kind,
        p_lat: input.lat,
        p_lng: input.lng,
        p_sport_ids: input.sportIds,
        p_surface: input.surface ?? undefined,
        p_is_lit: input.isLit ?? undefined,
        p_is_free: input.isFree ?? undefined,
        p_is_indoor: input.isIndoor ?? undefined,
        p_opening_hours: input.openingHours?.trim() || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  });
}

/** `suggest_venue_edit` (kind `update` with whitelisted keys, or `close`). */
export function useSuggestVenueEdit(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { kind: 'update'; proposed: VenueEditProposal; comment?: string }
        | { kind: 'close'; comment?: string },
    ): Promise<string> => {
      const { data, error } = await supabase.rpc('suggest_venue_edit', {
        p_venue_id: venueId,
        p_kind: input.kind,
        p_proposed: (input.kind === 'update' ? input.proposed : {}) as Json,
        p_comment: input.comment?.trim() || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.venue(venueId) }),
        queryClient.invalidateQueries({ queryKey: qk.venuePhotos(venueId) }),
      ]);
    },
  });
}

/**
 * Upload a picked image (re-encoded → EXIF/GPS stripped, §8) to `venue-photos/<venue>/<user>/<uuid>.jpg`
 * and register it with `add_venue_photo`.
 */
export function useAddVenuePhoto(venueId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (uri: string): Promise<string> => {
      if (!userId) throw new Error('not_authenticated');
      const path = venuePhotoObjectPath(venueId, userId, randomUUID());
      await uploadImage({ bucket: BUCKETS.venuePhotos, path, uri });
      const { data, error } = await supabase.rpc('add_venue_photo', {
        p_venue_id: venueId,
        p_storage_path: path,
      });
      if (error) {
        // Don't leave an orphaned object behind (own-folder delete is allowed by storage RLS).
        await supabase.storage
          .from(BUCKETS.venuePhotos)
          .remove([path])
          .catch(() => undefined);
        throw error;
      }
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.venue(venueId) }),
        queryClient.invalidateQueries({ queryKey: qk.venuePhotos(venueId) }),
      ]);
    },
  });
}
