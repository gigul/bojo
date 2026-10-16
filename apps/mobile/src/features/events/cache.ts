// Patching event rows in every React Query cache that may hold them (feed pages, my events,
// event detail) — used by optimistic joins and by Realtime `events` UPDATEs (live spots counter).
import type { EventCardRow, EventStatus } from '@bojo/shared';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryKeys';

export type EventRowPatch = (row: EventCardRow) => EventCardRow;

/** Counters as delivered by Realtime / join_event. */
export interface EventCounters {
  spots_total?: number;
  spots_taken?: number;
  spots_reserved?: number;
  status?: EventStatus;
}

export function withCounters<T extends EventCardRow>(row: T, c: EventCounters): T {
  const spots_total = c.spots_total ?? row.spots_total;
  const spots_taken = c.spots_taken ?? row.spots_taken;
  const spots_reserved = c.spots_reserved ?? row.spots_reserved;
  return {
    ...row,
    spots_total,
    spots_taken,
    spots_reserved,
    spots_left: Math.max(0, spots_total - spots_taken - spots_reserved),
    status: c.status ?? row.status,
  };
}

function isInfinite(v: unknown): v is InfiniteData<EventCardRow[]> {
  return typeof v === 'object' && v !== null && Array.isArray((v as { pages?: unknown }).pages);
}

function patchList(rows: EventCardRow[], id: string, patch: EventRowPatch): EventCardRow[] {
  let changed = false;
  const next = rows.map((r) => {
    if (r.id !== id) return r;
    changed = true;
    return patch(r);
  });
  return changed ? next : rows;
}

/** Applies `patch` to the event `id` in every ['events', …] cache and in qk.event(id). */
export function patchEventEverywhere(qc: QueryClient, id: string, patch: EventRowPatch): void {
  qc.setQueriesData<unknown>({ queryKey: ['events'] }, (old: unknown) => {
    if (Array.isArray(old)) return patchList(old as EventCardRow[], id, patch);
    if (isInfinite(old)) {
      let changed = false;
      const pages = old.pages.map((page) => {
        const next = patchList(page, id, patch);
        if (next !== page) changed = true;
        return next;
      });
      return changed ? { ...old, pages } : old;
    }
    return old;
  });
  qc.setQueryData<EventCardRow>(qk.event(id), (old) => (old ? patch(old) : old));
}

export interface EventsSnapshot {
  entries: [readonly unknown[], unknown][];
}

/** Snapshot of every event cache (for optimistic rollback). */
export function snapshotEvents(qc: QueryClient, id: string): EventsSnapshot {
  const entries: [readonly unknown[], unknown][] = [
    ...qc.getQueriesData<unknown>({ queryKey: ['events'] }),
    [qk.event(id), qc.getQueryData(qk.event(id))],
  ];
  return { entries };
}

export function restoreEvents(qc: QueryClient, snapshot: EventsSnapshot | undefined): void {
  snapshot?.entries.forEach(([key, data]) => qc.setQueryData(key, data));
}

/** Invalidation after join/leave/cancel/remove/create (Appendix B). */
export function invalidateEventKeys(qc: QueryClient, id?: string | null): Promise<void> {
  const jobs = [
    qc.invalidateQueries({ queryKey: ['events'] }),
    qc.invalidateQueries({ queryKey: qk.conversations }),
  ];
  if (id) {
    jobs.push(qc.invalidateQueries({ queryKey: qk.event(id), exact: true }));
    jobs.push(qc.invalidateQueries({ queryKey: qk.eventParticipants(id) }));
  }
  return Promise.all(jobs).then(() => undefined);
}
