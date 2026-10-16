import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useMyAvailability, useMySports } from '@/features/profile';
import { useAuth } from '@/lib/auth';

/** `complete_onboarding` requires a trimmed display name of at least 2 characters. */
export const MIN_NAME_LENGTH = 2;

/**
 * Resumable onboarding: every step saves to the server on "Next", so when /onboarding opens again
 * (app restart, sign-in on another device) we fast-forward to the first step that still needs
 * input, keeping the earlier steps in the stack so "Back" still works.
 * Runs once per mount of step 1.
 */
export function useResumeOnboarding() {
  const { profile } = useAuth();
  const sports = useMySports();
  const availability = useMyAvailability();
  const checked = useRef(false);
  const ready = profile !== null && !sports.isPending && !availability.isPending;
  const nameOk = (profile?.display_name.trim().length ?? 0) >= MIN_NAME_LENGTH;
  const hasSports = (sports.data?.length ?? 0) > 0;
  const hasSlots = (availability.data?.length ?? 0) > 0;

  useEffect(() => {
    if (checked.current || !ready) return;
    checked.current = true;
    if (!nameOk) return;
    router.push('/onboarding/sports');
    if (!hasSports) return;
    router.push('/onboarding/availability');
    if (!hasSlots) return;
    router.push('/onboarding/area');
  }, [ready, nameOk, hasSports, hasSlots]);
}
