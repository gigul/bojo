// Onboarding feature (owner d): step scaffold + resume / finish logic for src/app/onboarding/.
// The step bodies (sports/level picker, availability grid, district/goal pickers, home area,
// avatar) live in '@/features/profile' because edit-profile reuses them.
export {
  goToPreviousStep,
  ONBOARDING_STEPS,
  STEP_COUNT,
  StepScaffold,
  type StepScaffoldProps,
} from './StepScaffold';
export { useFinishOnboarding, type FinishOnboardingApi } from './useFinishOnboarding';
export { MIN_NAME_LENGTH, useResumeOnboarding } from './useResumeOnboarding';
