import { RELIABILITY_MIN_EVENTS } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    block: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg },
    score: { minWidth: 72 },
    text: { flex: 1, gap: 2 },
    track: {
      flexDirection: 'row',
      gap: 4,
      marginTop: t.spacing.xs,
    },
    dot: { width: 22, height: 6, borderRadius: 3, backgroundColor: t.colors.border },
    dotOn: { backgroundColor: t.colors.text },
  });

/** "92% · надёжность" — rendered only when the server has a score (≥ 3 rated games). */
export function ReliabilityInline({ score }: { score: number | null }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('profile');
  if (score === null) return null;
  const text = t('reliability.inline', { score });
  return (
    <View style={styles.inline} accessible accessibilityLabel={t('reliability.inlineA11y', { score })}>
      <Icon name="user-check" size={16} color="textMuted" />
      <Text variant="label" color="textMuted">
        {text}
      </Text>
    </View>
  );
}

export interface ReliabilityBlockProps {
  score: number | null;
  attended: number;
  noShow: number;
}

/** Own profile: "92% · 12 игр" once total ≥ 3, otherwise "появится после 3 игр" with progress. */
export function ReliabilityBlock({ score, attended, noShow }: ReliabilityBlockProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('profile');
  const total = attended + noShow;
  if (score !== null && total >= RELIABILITY_MIN_EVENTS) {
    return (
      <View
        style={styles.block}
        accessible
        accessibilityLabel={t('reliability.a11y', { score, count: total })}
      >
        <Text variant="display" style={styles.score}>
          {t('reliability.percent', { score })}
        </Text>
        <View style={styles.text}>
          <Text variant="bodyStrong">{t('reliability.games', { count: total })}</Text>
          <Text variant="caption" color="textMuted">
            {t('reliability.explain')}
          </Text>
        </View>
      </View>
    );
  }
  const done = Math.min(total, RELIABILITY_MIN_EVENTS);
  return (
    <View
      style={styles.text}
      accessible
      accessibilityLabel={`${t('reliability.pending', { count: RELIABILITY_MIN_EVENTS })}. ${t('reliability.progress', { done, total: RELIABILITY_MIN_EVENTS })}`}
    >
      <Text variant="bodyStrong">{t('reliability.pending', { count: RELIABILITY_MIN_EVENTS })}</Text>
      <Text variant="caption" color="textMuted">
        {t('reliability.pendingExplain')}
      </Text>
      <View style={styles.track} aria-hidden>
        {Array.from({ length: RELIABILITY_MIN_EVENTS }, (_, i) => (
          <View key={i} style={[styles.dot, i < done ? styles.dotOn : null]} />
        ))}
      </View>
    </View>
  );
}
