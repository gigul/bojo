import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfirmDialog } from './ConfirmDialog';
import { useBlockUser } from './useBlockUser';

export interface BlockUserWithConfirmApi {
  /**
   * Asks "Block <name>?" and blocks on confirm. Resolves true when the user is now blocked,
   * false when cancelled or failed (an error toast is already shown). Never rejects.
   */
  requestBlock: (userId: string, name?: string | null) => Promise<boolean>;
  isPending: boolean;
  /** Render this element in the screen tree. */
  dialog: ReactNode;
}

/** Convenience wrapper around `useBlockUser` with the standard confirmation dialog. */
export function useBlockUserWithConfirm(): BlockUserWithConfirmApi {
  const { t } = useTranslation('safety');
  const { block, isPending } = useBlockUser();
  const { confirm, dialog } = useConfirmDialog();

  const requestBlock = useCallback(
    async (userId: string, name?: string | null) => {
      const ok = await confirm({
        title: name ? t('block.confirmTitle', { name }) : t('block.confirmTitleGeneric'),
        message: t('block.confirmMessage'),
        confirmLabel: t('block.action'),
        destructive: true,
      });
      if (!ok) return false;
      try {
        await block(userId);
        return true;
      } catch {
        return false;
      }
    },
    [block, confirm, t],
  );

  return { requestBlock, isPending, dialog };
}
