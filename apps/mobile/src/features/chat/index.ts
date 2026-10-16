// Public API of the chat feature (ARCHITECTURE §2.4).
export { useUnreadTotal } from './useUnreadTotal';
export { ChatView } from './ChatView';
export {
  scheduleConversationsRefresh,
  useChatPeople,
  useConversations,
  type ChatMessage,
} from './api';
