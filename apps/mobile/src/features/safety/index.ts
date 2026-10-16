// Public API of the safety feature (ARCHITECTURE §2.4). Import only from '@/features/safety'.
export { ReportSheet, type ReportSheetProps } from './ReportSheet';
export { useBlockUser, type BlockUserApi } from './useBlockUser';
// Additive helpers (not part of the §2.4 contract, free to use):
export {
  ConfirmDialog,
  useConfirmDialog,
  type ConfirmDialogApi,
  type ConfirmDialogProps,
  type ConfirmOptions,
} from './ConfirmDialog';
export { useBlockUserWithConfirm, type BlockUserWithConfirmApi } from './useBlockUserWithConfirm';
export { useBlockedUsers } from './api';
