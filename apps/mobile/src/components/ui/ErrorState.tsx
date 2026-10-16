import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';

import { getRpcErrorCode, useErrorText } from '@/lib/errors';

import { EmptyState } from './EmptyState';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Full-area error with a localised message (errors:<code>) and an optional retry. */
export function ErrorState({ error, onRetry, style }: ErrorStateProps) {
  const { t } = useTranslation('common');
  const errorText = useErrorText();
  const isNetwork = getRpcErrorCode(error) === 'network';
  return (
    <EmptyState
      icon={isNetwork ? 'wifi-off' : 'alert-circle'}
      title={isNetwork ? t('states.offline') : t('states.error')}
      message={errorText(error)}
      action={
        onRetry ? { label: t('actions.retry'), onPress: onRetry, variant: 'secondary' } : undefined
      }
      style={style}
    />
  );
}
