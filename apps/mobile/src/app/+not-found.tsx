import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  const { t } = useTranslation('common');
  return (
    <Screen>
      <Stack.Screen options={{ title: t('screens.notFound') }} />
      <EmptyState
        icon="compass"
        title={t('notFound.title')}
        message={t('notFound.message')}
        action={{ label: t('actions.goHome'), onPress: () => router.replace('/') }}
      />
    </Screen>
  );
}
