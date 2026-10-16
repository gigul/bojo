import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, IconButton, Text } from '@/components/ui';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

export const ONBOARDING_STEPS: readonly Href[] = [
  '/onboarding',
  '/onboarding/sports',
  '/onboarding/availability',
  '/onboarding/area',
];
export const STEP_COUNT = ONBOARDING_STEPS.length;

export interface StepScaffoldProps {
  /** 1-based. */
  step: number;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Shown above the primary button (validation / server errors). */
  error?: string | null;
  /** Extra element under the primary button (e.g. "Sign out" on step 1). */
  footerExtra?: ReactNode;
  /** Content still loading → spinner instead of children. */
  loading?: boolean;
  testID?: string;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    column: {
      flex: 1,
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.sm,
      paddingTop: t.spacing.xs,
      minHeight: 52,
    },
    backSlot: { width: t.minTouch, height: t.minTouch },
    progress: { flex: 1, flexDirection: 'row', gap: 6 },
    segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: t.colors.border },
    segmentDone: { backgroundColor: t.colors.text },
    segmentCurrent: { backgroundColor: t.colors.primary },
    stepText: { minWidth: 44, textAlign: 'center' },
    scroll: {
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xxl,
      gap: t.spacing.xl,
    },
    heading: { gap: t.spacing.sm },
    footer: {
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.md,
      gap: t.spacing.sm,
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    loading: { paddingVertical: t.spacing.xxl, alignItems: 'center' },
  });

/** Back to the previous step (also works after a web reload, when there is no history). */
export function goToPreviousStep(step: number) {
  if (step <= 1) return;
  if (router.canGoBack()) router.back();
  else router.replace(ONBOARDING_STEPS[step - 2] ?? '/onboarding');
}

/** Shared layout of the 4 onboarding steps: back, progress, title, scrollable body, sticky CTA. */
export function StepScaffold({
  step,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  error,
  footerExtra,
  loading,
  testID,
}: StepScaffoldProps) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['onboarding', 'common']);
  const stepLabel = t('onboarding:progress', { step, total: STEP_COUNT });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.column}>
          <View style={styles.topBar}>
            {step > 1 ? (
              <IconButton
                icon="chevron-left"
                onPress={() => goToPreviousStep(step)}
                accessibilityLabel={t('common:actions.back')}
                testID="onboarding-back"
              />
            ) : (
              <View style={styles.backSlot} />
            )}
            <View
              style={styles.progress}
              accessibilityRole="progressbar"
              accessibilityLabel={stepLabel}
              accessibilityValue={{ min: 1, max: STEP_COUNT, now: step, text: stepLabel }}
            >
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.segment,
                    i + 1 < step ? styles.segmentDone : null,
                    i + 1 === step ? styles.segmentCurrent : null,
                  ]}
                />
              ))}
            </View>
            <Text variant="label" color="textMuted" style={styles.stepText} aria-hidden>
              {t('onboarding:progressShort', { step, total: STEP_COUNT })}
            </Text>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.heading}>
              <Text variant="display" accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
            </View>
            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.colors.textMuted} />
              </View>
            ) : (
              children
            )}
          </ScrollView>

          <View style={styles.footer}>
            {error ? (
              <Text variant="label" color="danger" role="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button
              title={primaryLabel}
              onPress={onPrimary}
              size="lg"
              fullWidth
              disabled={primaryDisabled || loading}
              loading={primaryLoading}
              testID="onboarding-next"
            />
            {footerExtra}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
