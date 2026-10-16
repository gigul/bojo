// Step 3: quick time chips (one tap → next) + a custom day / hour / minute picker built from kit parts.
import { EVENT_LIMITS, type Weekday } from '@bojo/shared';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, ChipRow, Stepper, Text } from '@/components/ui';
import { useLanguage } from '@/i18n';
import { formatEventWhen, warsawDateTimeISO, warsawWeekday } from '@/lib/datetime';
import { useThemedStyles, type Theme } from '@/theme';

import { useNow } from '../useNow';
import { nextStepPath, STEP_PATHS, useCreateDraft } from './draft';
import { StepHeader } from './StepHeader';

/** A start must be at least this far ahead to be offered (server requires > now). */
const MIN_LEAD_MS = 15 * 60_000;
const MINUTES = [0, 15, 30, 45] as const;
const CUSTOM_DAYS = 14;

interface Slot {
  iso: string;
  label: string;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    scroll: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xxl,
      gap: t.spacing.xl,
    },
    group: { gap: t.spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    timeChip: { minHeight: 44, paddingHorizontal: 18 },
    dayRow: { gap: t.spacing.sm, paddingRight: t.spacing.lg },
    custom: {
      gap: t.spacing.md,
      padding: t.spacing.lg,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surface,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
    },
    customDays: { marginHorizontal: -t.spacing.lg },
    customDaysContent: { gap: t.spacing.sm, paddingHorizontal: t.spacing.lg },
    preview: { gap: 2 },
  });

export function TimeStep() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'vocab', 'common']);
  const language = useLanguage();
  const now = useNow();
  const { draft, update, steps } = useCreateDraft();
  const [customOpen, setCustomOpen] = useState(false);
  const [customDay, setCustomDay] = useState(0);
  const [customHour, setCustomHour] = useState(19);
  const [customMinute, setCustomMinute] = useState<number>(0);

  if (!draft.sportId) return <Redirect href={STEP_PATHS.sport} />;
  if (!draft.venue) return <Redirect href={STEP_PATHS.venue} />;

  const isFuture = (iso: string) => new Date(iso).getTime() - now >= MIN_LEAD_MS;
  const slot = (day: number, hh: number, label?: string): Slot => {
    const iso = warsawDateTimeISO(day, hh, 0);
    return { iso, label: label ?? `${String(hh).padStart(2, '0')}:00` };
  };
  const weekdayShort = (day: number) =>
    t(`vocab:weekdaysShort.${warsawWeekday(warsawDateTimeISO(day, 12, 0)) as Weekday}`);

  const today = [18, 19, 20, 21]
    .map((h) => slot(0, h))
    .filter((s) => isFuture(s.iso))
    .slice(0, 3);
  const tomorrow = [10, 18, 19, 20].map((h) => slot(1, h));
  const weekendDays: number[] = [];
  for (let d = 2; d <= 8 && weekendDays.length < 2; d += 1) {
    const wd = warsawWeekday(warsawDateTimeISO(d, 12, 0));
    if (wd === 6 || wd === 7) weekendDays.push(d);
  }
  const weekend = weekendDays.flatMap((d) =>
    [10, 18].map((h) => slot(d, h, `${weekdayShort(d)} ${String(h).padStart(2, '0')}:00`)),
  );

  const choose = (iso: string) => {
    update({ startsAt: iso });
    router.push(nextStepPath(steps, 'time'));
  };

  const customIso = warsawDateTimeISO(customDay, customHour, customMinute);
  const customMs = new Date(customIso).getTime();
  const customValid =
    customMs - now >= MIN_LEAD_MS && customMs - now <= EVENT_LIMITS.maxDaysAhead * 86_400_000;

  const group = (title: string, slots: Slot[]) =>
    slots.length === 0 ? null : (
      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.chips} role="radiogroup" accessibilityLabel={title}>
          {slots.map((s) => (
            <Chip
              key={s.iso}
              label={s.label}
              selected={draft.startsAt === s.iso}
              selection="radio"
              onPress={() => choose(s.iso)}
              accessibilityLabel={formatEventWhen(s.iso, language)}
              style={styles.timeChip}
            />
          ))}
        </View>
      </View>
    );

  const dayLabel = (d: number) =>
    d === 0
      ? t('common:time.today')
      : d === 1
        ? t('common:time.tomorrow')
        : `${weekdayShort(d)} ${new Date(warsawDateTimeISO(d, 12, 0)).getUTCDate()}`;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <StepHeader step="time" title={t('events:create.time.title')} />
      {group(t('common:time.today'), today)}
      {group(t('common:time.tomorrow'), tomorrow)}
      {group(t('events:create.time.weekend'), weekend)}

      {customOpen ? (
        <View style={styles.custom}>
          <Text variant="heading" accessibilityRole="header">
            {t('events:create.time.custom')}
          </Text>
          <ChipRow
            style={styles.customDays}
            contentContainerStyle={styles.customDaysContent}
            role="radiogroup"
            accessibilityLabel={t('events:create.time.custom')}
          >
            {Array.from({ length: CUSTOM_DAYS }, (_, d) => (
              <Chip
                key={d}
                label={dayLabel(d)}
                selected={customDay === d}
                selection="radio"
                onPress={() => setCustomDay(d)}
              />
            ))}
          </ChipRow>
          <Stepper
            label={t('events:create.time.hour')}
            value={customHour}
            min={6}
            max={23}
            onChange={setCustomHour}
            formatValue={(v) => String(v).padStart(2, '0')}
          />
          <View
            style={styles.chips}
            role="radiogroup"
            accessibilityLabel={t('events:create.time.minutes')}
          >
            {MINUTES.map((m) => (
              <Chip
                key={m}
                label={`:${String(m).padStart(2, '0')}`}
                selected={customMinute === m}
                selection="radio"
                onPress={() => setCustomMinute(m)}
                accessibilityLabel={t('events:create.time.minutesA11y', { m })}
              />
            ))}
          </View>
          <View style={styles.preview} accessibilityLiveRegion="polite">
            <Text variant="title">{formatEventWhen(customIso, language)}</Text>
            {!customValid ? (
              <Text variant="label" color="danger">
                {t('events:create.time.pastHint')}
              </Text>
            ) : null}
          </View>
          <Button
            title={t('common:actions.next')}
            size="lg"
            fullWidth
            disabled={!customValid}
            onPress={() => choose(customIso)}
          />
        </View>
      ) : (
        <Button
          title={t('events:create.time.customOpen')}
          icon="clock"
          variant="secondary"
          onPress={() => setCustomOpen(true)}
        />
      )}
    </ScrollView>
  );
}
