// Step 1: big sport tiles; the user's own sports (and a preset venue's sports) first.
import { SPORT_IDS } from '@bojo/shared';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { SportIcon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

import { sportName } from '../format';
import { nextStepPath, STEP_PATHS, useCreateDraft, useMySportIds } from './draft';
import { StepHeader } from './StepHeader';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    scroll: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xxl,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md },
    tile: {
      flexBasis: '30%',
      flexGrow: 1,
      minHeight: 112,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surface,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.md,
    },
    tileSelected: { borderColor: t.colors.text, borderWidth: 2 },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    mine: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.primary,
      borderWidth: 1,
      borderColor: t.colors.primaryText,
    },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: t.spacing.lg },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.primary,
      borderWidth: 1,
      borderColor: t.colors.primaryText,
    },
  });

export function SportStep() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('events');
  const { draft, update, steps } = useCreateDraft();
  const mine = useMySportIds().data ?? [];

  if (!steps.includes('sport')) {
    // ?sportId given: the flow starts at the next step (replace keeps "back" = leave the flow).
    return <Redirect href={STEP_PATHS[steps[0] ?? 'time']} />;
  }

  const venueSports = draft.venue?.sportIds ?? [];
  const rank = (id: string) => (venueSports.includes(id) ? 0 : 2) + (mine.includes(id) ? 0 : 1);
  const ordered = [...SPORT_IDS].sort(
    (a, b) => rank(a) - rank(b) || SPORT_IDS.indexOf(a) - SPORT_IDS.indexOf(b),
  );

  const pick = (sportId: string) => {
    update({ sportId });
    router.push(nextStepPath(steps, 'sport'));
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <StepHeader
        step="sport"
        title={draft.matchId ? t('create.sport.titleMeeting') : t('create.sport.title')}
      />
      <View style={styles.grid}>
        {ordered.map((id) => {
          const name = sportName(id, t);
          const isMine = mine.includes(id);
          const selected = draft.sportId === id;
          return (
            <Pressable
              key={id}
              onPress={() => pick(id)}
              accessibilityRole="button"
              accessibilityLabel={isMine ? t('create.sport.mineA11y', { sport: name }) : name}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.tile,
                selected ? styles.tileSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <SportIcon sportId={id} size={36} />
              <Text variant="label" align="center" numberOfLines={2}>
                {name}
              </Text>
              {isMine ? <View style={styles.mine} aria-hidden /> : null}
            </Pressable>
          );
        })}
      </View>
      {mine.length > 0 ? (
        <View style={styles.legend}>
          <View style={styles.legendDot} aria-hidden />
          <Text variant="caption" color="textMuted">
            {t('create.sport.mineLegend')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
