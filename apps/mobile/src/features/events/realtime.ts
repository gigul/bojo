// Realtime helpers shared by the events / chat / notifications features (ARCHITECTURE §7).
// Only authenticated users subscribe (anon has no realtime access); RLS decides what is delivered.
import { useEffect, useEffectEvent, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type RealtimeTable = 'messages' | 'events' | 'notifications';
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeSpec {
  /** Channel name from §7 (e.g. `conversation:<id>`); a per-subscription suffix is appended. */
  topic: string;
  event: RealtimeEvent;
  table: RealtimeTable;
  /** PostgREST-style filter, e.g. `conversation_id=eq.<id>` or `id=in.(a,b)`. */
  filter?: string;
}

let channelSeq = 0;

/** Increments every time a native app returns to the foreground (web: never changes). */
export function useForegroundTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (previous !== 'active' && next === 'active') setTick((n) => n + 1);
      previous = next;
    });
    return () => sub.remove();
  }, []);
  return tick;
}

/**
 * Subscribes to `postgres_changes` while `spec` is non-null. Unsubscribes on unmount / spec change
 * and resubscribes when the app returns to the foreground (§7). supabase-js returns the existing
 * channel for a repeated topic, so every subscription gets a unique suffix.
 */
export function useRealtimeChanges<Row extends Record<string, unknown>>(
  spec: RealtimeSpec | null,
  onRow: (row: Row) => void,
): void {
  const handle = useEffectEvent((row: Row) => onRow(row));
  const tick = useForegroundTick();
  const topic = spec?.topic ?? null;
  const event = spec?.event ?? null;
  const table = spec?.table ?? null;
  const filter = spec?.filter;

  useEffect(() => {
    if (!topic || !event || !table) return;
    channelSeq += 1;
    const channel = supabase
      .channel(`${topic}#${channelSeq}`)
      .on(
        'postgres_changes',
        // The overloads are per literal event; the runtime value is one of INSERT/UPDATE/DELETE.
        { event: event as '*', schema: 'public', table, ...(filter ? { filter } : null) },
        (payload) => {
          const row = payload.new as Row | undefined;
          if (row && Object.keys(row).length > 0) handle(row);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [topic, event, table, filter, tick]);
}

/** Small stable string hash for channel names (`events-feed:<hash>`). */
export function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
