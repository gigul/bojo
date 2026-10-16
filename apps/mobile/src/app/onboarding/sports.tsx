import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StepScaffold } from '@/features/onboarding';
import { SportLevelPicker, useMySports, useSaveSports, type MySport } from '@/features/profile';
import { useErrorText } from '@/lib/errors';

/** Step 2 — sports + level per sport (`set_user_sports`, 1–9 entries). */
export default function OnboardingSportsScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const sports = useMySports();
  if (sports.isPending) {
    return (
      <StepScaffold
        step={2}
        title={t('onboarding:sports.title')}
        primaryLabel={t('common:actions.next')}
        onPrimary={() => undefined}
        loading
      />
    );
  }
  return <SportsStep initial={sports.data ?? []} />;
}

function sameSports(a: readonly MySport[], b: readonly MySport[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((s) => [s.sport_id, s.level]));
  return b.every((s) => map.get(s.sport_id) === s.level);
}

function SportsStep({ initial }: { initial: MySport[] }) {
  const { t } = useTranslation(['onboarding', 'common']);
  const errorText = useErrorText();
  const save = useSaveSports();
  const [value, setValue] = useState<MySport[]>(initial);
  const [error, setError] = useState<string | null>(null);

  const onNext = () => {
    if (value.length === 0) {
      setError(t('onboarding:sports.required'));
      return;
    }
    setError(null);
    if (sameSports(value, initial)) {
      router.push('/onboarding/availability');
      return;
    }
    save.mutate(value, {
      onSuccess: () => router.push('/onboarding/availability'),
      onError: (e) => setError(errorText(e)),
    });
  };

  return (
    <StepScaffold
      step={2}
      title={t('onboarding:sports.title')}
      subtitle={t('onboarding:sports.subtitle')}
      primaryLabel={t('common:actions.next')}
      onPrimary={onNext}
      primaryDisabled={value.length === 0}
      primaryLoading={save.isPending}
      error={error}
      testID="onboarding-sports"
    >
      <SportLevelPicker
        value={value}
        onChange={(next) => {
          setValue(next);
          if (error) setError(null);
        }}
      />
    </StepScaffold>
  );
}
