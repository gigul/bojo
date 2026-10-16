// Shown by auth-only venue screens (add venue, suggest edit) when opened without a session (deep link).
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';
import { useRequireAuth } from '@/lib/auth';

export function SignInGate({ title, message }: { title: string; message: string }) {
  const { t } = useTranslation('common');
  const requireAuth = useRequireAuth();
  return (
    <Screen>
      <EmptyState
        icon="log-in"
        title={title}
        message={message}
        action={{ label: t('actions.signIn'), onPress: () => requireAuth() }}
      />
    </Screen>
  );
}
