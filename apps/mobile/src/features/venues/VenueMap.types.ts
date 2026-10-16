// src/features/venues/VenueMap.types.ts  (exact — ARCHITECTURE §2.4; owner b2, signature frozen)
import type { StyleProp, ViewStyle } from 'react-native';
import type { BBox, VenueKind } from '@bojo/shared';
export interface VenueMapItem {
  id: string;
  lat: number;
  lng: number;
  name: string | null;
  kind: VenueKind;
  sportIds: string[];
  upcomingEventsCount: number;
  /**
   * Events starting today (additive to the frozen §2.4 shape, optional so existing callers compile):
   * the lime ring on a pin / cluster means "a game today" (DESIGN.md). Omitted → no ring.
   */
  todayEventsCount?: number;
}
export interface MapViewport extends BBox {
  zoom: number;
}
export interface VenueMapProps {
  venues: VenueMapItem[];
  initialCenter?: { lat: number; lng: number }; // default WARSAW_CENTER
  initialZoom?: number; // default 12
  selectedVenueId?: string | null;
  onSelectVenue?: (venueId: string) => void;
  onViewportChange?: (v: MapViewport) => void; // debounced 300 ms inside the component
  userLocation?: { lat: number; lng: number } | null; // own device location dot; never sent elsewhere
  pickMode?: boolean; // shows a centre crosshair; hides venue markers if venues=[]
  onPickLocation?: (p: { lat: number; lng: number }) => void; // fired on "confirm" in pickMode
  style?: StyleProp<ViewStyle>;
}
