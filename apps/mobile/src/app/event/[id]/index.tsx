// Event detail (ARCHITECTURE §2.2). Owner: c.
import { useLocalSearchParams } from 'expo-router';

import { EventDetailView } from '@/features/events';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  return <EventDetailView key={eventId} eventId={eventId} />;
}
