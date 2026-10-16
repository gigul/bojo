// Device location kept in memory only (never persisted, never logged). Used for client-side
// distance labels and, rounded to 3 decimals, as `events_feed(p_lat, p_lng)` args (§8).
import { useEffect, useSyncExternalStore } from 'react';

import { getCurrentLocation, type LatLng } from '@/lib/location';

interface LocationState {
  location: LatLng | null;
  /** The permission prompt / lookup has finished (with or without a location). */
  settled: boolean;
}

const LOOKUP_TIMEOUT_MS = 5000;

let state: LocationState = { location: null, settled: false };
let requested = false;
const listeners = new Set<() => void>();

function setState(next: LocationState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function request() {
  if (requested) return;
  requested = true;
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS),
  );
  Promise.race([getCurrentLocation(), timeout])
    .then((location) => setState({ location: location ?? state.location, settled: true }))
    .catch(() => setState({ location: state.location, settled: true }));
}

/**
 * `request: true` asks for permission once per app session (the Events tab does this);
 * `false` only reads what is already known (e.g. the event screen never prompts).
 */
export function useDeviceLocation(opts: { request: boolean }): LocationState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  const shouldRequest = opts.request;
  useEffect(() => {
    if (shouldRequest) request();
  }, [shouldRequest]);
  return snapshot;
}
