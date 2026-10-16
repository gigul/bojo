import type { EventsFeedParams } from '@bojo/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Badge, Button, Chip, ListItem, Screen, Stepper, Text, useToast } from '@/components/ui';
import { EventCard, useEventsFeed } from '@/features/events';
import { Divider, Section } from '@/features/profile';
import {
  DEFAULT_RUNNER_PREFS,
  PACE_LIMITS,
  useRunnerProfile,
  useSaveRunnerProfile,
  type RunnerPrefs,
} from '@/features/runs';
import { useLanguage } from '@/i18n';
import { Icon, SportIcon, type IconName } from '@/icons';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/errors';
import { formatPace } from '@/lib/format';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

const DISTANCES = [3, 5, 10, 21.1, 42.2] as const;
const RUNS_FEED: EventsFeedParams = { sportIds: ['running'], dateRange: 'upcoming', limit: 10 };
const INTEGRATIONS: { id: 'strava' | 'appleHealth' | 'googleFit'; icon: IconName }[] = [
  { id: 'strava', icon: 'activity' },
  { id: 'appleHealth', icon: 'heart' },
  { id: 'googleFit', icon: 'trending-up' },
];

const createStyles = (t: Theme) =>
  StyleSheet.create({
    content: { gap: t.spacing.xxl, paddingBottom: t.spacing.xxl },
    intro: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' },
    introIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    introText: { flex: 1, gap: t.spacing.xs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    list: { gap: t.spacing.md },
    center: { paddingVertical: t.spacing.xl, alignItems: 'center' },
    field: { gap: t.spacing.sm },
  });

export default function RunsScreen() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['runs', 'common', 'vocab']);
  const { session } = useAuth();
  const requireAuth = useRequireAuth();
  const runner = useRunnerProfile();
  const runs = useEventsFeed(RUNS_FEED);

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('common:screens.runs') }} />
      <View style={styles.content}>
        <View style={styles.intro}>
          <View style={styles.introIcon} aria-hidden>
            <SportIcon sportId="running" size={26} />
          </View>
          <View style={styles.introText}>
            <Badge label={t('runs:stubBadge')} tone="neutral" />
            <Text variant="heading" accessibilityRole="header">
              {t('runs:intro.title')}
            </Text>
            <Text color="textMuted">{t('runs:intro.text')}</Text>
          </View>
        </View>

        {session ? (
          runner.isPending ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.textMuted} />
            </View>
          ) : (
            <RunnerPrefsForm initial={runner.data ?? null} />
          )
        ) : (
          <Section title={t('runs:prefs.title')} card>
            <Text color="textMuted">{t('runs:prefs.signIn')}</Text>
            <Button title={t('common:actions.signIn')} onPress={() => requireAuth('/runs')} />
          </Section>
        )}

        <Section title={t('runs:group.title')} subtitle={t('runs:group.subtitle')}>
          <View style={styles.list}>
            {runs.isPending ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.textMuted} />
              </View>
            ) : (runs.data ?? []).length === 0 ? (
              <Text color="textMuted">{t('runs:group.empty')}</Text>
            ) : (
              (runs.data ?? []).map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  compact
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
                />
              ))
            )}
            <Button
              title={t('runs:group.create')}
              icon="plus"
              variant="secondary"
              onPress={() => {
                if (!requireAuth('/runs')) return;
                router.push({ pathname: '/event/create', params: { sportId: 'running' } });
              }}
              testID="runs-create"
            />
          </View>
        </Section>

        <Section title={t('runs:integrations.title')} subtitle={t('runs:integrations.subtitle')} card padded={false}>
          {INTEGRATIONS.map((it, i) => (
            <View key={it.id}>
              {i > 0 ? <Divider /> : null}
              <ListItem
                title={t(`runs:integrations.${it.id}`)}
                subtitle={t('runs:integrations.soonText')}
                left={<Icon name={it.icon} size={20} color="textMuted" />}
                right={<Badge label={t('runs:integrations.soon')} tone="neutral" />}
                accessibilityLabel={`${t(`runs:integrations.${it.id}`)}, ${t('runs:integrations.soon')}`}
              />
            </View>
          ))}
        </Section>
      </View>
    </Screen>
  );
}

function RunnerPrefsForm({ initial }: { initial: RunnerPrefs | null }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['runs', 'common', 'vocab']);
  const { show } = useToast();
  const errorText = useErrorText();
  const save = useSaveRunnerProfile();
  const language = useLanguage();
  const [prefs, setPrefs] = useState<RunnerPrefs>(initial ?? DEFAULT_RUNNER_PREFS);
  const base = initial ?? null;
  const dirty =
    base === null ||
    base.paceFast !== prefs.paceFast ||
    base.paceSlow !== prefs.paceSlow ||
    base.distanceKm !== prefs.distanceKm;
  const pace = (v: number) => `${formatPace(v)} ${t('vocab:units.perKm')}`;
  const distanceLabel = (km: number) =>
    t('runs:prefs.km', { km: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(km) });

  const onSave = () =>
    save.mutate(prefs, {
      onSuccess: () => show(t('runs:prefs.saved'), 'success'),
      onError: (e) => show(errorText(e), 'danger'),
    });

  return (
    <Section title={t('runs:prefs.title')} subtitle={t('runs:prefs.subtitle')} card>
      <Stepper
        label={t('runs:prefs.paceFast')}
        value={prefs.paceFast}
        min={PACE_LIMITS.min}
        max={PACE_LIMITS.max}
        step={PACE_LIMITS.step}
        formatValue={pace}
        onChange={(v) => setPrefs((p) => ({ ...p, paceFast: v, paceSlow: Math.max(p.paceSlow, v) }))}
      />
      <Stepper
        label={t('runs:prefs.paceSlow')}
        value={prefs.paceSlow}
        min={PACE_LIMITS.min}
        max={PACE_LIMITS.max}
        step={PACE_LIMITS.step}
        formatValue={pace}
        onChange={(v) => setPrefs((p) => ({ ...p, paceSlow: v, paceFast: Math.min(p.paceFast, v) }))}
      />
      <Text variant="caption" color="textMuted">
        {t('runs:prefs.paceHint', { fast: pace(prefs.paceFast), slow: pace(prefs.paceSlow) })}
      </Text>
      <View style={styles.field}>
        <Text variant="label" color="textMuted">
          {t('runs:prefs.distance')}
        </Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {DISTANCES.map((km) => (
            <Chip
              key={km}
              label={distanceLabel(km)}
              selected={prefs.distanceKm === km}
              selection="radio"
              onPress={() => setPrefs((p) => ({ ...p, distanceKm: km }))}
              testID={`runs-distance-${km}`}
            />
          ))}
        </View>
      </View>
      <Button
        title={base === null ? t('runs:prefs.saveFirst') : t('common:actions.save')}
        onPress={onSave}
        disabled={!dirty}
        loading={save.isPending}
        fullWidth
        testID="runs-save"
      />
    </Section>
  );
}
