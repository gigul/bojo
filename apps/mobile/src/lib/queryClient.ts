import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { isRetryableError } from './errors';

/** §2.6 defaults: staleTime 30 s, one retry (transport errors only), refetch when the app regains focus. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => failureCount < 1 && isRetryableError(error),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const queryClient = createQueryClient();

// Native has no window focus events: drive React Query's focusManager from AppState.
// (Web uses the default visibilitychange listener. onlineManager keeps its default — no NetInfo dep.)
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => sub.remove();
  });
}
