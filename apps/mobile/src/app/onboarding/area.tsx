import { isDistrictKey, type DistrictKey, type UserGoal } from '@bojo/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { StepScaffold, useFinishOnboarding } from '@/features/onboarding';
import {
  DistrictPicker,
  GoalPicker,
  HomeAreaControl,
  Section,
  useMyPrivate,
} from '@/features/profile';
import { useAuth } from '@/lib/auth';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    body: { gap: t.spacing.xl },
  });

/** Step 4 — district (+ optional home area) and goal → complete_onboarding. */
export default function OnboardingAreaScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const { profile } = useAuth();
  if (!profile) {
    return (
      <StepScaffold
        step={4}
        title={t('onboarding:area.title')}
        primaryLabel={t('onboarding:area.finish')}
        onPrimary={() => undefined}
        loading
      />
    );
  }
  return (
    <AreaStep
      initialDistrict={isDistrictKey(profile.district_key) ? profile.district_key : null}
      initialGoal={profile.goal}
    />
  );
}

function AreaStep({
  initialDistrict,
  initialGoal,
}: {
  initialDistrict: DistrictKey | null;
  initialGoal: UserGoal | null;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['onboarding', 'common']);
  const privateData = useMyPrivate();
  const { finish, isBusy, error, setError } = useFinishOnboarding();
  const [district, setDistrict] = useState<DistrictKey | null>(initialDistrict);
  const [goal, setGoal] = useState<UserGoal | null>(initialGoal);

  const onFinish = () => {
    if (!district) {
      setError(t('onboarding:area.districtRequired'));
      return;
    }
    void finish({ district, goal });
  };

  return (
    <StepScaffold
      step={4}
      title={t('onboarding:area.title')}
      subtitle={t('onboarding:area.subtitle')}
      primaryLabel={t('onboarding:area.finish')}
      onPrimary={onFinish}
      primaryDisabled={!district}
      primaryLoading={isBusy}
      error={error}
      testID="onboarding-area"
    >
      <View style={styles.body}>
        <Section
          title={t('onboarding:area.districtTitle')}
          subtitle={t('onboarding:area.districtHint')}
        >
          <DistrictPicker
            value={district}
            onChange={(d) => {
              setDistrict(d);
              if (error) setError(null);
            }}
          />
        </Section>
        <HomeAreaControl
          hasHome={privateData.data?.has_home ?? false}
          onDetected={(d) => {
            if (d) setDistrict(d);
          }}
        />
        <Section title={t('onboarding:area.goalTitle')} subtitle={t('onboarding:area.goalHint')}>
          <GoalPicker value={goal} onChange={setGoal} />
        </Section>
      </View>
    </StepScaffold>
  );
}
