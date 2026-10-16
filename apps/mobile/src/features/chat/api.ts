// Chat data layer (ARCHITECTURE §5.3): conversations list, messages (direct table reads/inserts under
// RLS, keyset pages of 50), read/mute RPCs and the profiles used to label senders.
import type { ConversationListRow, MessageKind } from '@bojo/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export const MESSAGES_PAGE_SIZE = 50;
const MESSAGE_COLUMNS = 'id,conversation_id,sender_id,kind,body,payload,created_at';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface MessagesCursor {
  createdAt: string;
  id: string;
}

export type MessagesData = InfiniteData<ChatMessage[], MessagesCursor | null>;

function asPayload(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function toChatMessage(row: {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string;
  payload: unknown;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    kind: row.kind,
    body: row.body ?? '',
    payload: asPayload(row.payload),
    created_at: row.created_at,
  };
}

/** Client-generated message id (dedupe key for optimistic send + Realtime echo). */
export function newMessageId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // randomUUID needs a secure context on web; build a v4 UUID from random bytes instead.
    const b = Crypto.getRandomValues(new Uint8Array(16));
    b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
    b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

// ---------------------------------------------------------------------------
// conversations
// ---------------------------------------------------------------------------

export function useConversations(opts?: { enabled?: boolean }) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.conversations,
    queryFn: async (): Promise<ConversationListRow[]> => {
      const { data, error } = await supabase.rpc('my_conversations');
      if (error) throw error;
      const rows: ConversationListRow[] = data ?? [];
      return rows;
    },
    enabled: userId !== null && (opts?.enabled ?? true),
  });
}

/** One row of `my_conversations` (undefined while loading, null when I'm not a member). */
export function useConversation(conversationId: string) {
  const query = useConversations();
  const row = query.data
    ? (query.data.find((c) => c.conversation_id === conversationId) ?? null)
    : undefined;
  return { ...query, row };
}

let conversationsTimer: ReturnType<typeof setTimeout> | null = null;
/** Coalesces bursts of Realtime events into one `my_conversations` refetch. */
export function scheduleConversationsRefresh(qc: QueryClient, delayMs = 600): void {
  if (conversationsTimer) return;
  conversationsTimer = setTimeout(() => {
    conversationsTimer = null;
    void qc.invalidateQueries({ queryKey: qk.conversations });
  }, delayMs);
}

export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
    },
    onMutate: () => {
      qc.setQueryData<ConversationListRow[]>(qk.conversations, (old) =>
        old?.map((c) => (c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c)),
      );
    },
  });
}

export function useSetConversationMuted(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (muted: boolean) => {
      const { error } = await supabase.rpc('set_conversation_muted', {
        p_conversation_id: conversationId,
        p_muted: muted,
      });
      if (error) throw error;
    },
    onMutate: (muted) => {
      const previous = qc.getQueryData<ConversationListRow[]>(qk.conversations);
      qc.setQueryData<ConversationListRow[]>(qk.conversations, (old) =>
        old?.map((c) => (c.conversation_id === conversationId ? { ...c, muted } : c)),
      );
      return { previous };
    },
    onError: (_e, _m, ctx) => qc.setQueryData(qk.conversations, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.conversations }),
  });
}

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

async function fetchMessages(
  conversationId: string,
  cursor: MessagesCursor | null,
): Promise<ChatMessage[]> {
  let q = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);
  if (cursor) {
    q = q.or(
      `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toChatMessage);
}

/** Newest-first pages of 50 (inverted list friendly). */
export function useMessages(conversationId: string, opts?: { enabled?: boolean }) {
  const { userId } = useAuth();
  return useInfiniteQuery({
    queryKey: qk.messages(conversationId),
    queryFn: ({ pageParam }) => fetchMessages(conversationId, pageParam),
    initialPageParam: null as MessagesCursor | null,
    getNextPageParam: (last: ChatMessage[]): MessagesCursor | null => {
      const tail = last[last.length - 1];
      return last.length < MESSAGES_PAGE_SIZE || !tail
        ? null
        : { createdAt: tail.created_at, id: tail.id };
    },
    enabled: userId !== null && (opts?.enabled ?? true),
    // Realtime keeps the list fresh while mounted; avoid refetching 50+ messages on every focus.
    staleTime: 5 * 60_000,
  });
}

function compareDesc(a: ChatMessage, b: ChatMessage): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Inserts a message into the newest page (no-op if it is already there). */
export function addMessageToCache(qc: QueryClient, message: ChatMessage): void {
  qc.setQueryData<MessagesData>(qk.messages(message.conversation_id), (old) => {
    if (!old) return old;
    if (old.pages.some((page) => page.some((m) => m.id === message.id))) return old;
    const [first = [], ...rest] = old.pages;
    return { ...old, pages: [[message, ...first].sort(compareDesc), ...rest] };
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; body: string }): Promise<ChatMessage> => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ id: v.id, conversation_id: conversationId, body: v.body })
        .select(MESSAGE_COLUMNS)
        .single();
      if (error) throw error;
      return toChatMessage(data);
    },
    onSuccess: (message) => {
      addMessageToCache(qc, message);
      scheduleConversationsRefresh(qc);
    },
  });
}

// ---------------------------------------------------------------------------
// people shown in a chat
// ---------------------------------------------------------------------------

export interface ChatPerson {
  id: string;
  display_name: string;
  avatar_path: string | null;
  is_verified: boolean;
}

/** Profiles of senders / system-message subjects (RLS hides blocked users). */
export function useChatPeople(ids: readonly string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['chat', 'people', sorted] as const,
    queryFn: async (): Promise<Record<string, ChatPerson>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_path,is_verified')
        .in('id', sorted);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
    },
    enabled: sorted.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
