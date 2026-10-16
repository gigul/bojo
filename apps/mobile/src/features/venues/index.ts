// Public API of the venues feature (ARCHITECTURE §2.4). Other features import only from here.
// Cross-feature contract (signatures frozen): VenueMap, useVenuesInBbox, VenueMapProps, VenueMapItem.
export { useVenuesInBbox } from './api';
export { VenueMap } from './VenueMap';
export type { MapViewport, VenueMapItem, VenueMapProps } from './VenueMap.types';

// Helpers other features may find handy (additive, not part of the frozen §2.4 contract).
export {
  isVenuesTruncated,
  toVenueMapItem,
  venuePictogram,
  venueTitle,
  VENUES_BBOX_LIMIT,
} from './model';

// b2-internal building blocks used by the Map tab and the venue/* routes.
export {
  useAddVenue,
  useAddVenuePhoto,
  useSuggestVenueEdit,
  useVenueDetail,
  useVenueFlags,
  useVenuePhotos,
  type AddVenueInput,
  type VenueFlag,
} from './api';
export {
  bboxCenter,
  bboxContains,
  bboxTouchesServiceArea,
  distanceKm,
  districtLabel,
  eventsCountLabel,
  padBBox,
  sportLabel,
  surfaceLabel,
  type LatLng,
} from './model';
export {
  useVenueMapControls,
  VenueMapControls,
  VenueMapHost,
  type VenueMapController,
} from './map/VenueMapHost';
export { MapSheet, type SheetSnap } from './components/MapSheet';
export { SportFilterBar } from './components/SportFilterBar';
export { VenuePreviewCard } from './components/VenuePreviewCard';
export { VenueRow } from './components/VenueRow';
export { AttributeChips, buildVenueTags, SmallTags } from './components/VenueTags';
export { ConfirmSheet } from './components/ConfirmSheet';
export { PhotoHero, toHeroPhotos, type HeroPhoto } from './components/PhotoHero';
export { SignInGate } from './components/SignInGate';
export { usePhotoUpload } from './usePhotoUpload';
export {
  hasErrors,
  OPENING_HOURS_MAX,
  validateVenueForm,
  VenueFormFields,
  type VenueFormErrors,
  type VenueFormValues,
} from './components/VenueFormFields';
