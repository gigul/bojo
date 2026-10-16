import * as Location from 'expo-location';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Rounds a coordinate (default 3 decimals ≈ 100 m — the precision allowed for `events_feed`, §8). */
export function roundCoord(n: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Current device location for map centring / distance sorting. Asks for foreground permission.
 * Returns null when denied or unavailable. Never persist or send this anywhere except rounded
 * `events_feed` args (§8).
 */
export async function getCurrentLocation(): Promise<LatLng | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000 }).catch(() => null);
    const position =
      last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return null;
  }
}
