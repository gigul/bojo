// Create-event flow: nested Stack + CreateEventDraft context; params ?venueId&sportId&matchId
// (ARCHITECTURE §2.2 / §2.4). Owner: c. Requires an account (gated here).
import { router, Stack, useGlobalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, headerBackOptions, Screen } from '@/components/ui';
import { CloseFlowButton, CreateDraftProvider } from '@/features/events';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { stackScreenOptions, useTheme } from '@/theme';

export default function EventCreateLayout() {
  const theme = useTheme();
  const { t } = useTranslation(['events', 'common']);
  const { session, isLoading } = useAuth();
  const requireAuth = useRequireAuth();
  const params = useGlobalSearchParams<{ venueId?: string; sportId?: string; matchId?: string }>();
  const meeting = Boolean(params.matchId);
  const screenOptions = useMemo(
    () => ({
      ...stackScreenOptions(theme),
      ...headerBackOptions(t('common:actions.back')),
      title: meeting ? t('events:create.flowTitleMeeting') : t('common:screens.eventCreate'),
      headerRight: () => <CloseFlowButton />,
    }),
    [theme, meeting, t],
  );

  if (!session) {
    if (isLoading)
      return <View style={[styles.flex, { backgroundColor: theme.colors.background }]} />;
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <EmptyState
          icon="plus-circle"
          title={t('common:states.signInRequired')}
          message={t('events:create.signIn')}
          action={
            <View style={styles.actions}>
              <Button
                title={t('common:actions.signIn')}
                onPress={() => requireAuth('/event/create')}
              />
              <Button
                title={t('common:actions.close')}
                variant="ghost"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/events'))}
              />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <CreateDraftProvider params={params}>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" />
        <Stack.Screen name="venue" />
        <Stack.Screen name="time" />
        <Stack.Screen name="details" />
      </Stack>
    </CreateDraftProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { gap: 8, alignItems: 'center' },
});
