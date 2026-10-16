import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { summarizeSlots } from '@/features/profile';
import { Icon, type IconName } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

import type { WhyKey, WhyReason } from '../why';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lineText: { flexShrink: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 26,
      paddingHorizontal: 10,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
  });

const WHY_ICONS: Record<WhyKey, IconName> = {
  sameLevel: 'bar-chart-2',
  closeLevel: 'bar-chart-2',
  nearby: 'map-pin',
  sameDistrict: 'map-pin',
  sameSchedule: 'calendar',
  similarSchedule: 'calendar',
  commonSports: 'layers',
  sameSports: 'layers',
  sameGoal: 'target',
};

/** "Совпадаете: вт, чт вечером" (only the overlap of both schedules — never the full schedule). */
export function CommonSlotsLine({
  slots,
  style,
  numberOfLines = 1,
}: {
  slots: readonly string[];
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('people');
  if (slots.length === 0) return null;
  const summary = summarizeSlots(slots, t);
  return (
    <View style={[styles.line, style]}>
      <Icon name="calendar" size={15} color="textMuted" />
      <Text variant="label" style={styles.lineText} numberOfLines={numberOfLines}>
        {t('common.slots', { summary })}
      </Text>
    </View>
  );
}

/** Outline chips explaining the match ("тот же уровень", "рядом", "похожий график"). */
export function WhyChips({ reasons, style }: { reasons: readonly WhyReason[]; style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('people');
  if (reasons.length === 0) return null;
  const labels = reasons.map((r) => t(`why.${r.key}`, { count: r.count ?? 0 }));
  return (
    <View
      style={[styles.chips, style]}
      accessible
      accessibilityLabel={t('why.a11y', { list: labels.join(', ') })}
      // Web: a labelled group (an aria-label on a role-less div is ignored / invalid).
      {...(Platform.OS === 'web' ? { role: 'group' as const } : null)}
    >
      {reasons.map((r, i) => (
        <View key={r.key} style={styles.chip}>
          <Icon name={WHY_ICONS[r.key]} size={12} color="textMuted" />
          <Text variant="caption" maxFontSizeMultiplier={1.4}>
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}
