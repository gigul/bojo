// Events data layer (ARCHITECTURE §5.2, Appendix B). React Query hooks over the events RPCs.
import type {
  AttendanceMark,
  CreateEventResult,
  EventCardRow,
  EventDetailRow,
  EventsFeedParams,
  JoinEventResult,
  ParticipantPreview,
  ParticipantRow,
  ProposeMeetingResult,
} from '@bojo/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getRpcErrorCode, useErrorText } from '@/lib/errors';
import { roundCoord } from '@/lib/location';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

import {
  invalidateEventKeys,
  patchEventEverywhere,
  restoreEvents,
  snapshotEvents,
  withCounters,
  type EventCounters,
} from './cache';
import { hashString, useRealtimeChanges } from './realtime';

export const FEED_PAGE_SIZE = 30;
/** Anonymous users have no Realtime access (§4.3) — they poll. */
export const ANON_POLL_MS = 30_000;
const LIVE_IDS_MAX = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** An error that maps onto `errors:not_found` (getRpcErrorCode reads `message`). */
function notFoundError(): Error {
  return new Error('not_found');
}

// ---------------------------------------------------------------------------
// feed
// ---------------------------------------------------------------------------

interface FeedCursor {
  startsAt: string;
  id: string;
}

/** RPC args. Device coordinates are rounded to 3 decimals here, whatever the caller passes (§8). */
function toFeedArgs(params: EventsFeedParams, cursor?: FeedCursor | null) {
  const hasPoint = typeof params.lat === 'number' && typeof params.lng === 'number';
  return {
    p_lat: hasPoint ? roundCoord(params.lat as number) : undefined,
    p_lng: hasPoint ? roundCoord(params.lng as number) : undefined,
    p_radius_km: hasPoint ? params.radiusKm : undefined,
    p_sport_ids: params.sportIds && params.sportIds.length > 0 ? params.sportIds : undefined,
    p_date_range: params.dateRange,
    p_district_key: params.districtKey,
    p_venue_id: params.venueId,
    p_only_with_spots: params.onlyWithSpots,
    p_limit: params.limit,
    p_cursor_starts_at: cursor?.startsAt,
    p_cursor_id: cursor?.id,
  };
}

async function fetchFeedPage(
  params: EventsFeedParams,
  cursor?: FeedCursor | null,
): Promise<EventCardRow[]> {
  const { data, error } = await supabase.rpc('events_feed', toFeedArgs(params, cursor));
  if (error) throw error;
  const rows: EventCardRow[] = data ?? [];
  return rows;
}

interface EventRealtimeRow extends Record<string, unknown> {
  id: string;
  spots_total: number;
  spots_taken: number;
  spots_reserved: number;
  status: EventCardRow['status'];
}

function countersOf(row: EventRealtimeRow): EventCounters {
  return {
    spots_total: row.spots_total,
    spots_taken: row.spots_taken,
    spots_reserved: row.spots_reserved,
    status: row.status,
  };
}

/**
 * Live spots counter for a list of cards: Realtime `events` UPDATEs for the visible ids
 * (`events-feed:<hash>`, ≤100 ids, authenticated only) patch every cached copy of the row.
 */
export function useLiveEventCounters(rows: readonly EventCardRow[] | undefined): void {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const ids: string[] = [];
  for (const r of rows ?? []) {
    if (r.status === 'scheduled' && !ids.includes(r.id)) ids.push(r.id);
    if (ids.length >= LIVE_IDS_MAX) break;
  }
  const joined = [...ids].sort().join(',');
  useRealtimeChanges<EventRealtimeRow>(
    userId && joined
      ? {
          topic: `events-feed:${hashString(joined)}`,
          event: 'UPDATE',
          table: 'events',
          filter: `id=in.(${joined})`,
        }
      : null,
    (row) => patchEventEverywhere(qc, row.id, (r) => withCounters(r, countersOf(row))),
  );
}

/** §2.4 public API: first page of `events_feed` (+ live counters / anon polling). */
export function useEventsFeed(
  params: EventsFeedParams,
  opts?: { enabled?: boolean },
): UseQueryResult<EventCardRow[]> {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: qk.eventsFeed(params),
    queryFn: () => fetchFeedPage(params),
    enabled: opts?.enabled ?? true,
    refetchInterval: userId ? false : ANON_POLL_MS,
  });
  useLiveEventCounters(query.data);
  return query;
}

/** Keyset-paginated feed for the Events tab (pages of `limit`, cursor = last (starts_at, id)). */
export function useEventsFeedInfinite(params: EventsFeedParams, opts?: { enabled?: boolean }) {
  const { userId } = useAuth();
  const limit = params.limit ?? FEED_PAGE_SIZE;
  const query = useInfiniteQuery({
    queryKey: [...qk.eventsFeed(params), 'pages'] as const,
    queryFn: ({ pageParam }) => fetchFeedPage({ ...params, limit }, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last: EventCardRow[]): FeedCursor | null => {
      const tail = last[last.length - 1];
      return last.length < limit || !tail ? null : { startsAt: tail.starts_at, id: tail.id };
    },
    enabled: opts?.enabled ?? true,
    refetchInterval: userId ? false : ANON_POLL_MS,
    // Keep the list on screen while a filter / location change loads the next result.
    placeholderData: keepPreviousData,
  });
  const rows: EventCardRow[] = [];
  const seen = new Set<string>();
  for (const page of query.data?.pages ?? []) {
    for (const row of page) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  useLiveEventCounters(rows);
  return { ...query, rows };
}

/** `my_events` — events I organise or attend (going/invited), any status. */
export function useMyEvents(scope: 'upcoming' | 'past', opts?: { enabled?: boolean }) {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: qk.myEvents(scope),
    queryFn: async (): Promise<EventCardRow[]> => {
      const { data, error } = await supabase.rpc('my_events', { p_scope: scope, p_limit: 100 });
      if (error) throw error;
      const rows: EventCardRow[] = data ?? [];
      return rows;
    },
    enabled: userId !== null && (opts?.enabled ?? true),
  });
  useLiveEventCounters(scope === 'upcoming' ? query.data : undefined);
  return query;
}

// ---------------------------------------------------------------------------
// one event
// ---------------------------------------------------------------------------

/** `event_detail` + Realtime `event:<id>` (spots/status) or 30 s polling for anon. */
export function useEvent(id: string | null | undefined, opts?: { live?: boolean }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const eventId = id ?? '';
  const query = useQuery({
    queryKey: qk.event(eventId),
    queryFn: async (): Promise<EventDetailRow> => {
      if (!isUuid(eventId)) throw notFoundError();
      const { data, error } = await supabase.rpc('event_detail', { p_event_id: eventId });
      if (error) throw error;
      const row: EventDetailRow | undefined = data?.[0];
      if (!row) throw notFoundError();
      return row;
    },
    enabled: eventId.length > 0,
    refetchInterval: userId ? false : ANON_POLL_MS,
  });
  const live = (opts?.live ?? true) && userId !== null && isUuid(eventId);
  useRealtimeChanges<EventRealtimeRow>(
    live
      ? { topic: `event:${eventId}`, event: 'UPDATE', table: 'events', filter: `id=eq.${eventId}` }
      : null,
    (row) => {
      patchEventEverywhere(qc, eventId, (r) => withCounters(r, countersOf(row)));
      // can_join / cancel_reason / participants are derived server-side → refresh in the background.
      void qc.invalidateQueries({ queryKey: qk.event(eventId), exact: true });
      void qc.invalidateQueries({ queryKey: qk.eventParticipants(eventId) });
    },
  );
  return query;
}

/** `event_participants_list` (authenticated only; blocked users are hidden by the server). */
export function useEventParticipants(id: string | null | undefined, opts?: { enabled?: boolean }) {
  const { userId } = useAuth();
  const eventId = id ?? '';
  return useQuery({
    queryKey: qk.eventParticipants(eventId),
    queryFn: async (): Promise<ParticipantRow[]> => {
      const { data, error } = await supabase.rpc('event_participants_list', {
        p_event_id: eventId,
      });
      if (error) throw error;
      const rows: ParticipantRow[] = data ?? [];
      return rows;
    },
    enabled: userId !== null && isUuid(eventId) && (opts?.enabled ?? true),
  });
}

// ---------------------------------------------------------------------------
// mutations
// ---------------------------------------------------------------------------

/** Appendix A error UX for event actions: toast + targeted refetch / onboarding redirect. */
export function useEventErrorHandler(): (e: unknown, eventId?: string | null) => void {
  const qc = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  return useCallback(
    (e: unknown, eventId?: string | null) => {
      const code = getRpcErrorCode(e);
      if (code === 'profile_incomplete') router.push('/onboarding');
      if (
        eventId &&
        ['event_full', 'event_not_joinable', 'not_found', 'forbidden'].includes(code)
      ) {
        void invalidateEventKeys(qc, eventId);
      }
      toast.show(errorText(e), 'danger');
    },
    [qc, toast, errorText],
  );
}

function addMe(
  preview: ParticipantPreview[] | null,
  me: ParticipantPreview | null,
): ParticipantPreview[] | null {
  if (!preview || !me || preview.some((p) => p.user_id === me.user_id) || preview.length >= 4) {
    return preview;
  }
  return [...preview, me];
}

/** "Иду": optimistic spots/my_status update everywhere, rollback on error. */
export function useJoinEvent() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('events');
  const { userId, profile } = useAuth();
  const onError = useEventErrorHandler();
  const me: ParticipantPreview | null = userId
    ? {
        user_id: userId,
        display_name: profile?.display_name ?? '',
        avatar_path: profile?.avatar_path ?? null,
      }
    : null;

  return useMutation({
    mutationFn: async (eventId: string): Promise<JoinEventResult> => {
      const { data, error } = await supabase.rpc('join_event', { p_event_id: eventId });
      if (error) throw error;
      const row: JoinEventResult | undefined = data?.[0];
      if (!row) throw notFoundError();
      return row;
    },
    onMutate: async (eventId) => {
      await qc.cancelQueries({ queryKey: ['events'] });
      await qc.cancelQueries({ queryKey: qk.event(eventId), exact: true });
      const snapshot = snapshotEvents(qc, eventId);
      patchEventEverywhere(qc, eventId, (r) =>
        r.my_status === 'going'
          ? r
          : {
              ...withCounters(r, { spots_taken: r.spots_taken + 1 }),
              my_status: 'going',
              participants_preview: addMe(r.participants_preview, me),
            },
      );
      return { snapshot };
    },
    onError: (e, eventId, ctx) => {
      restoreEvents(qc, ctx?.snapshot);
      onError(e, eventId);
    },
    onSuccess: (res, eventId) => {
      patchEventEverywhere(qc, eventId, (r) => ({
        ...withCounters(r, res),
        my_status: 'going',
        ...('conversation_id' in r ? { conversation_id: res.conversation_id } : null),
      }));
      toast.show(t('toast.joined'), 'success');
    },
    onSettled: (_d, _e, eventId) => invalidateEventKeys(qc, eventId),
  });
}

export function useLeaveEvent() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('events');
  const { userId } = useAuth();
  const onError = useEventErrorHandler();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('leave_event', { p_event_id: eventId });
      if (error) throw error;
    },
    onSuccess: (_d, eventId) => {
      patchEventEverywhere(qc, eventId, (r) => ({
        ...withCounters(r, { spots_taken: Math.max(0, r.spots_taken - 1) }),
        my_status: 'left',
        participants_preview: r.participants_preview?.filter((p) => p.user_id !== userId) ?? null,
      }));
      toast.show(t('toast.left'));
    },
    onError: (e, eventId) => onError(e, eventId),
    onSettled: (_d, _e, eventId) => invalidateEventKeys(qc, eventId),
  });
}

export function useDeclineInvite() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('events');
  const onError = useEventErrorHandler();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('decline_invite', { p_event_id: eventId });
      if (error) throw error;
    },
    onSuccess: (_d, eventId) => {
      patchEventEverywhere(qc, eventId, (r) => ({ ...r, my_status: 'left' }));
      toast.show(t('toast.declined'));
    },
    onError: (e, eventId) => onError(e, eventId),
    onSettled: (_d, _e, eventId) => invalidateEventKeys(qc, eventId),
  });
}

export function useCancelEvent() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('events');
  const onError = useEventErrorHandler();
  return useMutation({
    mutationFn: async (v: {
      eventId: string;
      reason?: string | null;
      conversationId?: string | null;
    }) => {
      const reason = v.reason?.trim();
      const { error } = await supabase.rpc('cancel_event', {
        p_event_id: v.eventId,
        p_reason: reason ? reason : undefined,
      });
      if (error) throw error;
      // The server posts a system "cancelled" message; don't count the organizer's own action as unread.
      if (v.conversationId) {
        await supabase.rpc('mark_conversation_read', { p_conversation_id: v.conversationId });
      }
    },
    onSuccess: (_d, v) => {
      patchEventEverywhere(qc, v.eventId, (r) => ({ ...r, status: 'cancelled' }));
      toast.show(t('toast.cancelled'));
    },
    onError: (e, v) => onError(e, v.eventId),
    onSettled: (_d, _e, v) => invalidateEventKeys(qc, v.eventId),
  });
}

export function useCancelSeries() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('events');
  const onError = useEventErrorHandler();
  return useMutation({
    mutationFn: async (v: { seriesId: string; eventId: string }) => {
      const { error } = await supabase.rpc('cancel_series', { p_series_id: v.seriesId });
      if (error) throw error;
    },
    onSuccess: () => toast.show(t('toast.seriesCancelled')),
    onError: (e, v) => onError(e, v.eventId),
    onSettled: (_d, _e, v) => invalidateEventKeys(qc, v.eventId),
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('events');
  const onError = useEventErrorHandler();
  return useMutation({
    mutationFn: async (v: { eventId: string; userId: string }) => {
      const { error } = await supabase.rpc('remove_participant', {
        p_event_id: v.eventId,
        p_user_id: v.userId,
      });
      if (error) throw error;
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: qk.eventParticipants(v.eventId) });
      const previous = qc.getQueryData<ParticipantRow[]>(qk.eventParticipants(v.eventId));
      qc.setQueryData<ParticipantRow[]>(qk.eventParticipants(v.eventId), (old) =>
        old?.filter((p) => p.user_id !== v.userId),
      );
      return { previous };
    },
    onSuccess: () => toast.show(t('toast.removed')),
    onError: (e, v, ctx) => {
      qc.setQueryData(qk.eventParticipants(v.eventId), ctx?.previous);
      onError(e, v.eventId);
    },
    onSettled: (_d, _e, v) => invalidateEventKeys(qc, v.eventId),
  });
}

export function useSubmitAttendance() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('events');
  const onError = useEventErrorHandler();
  return useMutation({
    mutationFn: async (v: { eventId: string; marks: AttendanceMark[] }) => {
      const { error } = await supabase.rpc('submit_attendance', {
        p_event_id: v.eventId,
        p_marks: v.marks.map((m) => ({ user_id: m.user_id, attended: m.attended })),
      });
      if (error) throw error;
    },
    onSuccess: () => toast.show(t('toast.attendanceSaved'), 'success'),
    onError: (e, v) => onError(e, v.eventId),
    onSettled: (_d, _e, v) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.eventParticipants(v.eventId) }),
        qc.invalidateQueries({ queryKey: qk.event(v.eventId), exact: true }),
      ]),
  });
}

export interface CreateEventInput {
  sportId: string;
  venueId: string;
  startsAt: string;
  durationMin?: number | null;
  spotsTotal?: number | null;
  spotsReserved?: number | null;
  level?: number | null;
  title?: string | null;
  description?: string | null;
  repeatWeekdays?: number[] | null;
  /** 'YYYY-MM-DD' (Warsaw calendar date). */
  repeatUntil?: string | null;
}

const orUndefined = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);
const textOrUndefined = (v: string | null | undefined) => {
  const s = v?.trim();
  return s ? s : undefined;
};

/** `create_event`. Errors are left to the caller (the create flow has its own UX). */
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: CreateEventInput): Promise<CreateEventResult> => {
      const repeat = v.repeatWeekdays && v.repeatWeekdays.length > 0 ? v.repeatWeekdays : null;
      const { data, error } = await supabase.rpc('create_event', {
        p_sport_id: v.sportId,
        p_venue_id: v.venueId,
        p_starts_at: v.startsAt,
        p_duration_min: orUndefined(v.durationMin),
        p_spots_total: orUndefined(v.spotsTotal),
        p_spots_reserved: orUndefined(v.spotsReserved),
        p_level: orUndefined(v.level),
        p_title: textOrUndefined(v.title),
        p_description: textOrUndefined(v.description),
        p_repeat_weekdays: repeat ?? undefined,
        p_repeat_until: repeat ? orUndefined(v.repeatUntil) : undefined,
      });
      if (error) throw error;
      const row: CreateEventResult | undefined = data?.[0];
      if (!row) throw notFoundError();
      return row;
    },
    onSuccess: (res) => invalidateEventKeys(qc, res.event_id),
  });
}

export interface ProposeMeetingInput {
  matchId: string;
  sportId: string;
  venueId: string;
  startsAt: string;
  durationMin?: number | null;
  note?: string | null;
}

/** `propose_meeting` (private 2-person event + `event_invite` message in the match chat). */
export function useProposeMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ProposeMeetingInput): Promise<ProposeMeetingResult> => {
      const { data, error } = await supabase.rpc('propose_meeting', {
        p_match_id: v.matchId,
        p_sport_id: v.sportId,
        p_venue_id: v.venueId,
        p_starts_at: v.startsAt,
        p_duration_min: orUndefined(v.durationMin),
        p_note: textOrUndefined(v.note),
      });
      if (error) throw error;
      const row: ProposeMeetingResult | undefined = data?.[0];
      if (!row) throw notFoundError();
      return row;
    },
    onSuccess: (res) =>
      Promise.all([
        invalidateEventKeys(qc, res.event_id),
        qc.invalidateQueries({ queryKey: qk.messages(res.conversation_id) }),
      ]),
  });
}
