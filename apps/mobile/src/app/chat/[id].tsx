// Conversation (event or match chat); id = conversations.id (ARCHITECTURE §2.2). Owner: c.
import { useLocalSearchParams } from 'expo-router';

import { ChatView } from '@/features/chat';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  return <ChatView key={conversationId} conversationId={conversationId} />;
}
