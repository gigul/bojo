import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

import { stepNumber, useCloseFlow, useCreateDraft, type StepKey } from './draft';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { gap: t.spacing.xs, paddingBottom: t.spacing.md },
    progress: { flexDirection: 'row', gap: 4, marginBottom: t.spacing.sm },
    seg: { flex: 1, height: 4, borderRadius: 2 },
  });

/** "Шаг 2 из 4" + progress segments + the step question. */
export function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: StepKey;
  title: string;
  subtitle?: string;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('events');
  const { steps } = useCreateDraft();
  const { n, total } = stepNumber(steps, step);
  return (
    <View style={styles.root}>
      <View style={styles.progress} aria-hidden>
        {steps.map((s, i) => (
          <View
            key={s}
            style={[
              styles.seg,
              { backgroundColor: i < n ? theme.colors.text : theme.colors.surfaceAlt },
            ]}
          />
        ))}
      </View>
      <Text variant="label" color="textMuted">
        {t('create.step', { n, total })}
      </Text>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
    </View>
  );
}

/** Header close (X) — leaves the whole flow from any step. */
export function CloseFlowButton() {
  const { t } = useTranslation('common');
  const close = useCloseFlow();
  return <IconButton icon="x" onPress={close} accessibilityLabel={t('actions.close')} />;
}
