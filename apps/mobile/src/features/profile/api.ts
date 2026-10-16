import {
  avatarObjectPath,
  BUCKETS,
  DAY_PARTS,
  isLevel,
  isSportId,
  SPORTS_BY_ID,
  type AvailabilitySlotInput,
  type DayPart,
  type HomeLocationResult,
  type Level,
  type ProfileRow,
  type SlotKey,
  type SportId,
  type Weekday,
} from '@bojo/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/lib/auth';
import { getCurrentLocation, roundCoord } from '@/lib/location';
import { qk } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { uploadImage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export interface MySport {
  sport_id: SportId;
  level: Level;
}

/** Columns a user may update directly (column grants §4.3). */
export type ProfilePatch = Partial<
  Pick<ProfileRow, 'display_name' | 'avatar_path' | 'bio' | 'district_key' | 'goal' | 'discoverable'>
>;

export interface MyPrivate {
  notify_radius_km: number;
  push_enabled: boolean;
  /** Only whether a home area is set — coordinates are never read back to the client. */
  has_home: boolean;
}

function requireUser(userId: string | null): string {
  if (!userId) throw new Error('not_authenticated');
  return userId;
}

function sortSports(rows: MySport[]): MySport[] {
  return [...rows].sort((a, b) => SPORTS_BY_ID[a.sport_id].sortOrder - SPORTS_BY_ID[b.sport_id].sortOrder);
}

const DAY_PART_ORDER: Record<DayPart, number> = { morning: 0, afternoon: 1, evening: 2 };

export function sortSlotKeys(keys: Iterable<string>): SlotKey[] {
  return [...new Set(keys)]
    .map((k) => parseSlotKey(k))
    .filter((s): s is AvailabilitySlotInput => s !== null)
    .sort((a, b) => a.weekday - b.weekday || DAY_PART_ORDER[a.day_part] - DAY_PART_ORDER[b.day_part])
    .map((s) => `${s.weekday}:${s.day_part}` as SlotKey);
}

export function parseSlotKey(key: string): AvailabilitySlotInput | null {
  const [w, p] = key.split(':');
  const weekday = Number(w);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return null;
  if (!(DAY_PARTS as readonly string[]).includes(p ?? '')) return null;
  return { weekday: weekday as Weekday, day_part: p as DayPart };
}

/** Everything that depends on the caller's own profile (match scores, common slots…). */
function invalidatePeople(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ['people'] });
}

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------

export function useMySports() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.mySports,
    enabled: userId !== null,
    queryFn: async (): Promise<MySport[]> => {
      const uid = requireUser(userId);
      const { data, error } = await supabase
        .from('user_sports')
        .select('sport_id, level')
        .eq('user_id', uid);
      if (error) throw error;
      const rows: MySport[] = [];
      for (const r of data ?? []) {
        if (isSportId(r.sport_id) && isLevel(r.level)) rows.push({ sport_id: r.sport_id, level: r.level });
      }
      return sortSports(rows);
    },
  });
}

export function useMyAvailability() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.myAvailability,
    enabled: userId !== null,
    queryFn: async (): Promise<SlotKey[]> => {
      const uid = requireUser(userId);
      const { data, error } = await supabase
        .from('availability_slots')
        .select('weekday, day_part')
        .eq('user_id', uid);
      if (error) throw error;
      return sortSlotKeys((data ?? []).map((r) => `${r.weekday}:${r.day_part}`));
    },
  });
}

export function useMyPrivate() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.myPrivate,
    enabled: userId !== null,
    queryFn: async (): Promise<MyPrivate> => {
      const uid = requireUser(userId);
      const { data, error } = await supabase
        .from('profile_private')
        .select('notify_radius_km, push_enabled, home_location_updated_at')
        .eq('user_id', uid)
        .single();
      if (error) throw error;
      return {
        notify_radius_km: data.notify_radius_km,
        push_enabled: data.push_enabled,
        has_home: data.home_location_updated_at !== null,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// writes
// ---------------------------------------------------------------------------

/** Direct update of the granted `profiles` columns; the auth profile cache is updated in place. */
export function useUpdateProfile() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch): Promise<ProfileRow> => {
      const uid = requireUser(userId);
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', uid)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(qk.me, row);
      void invalidatePeople(queryClient);
    },
  });
}

export function useSaveSports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sports: readonly MySport[]): Promise<void> => {
      const payload = sports.map((s) => ({ sport_id: s.sport_id, level: s.level }));
      const { error } = await supabase.rpc('set_user_sports', { p_sports: payload });
      if (error) throw error;
    },
    onSuccess: (_void, sports) => {
      queryClient.setQueryData(qk.mySports, sortSports([...sports]));
      void queryClient.invalidateQueries({ queryKey: qk.mySports });
      void invalidatePeople(queryClient);
    },
  });
}

export function useSaveAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slots: readonly string[]): Promise<void> => {
      const payload = sortSlotKeys(slots)
        .map(parseSlotKey)
        .filter((s): s is AvailabilitySlotInput => s !== null)
        .map((s) => ({ weekday: s.weekday, day_part: s.day_part }));
      const { error } = await supabase.rpc('set_availability', { p_slots: payload });
      if (error) throw error;
    },
    onSuccess: (_void, slots) => {
      queryClient.setQueryData(qk.myAvailability, sortSlotKeys(slots));
      void queryClient.invalidateQueries({ queryKey: qk.myAvailability });
      void invalidatePeople(queryClient);
    },
  });
}

/** Thrown by useSetHomeLocation when the device position is unavailable or permission was denied. */
export const LOCATION_UNAVAILABLE = 'location_unavailable';

/**
 * `set_home_location` — the ONLY place the device position leaves the phone (§8), and only after an
 * explicit tap. The position is read inside the mutation (never kept in state, mutation variables or
 * logs), rounded to ~100 m here and snapped to a ~550 m grid by the server.
 * Resolves with the detected district (may be null); rejects with LOCATION_UNAVAILABLE or an RPC error.
 */
export function useSetHomeLocation() {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (): Promise<HomeLocationResult> => {
      const position = await getCurrentLocation();
      if (!position) throw new Error(LOCATION_UNAVAILABLE);
      const { data, error } = await supabase.rpc('set_home_location', {
        p_lat: roundCoord(position.lat, 3),
        p_lng: roundCoord(position.lng, 3),
      });
      if (error) throw error;
      const row: HomeLocationResult | undefined = data?.[0];
      return { district_key: row?.district_key ?? null };
    },
    onSuccess: () => {
      queryClient.setQueryData<MyPrivate>(qk.myPrivate, (prev) => (prev ? { ...prev, has_home: true } : prev));
      void queryClient.invalidateQueries({ queryKey: qk.myPrivate });
      void refreshProfile();
      void invalidatePeople(queryClient);
    },
  });
}

export function useClearHomeLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('clear_home_location');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData<MyPrivate>(qk.myPrivate, (prev) => (prev ? { ...prev, has_home: false } : prev));
      void queryClient.invalidateQueries({ queryKey: qk.myPrivate });
      void invalidatePeople(queryClient);
    },
  });
}

/** `profile_private` granted columns: notify_radius_km, push_enabled (locale via setLanguage). */
export function useUpdatePrivate() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<MyPrivate, 'notify_radius_km' | 'push_enabled'>>) => {
      const uid = requireUser(userId);
      const { error } = await supabase.from('profile_private').update(patch).eq('user_id', uid);
      if (error) throw error;
    },
    onMutate: (patch) => {
      queryClient.setQueryData<MyPrivate>(qk.myPrivate, (prev) => (prev ? { ...prev, ...patch } : prev));
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myPrivate });
    },
  });
}

export function useCompleteOnboarding() {
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('complete_onboarding');
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      void invalidatePeople(queryClient);
    },
  });
}

/** Opens the photo library (square crop). Returns a local URI or null when cancelled. */
export async function pickAvatarImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/**
 * Uploads a picked image to `avatars/<uid>/<uuid>.jpg` (re-encoded → EXIF/GPS stripped) and points
 * `profiles.avatar_path` at it. The previous file is removed best-effort. `uri = null` removes the photo.
 */
export function useSetAvatar() {
  const { userId, profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (uri: string | null): Promise<ProfileRow> => {
      const uid = requireUser(userId);
      const previous = profile?.avatar_path ?? null;
      const path = uri
        ? await uploadImage({
            bucket: BUCKETS.avatars,
            path: avatarObjectPath(uid, Crypto.randomUUID()),
            uri,
          })
        : null;
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', uid)
        .select('*')
        .single();
      if (error) throw error;
      if (previous && previous !== path) {
        await supabase.storage.from(BUCKETS.avatars).remove([previous]).catch(() => undefined);
      }
      return data;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(qk.me, row);
      void invalidatePeople(queryClient);
    },
  });
}

/**
 * Edge Function `delete-account` (§6): removes avatars, then the auth user (cascades everything,
 * incl. push tokens). The session is then dropped locally — a server-side sign-out would only
 * fail with 403 for a user that no longer exists. AuthProvider clears the query cache on SIGNED_OUT.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
    },
    onSuccess: async () => {
      await AsyncStorage.removeItem(STORAGE_KEYS.pushToken).catch(() => undefined);
      await supabase.auth.signOut({ scope: 'local' });
    },
  });
}
