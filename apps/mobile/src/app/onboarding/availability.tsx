import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { StepScaffold } from '@/features/onboarding';
import { AvailabilityGrid, useMyAvailability, useSaveAvailability } from '@/features/profile';
import { Icon } from '@/icons';
import { useErrorText } from '@/lib/errors';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    body: { gap: t.spacing.lg },
    note: { flexDirection: 'row', gap: t.spacing.sm, alignItems: 'flex-start' },
    noteText: { flex: 1 },
  });

/** Step 3 — weekly availability grid (`set_availability`). Optional: can be left empty. */
export default function OnboardingAvailabilityScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const availability = useMyAvailability();
  if (availability.isPending) {
    return (
      <StepScaffold
        step={3}
        title={t('onboarding:availability.title')}
        primaryLabel={t('common:actions.next')}
        onPrimary={() => undefined}
        loading
      />
    );
  }
  return <AvailabilityStep initial={availability.data ?? []} />;
}

function AvailabilityStep({ initial }: { initial: string[] }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['onboarding', 'common']);
  const errorText = useErrorText();
  const save = useSaveAvailability();
  const [value, setValue] = useState<string[]>(initial);
  const [error, setError] = useState<string | null>(null);

  const onNext = () => {
    setError(null);
    const unchanged = value.length === initial.length && value.every((k) => initial.includes(k));
    if (unchanged) {
      router.push('/onboarding/area');
      return;
    }
    save.mutate(value, {
      onSuccess: () => router.push('/onboarding/area'),
      onError: (e) => setError(errorText(e)),
    });
  };

  return (
    <StepScaffold
      step={3}
      title={t('onboarding:availability.title')}
      subtitle={t('onboarding:availability.subtitle')}
      primaryLabel={value.length > 0 ? t('common:actions.next') : t('onboarding:availability.skip')}
      onPrimary={onNext}
      primaryLoading={save.isPending}
      error={error}
      testID="onboarding-availability"
    >
      <View style={styles.body}>
        <AvailabilityGrid value={value} onChange={setValue} />
        <View style={styles.note}>
          <Icon name="eye-off" size={16} color="textMuted" />
          <Text variant="caption" color="textMuted" style={styles.noteText}>
            {t('onboarding:availability.privacy')}
          </Text>
        </View>
      </View>
    </StepScaffold>
  );
}
