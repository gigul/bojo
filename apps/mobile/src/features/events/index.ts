// Public API of the events feature (ARCHITECTURE §2.4). Other features import only from here.
// §2.4 contract: EventCard, useEventsFeed. The rest is used by the c-owned chat/notifications features
// and routes.
export {
  FEED_PAGE_SIZE,
  isUuid,
  useCancelEvent,
  useCancelSeries,
  useCreateEvent,
  useDeclineInvite,
  useEvent,
  useEventErrorHandler,
  useEventParticipants,
  useEventsFeed,
  useEventsFeedInfinite,
  useJoinEvent,
  useLeaveEvent,
  useMyEvents,
  useProposeMeeting,
  useRemoveParticipant,
  useSubmitAttendance,
  type CreateEventInput,
  type ProposeMeetingInput,
} from './api';
export { EventCard, type EventCardProps } from './EventCard';
export { EventDetailView } from './EventDetailView';
export { AttendanceView } from './AttendanceView';
export { CreateDraftProvider, useCreateDraft } from './create/draft';
export { CloseFlowButton } from './create/StepHeader';
export { SportStep } from './create/SportStep';
export { VenueStep } from './create/VenueStep';
export { TimeStep } from './create/TimeStep';
export { DetailsStep } from './create/DetailsStep';
export { EventCardSkeleton } from './components/EventCardSkeleton';
export {
  DEFAULT_FEED_FILTERS,
  FeedFilters,
  hasActiveFilters,
  type FeedFilterState,
} from './components/FeedFilters';
export { LevelDots } from './components/LevelDots';
export { successHaptic } from './components/CardJoinButton';
export { useDeviceLocation } from './deviceLocation';
export {
  defaultDuration,
  defaultSpots,
  districtName,
  eventTitle,
  haversineKm,
  levelLabel,
  sportName,
  weekdaysLabel,
} from './format';
export { hashString, useForegroundTick, useRealtimeChanges, type RealtimeSpec } from './realtime';
export { useNow } from './useNow';
