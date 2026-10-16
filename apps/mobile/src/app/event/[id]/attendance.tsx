// Organizer marks showed / no-show (ARCHITECTURE §2.2). Owner: c.
import { useLocalSearchParams } from 'expo-router';

import { AttendanceView } from '@/features/events';

export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  return <AttendanceView key={eventId} eventId={eventId} />;
}
