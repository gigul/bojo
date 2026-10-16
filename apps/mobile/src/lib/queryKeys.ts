import type { BBox, EventsFeedParams } from '@bojo/shared';

/**
 * React Query keys (ARCHITECTURE Appendix B). Use only these; invalidate by prefix where listed:
 * - join/leave/cancel/remove/create event: ['events'], qk.event(id), qk.eventParticipants(id), qk.conversations
 * - swipe with a match, unmatch, block: qk.conversations, ['people']
 * - profile writes: qk.me and the relevant ['me', …] key
 * - add_venue_photo / suggest_venue_edit: qk.venue(id), qk.venuePhotos(id)
 */
export const qk = {
  me: ['me'] as const,
  myPrivate: ['me', 'private'] as const,
  mySports: ['me', 'sports'] as const,
  myAvailability: ['me', 'availability'] as const,
  blocked: ['me', 'blocked'] as const,
  runner: ['me', 'runner'] as const,
  venuesBbox: (bbox: BBox | null, sportIds?: readonly string[] | null) =>
    ['venues', 'bbox', bbox, sportIds ?? null] as const,
  venue: (id: string) => ['venue', id] as const,
  venuePhotos: (id: string) => ['venue', id, 'photos'] as const,
  eventsFeed: (params: EventsFeedParams) => ['events', 'feed', params] as const,
  myEvents: (scope: 'upcoming' | 'past') => ['events', 'mine', scope] as const,
  event: (id: string) => ['event', id] as const,
  eventParticipants: (id: string) => ['event', id, 'participants'] as const,
  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  conversationMembers: (conversationId: string) =>
    ['conversation', conversationId, 'members'] as const,
  candidates: (sportId?: string | null) => ['people', 'candidates', sportId ?? null] as const,
  person: (id: string) => ['person', id] as const,
  notifications: ['notifications'] as const,
} as const;
