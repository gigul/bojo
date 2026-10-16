import { DISTRICTS, USER_GOALS, type DistrictKey, type UserGoal } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import type { IconName } from '@/icons';
import { useLanguage } from '@/i18n';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    goals: { gap: t.spacing.sm },
    goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  });

export interface DistrictPickerProps {
  value: string | null;
  onChange: (key: DistrictKey) => void;
}

/** 18 Warsaw districts as single-choice chips, sorted by the localised name. */
export function DistrictPicker({ value, onChange }: DistrictPickerProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('vocab');
  const language = useLanguage();
  const items = DISTRICTS.map((d) => ({ key: d.key, label: t(`districts.${d.key}`) })).sort(
    (a, b) => a.label.localeCompare(b.label, language),
  );
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {items.map((d) => (
        <Chip
          key={d.key}
          label={d.label}
          selected={value === d.key}
          selection="radio"
          onPress={() => onChange(d.key)}
          testID={`district-${d.key}`}
        />
      ))}
    </View>
  );
}

const GOAL_ICONS: Record<UserGoal, IconName> = {
  fun: 'smile',
  fitness: 'activity',
  competition: 'award',
  learning: 'book-open',
};

export interface GoalPickerProps {
  value: UserGoal | null;
  onChange: (goal: UserGoal | null) => void;
}

/** Why the user plays (optional; tap again to clear). */
export function GoalPicker({ value, onChange }: GoalPickerProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['vocab', 'profile']);
  return (
    <View style={styles.goals}>
      <View style={styles.goalRow} accessibilityRole="radiogroup">
        {USER_GOALS.map((g) => (
          <Chip
            key={g}
            label={t(`vocab:goals.${g}`)}
            icon={GOAL_ICONS[g]}
            selected={value === g}
            selection="radio"
            onPress={() => onChange(value === g ? null : g)}
            testID={`goal-${g}`}
          />
        ))}
      </View>
      {value ? (
        <Text variant="caption" color="textMuted">
          {t(`profile:goalHints.${value}`)}
        </Text>
      ) : null}
    </View>
  );
}
