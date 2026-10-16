import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import { useErrorText } from '@/lib/errors';

import { blockUserRpc, invalidateAfterBlock, unblockUserRpc } from './api';

// Public API (ARCHITECTURE §2.4) — the signature must not change.
export interface BlockUserApi {
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
  isPending: boolean;
}

/**
 * `block_user` / `unblock_user`. Shows a toast for the outcome (success or a localised error) and
 * invalidates conversations, people, blocked list, person summaries and event caches.
 * The returned promises resolve on success and REJECT on failure (the toast is already shown),
 * so `try { await block(id); router.back(); } catch {}`.
 * Asking for confirmation is the caller's job — see `useBlockUserWithConfirm` / `ConfirmDialog`.
 */
export function useBlockUser(): BlockUserApi {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { t } = useTranslation('safety');
  const errorText = useErrorText();

  const blockMutation = useMutation({
    mutationFn: blockUserRpc,
    onSuccess: () => show(t('block.done'), 'success'),
    onError: (e) => show(errorText(e), 'danger'),
    onSettled: () => invalidateAfterBlock(queryClient),
  });
  const unblockMutation = useMutation({
    mutationFn: unblockUserRpc,
    onSuccess: () => show(t('block.undone'), 'success'),
    onError: (e) => show(errorText(e), 'danger'),
    onSettled: () => invalidateAfterBlock(queryClient),
  });

  const { mutateAsync: blockAsync } = blockMutation;
  const { mutateAsync: unblockAsync } = unblockMutation;
  const block = useCallback((userId: string) => blockAsync(userId), [blockAsync]);
  const unblock = useCallback((userId: string) => unblockAsync(userId), [unblockAsync]);
  const isPending = blockMutation.isPending || unblockMutation.isPending;

  return useMemo(() => ({ block, unblock, isPending }), [block, unblock, isPending]);
}
