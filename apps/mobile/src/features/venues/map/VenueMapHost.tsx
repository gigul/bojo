// Internal to the venues feature: lets a screen that owns a <VenueMap> (the Map tab, add-venue) drive
// the camera and reserve space for its overlays — WITHOUT touching the frozen VenueMapProps (§2.4).
// Other features never need this; without a provider the map uses the defaults below.
import { createContext, useContext, useState, type ReactNode } from 'react';

import type { LatLng } from '../model';

export interface VenueMapController {
  /** Animated move to `target`; keeps the current zoom when `zoom` is omitted. */
  flyTo(target: LatLng, zoom?: number): void;
  /** Zoom in (+) / out (−) around the current centre. */
  zoomBy(delta: number): void;
}

/**
 * Stable handle the screen keeps (via `useVenueMapControls`) and calls from event handlers; the
 * mounted map attaches its camera implementation to it. Calls before the map is ready are no-ops.
 */
export class VenueMapControls implements VenueMapController {
  private target: VenueMapController | null = null;

  /** Called by the map in an effect; returns the detach function (effect cleanup). */
  attach(controller: VenueMapController): () => void {
    this.target = controller;
    return () => {
      if (this.target === controller) this.target = null;
    };
  }

  flyTo(target: LatLng, zoom?: number): void {
    this.target?.flyTo(target, zoom);
  }

  zoomBy(delta: number): void {
    this.target?.zoomBy(delta);
  }
}

export interface VenueMapHostValue {
  /** Space covered by the screen's own overlays at the bottom (e.g. a collapsed sheet), in pt. */
  bottomInset: number;
  controls: VenueMapControls | null;
}

const VenueMapHostContext = createContext<VenueMapHostValue>({ bottomInset: 0, controls: null });

export function VenueMapHost({
  bottomInset = 0,
  controls,
  children,
}: {
  bottomInset?: number;
  controls: VenueMapControls;
  children: ReactNode;
}) {
  return (
    <VenueMapHostContext.Provider value={{ bottomInset, controls }}>
      {children}
    </VenueMapHostContext.Provider>
  );
}

export function useVenueMapHost(): VenueMapHostValue {
  return useContext(VenueMapHostContext);
}

/** One stable controls object per screen. */
export function useVenueMapControls(): VenueMapControls {
  const [controls] = useState(() => new VenueMapControls());
  return controls;
}
