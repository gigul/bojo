import { useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** After a match: open the match conversation (route contract §2.4). */
export function openMatchChat(conversationId: string) {
  router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
}

/** "Propose a meeting": c's create flow in propose mode (route contract §2.4). */
export function proposeMeeting(matchId: string, sportId: string | null) {
  router.push({
    pathname: '/event/create',
    params: sportId ? { matchId, sportId } : { matchId },
  });
}

/**
 * Web only: ← / → while the screen is focused (ignored while typing in a field).
 * Handlers are read through a ref, so the listener is attached once per focus.
 */
export function useArrowKeys(handlers: { left: () => void; right: () => void; enabled: boolean }) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
      const onKeyDown = (e: KeyboardEvent) => {
        if (!latest.current.enabled || e.altKey || e.ctrlKey || e.metaKey) return;
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          latest.current.left();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          latest.current.right();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, []),
  );
}
