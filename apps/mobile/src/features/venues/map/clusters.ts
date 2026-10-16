// Client-side clustering for both map implementations (supercluster, ARCHITECTURE §2.4).
import type { BBox } from '@bojo/shared';
import Supercluster from 'supercluster';

import { bboxContains, padBBox } from '../model';
import type { VenueMapItem } from '../VenueMap.types';

interface PointProps {
  venueId: string;
  /** 1 when the venue has an event TODAY (reduced with max → "some child has a game today"). */
  today: number;
}
interface ClusterProps {
  today: number;
}

export interface ClusterIndex {
  index: Supercluster<PointProps, ClusterProps>;
  byId: ReadonlyMap<string, VenueMapItem>;
}

export type MapRenderItem =
  | {
      type: 'cluster';
      key: string;
      clusterId: number;
      lat: number;
      lng: number;
      count: number;
      /** Some venue inside has a game today → lime ring. */
      hasToday: boolean;
    }
  | { type: 'venue'; key: string; venue: VenueMapItem; selected: boolean };

/** Pins are 36 pt; a 72 px radius keeps a dense city readable. Beyond z16 every venue is shown. */
const CLUSTER_RADIUS = 72;
const CLUSTER_MAX_ZOOM = 16;

export function buildClusterIndex(venues: readonly VenueMapItem[]): ClusterIndex {
  const index = new Supercluster<PointProps, ClusterProps>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    minPoints: 2,
    map: (props) => ({ today: props.today }),
    reduce: (acc, props) => {
      acc.today = Math.max(acc.today, props.today);
    },
  });
  const byId = new Map<string, VenueMapItem>();
  const points: Parameters<ClusterIndex['index']['load']>[0] = [];
  for (const v of venues) {
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng) || byId.has(v.id)) continue;
    byId.set(v.id, v);
    points.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: { venueId: v.id, today: (v.todayEventsCount ?? 0) > 0 ? 1 : 0 },
    });
  }
  index.load(points);
  return { index, byId };
}

/**
 * Clusters and single venues inside the (slightly padded) viewport. The selected venue is always
 * returned as its own pin — even when it sits inside a cluster — and comes last (drawn on top).
 */
export function clusterItems(
  { index, byId }: ClusterIndex,
  viewport: BBox,
  zoom: number,
  selectedVenueId: string | null,
): MapRenderItem[] {
  const b = padBBox(viewport, 0.15);
  const features = index.getClusters([b.minLng, b.minLat, b.maxLng, b.maxLat], Math.floor(zoom));
  const clusters: MapRenderItem[] = [];
  const singles: MapRenderItem[] = [];
  let selected: MapRenderItem | null = null;

  for (const f of features) {
    const [lng = 0, lat = 0] = f.geometry.coordinates;
    const props = f.properties;
    if ('cluster' in props && props.cluster) {
      clusters.push({
        type: 'cluster',
        key: `c${props.cluster_id}`,
        clusterId: props.cluster_id,
        lat,
        lng,
        count: props.point_count,
        hasToday: props.today > 0,
      });
      continue;
    }
    const venue = byId.get((props as PointProps).venueId);
    if (!venue) continue;
    const item: MapRenderItem = {
      type: 'venue',
      key: `v${venue.id}`,
      venue,
      selected: venue.id === selectedVenueId,
    };
    if (item.selected) selected = item;
    else singles.push(item);
  }

  if (!selected && selectedVenueId) {
    const venue = byId.get(selectedVenueId);
    if (venue && bboxContains(b, venue.lat, venue.lng)) {
      selected = { type: 'venue', key: `v${venue.id}`, venue, selected: true };
    }
  }
  return selected ? [...clusters, ...singles, selected] : [...clusters, ...singles];
}

/** Zoom at which a cluster splits (capped so a tap never zooms in absurdly far). */
export function clusterExpansionZoom({ index }: ClusterIndex, clusterId: number): number {
  try {
    return Math.min(index.getClusterExpansionZoom(clusterId), CLUSTER_MAX_ZOOM + 1);
  } catch {
    return CLUSTER_MAX_ZOOM + 1;
  }
}
