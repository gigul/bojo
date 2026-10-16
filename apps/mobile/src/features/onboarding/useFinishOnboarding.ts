import type { DistrictKey, UserGoal } from '@bojo/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import { useCompleteOnboarding, useUpdateProfile } from '@/features/profile';
import { useAuth } from '@/lib/auth';
import { getRpcErrorCode, useErrorText } from '@/lib/errors';

import { MIN_NAME_LENGTH } from './useResumeOnboarding';

export interface FinishOnboardingApi {
  /** Saves district + goal, calls `complete_onboarding`, then leaves for the tabs. */
  finish: (input: { district: DistrictKey; goal: UserGoal | null }) => Promise<void>;
  isBusy: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

/**
 * Last onboarding step. Navigation to the tabs happens only once the auth profile already shows
 * `onboarded_at`: the root onboarding gate would otherwise still see the old profile for one render
 * and send the user straight back to /onboarding. `profile_incomplete` (name or sports missing)
 * routes back to the step that needs input.
 */
export function useFinishOnboarding(): FinishOnboardingApi {
  const { t } = useTranslation('onboarding');
  const errorText = useErrorText();
  const { show } = useToast();
  const { profile } = useAuth();
  const update = useUpdateProfile();
  const complete = useCompleteOnboarding();
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboarded = Boolean(profile?.onboarded_at);

  useEffect(() => {
    if (finished && onboarded) router.replace('/(tabs)');
  }, [finished, onboarded]);

  const finish = async ({ district, goal }: { district: DistrictKey; goal: UserGoal | null }) => {
    setError(null);
    try {
      if (district !== profile?.district_key || goal !== profile?.goal) {
        await update.mutateAsync({ district_key: district, goal });
      }
      await complete.mutateAsync();
      show(t('done'), 'success');
      setFinished(true);
    } catch (e) {
      if (getRpcErrorCode(e) === 'profile_incomplete') {
        setError(t('area.incomplete'));
        const nameOk = (profile?.display_name.trim().length ?? 0) >= MIN_NAME_LENGTH;
        router.replace(nameOk ? '/onboarding/sports' : '/onboarding');
        return;
      }
      setError(errorText(e));
    }
  };

  return {
    finish,
    isBusy: update.isPending || complete.isPending || finished,
    error,
    setError,
  };
}
