// Step 4: players / level / duration / optional text / weekly repeat with sensible defaults → "Создать"
// (`create_event`). With ?matchId it proposes a meeting instead (`propose_meeting`, 2 players, no repeat).
import {
  EVENT_LIMITS,
  LEVELS,
  SERIES_DEFAULT_WEEKS,
  TEXT_LIMITS,
  type Weekday,
} from '@bojo/shared';
import { Redirect, router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useHeaderHeight } from 'expo-router/react-navigation';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Stepper, SwitchRow, Text, TextField, useToast } from '@/components/ui';
import { Icon, SportIcon } from '@/icons';
import { useLanguage } from '@/i18n';
import { formatDate, formatEventWhen, toWarsaw, warsawWeekday } from '@/lib/datetime';
import { getRpcErrorCode, useErrorText } from '@/lib/errors';
import { venueName } from '@/lib/venueName';
import { useThemedStyles, type Theme } from '@/theme';

import { useCreateEvent, useProposeMeeting } from '../api';
import { successHaptic } from '../components/CardJoinButton';
import { defaultDuration, defaultSpots, levelLabel, sportName } from '../format';
import { STEP_PATHS, useCreateDraft } from './draft';
import { StepHeader } from './StepHeader';

const REPEAT_WEEKS = [4, 8, 12, 26] as const;
const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    scroll: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xxl,
      gap: t.spacing.xl,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      minHeight: 56,
    },
    summaryText: { flex: 1, minWidth: 0 },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    divider: { height: t.layout.hairline, backgroundColor: t.colors.border, marginLeft: 52 },
    section: { gap: t.spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    need: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingTop: t.spacing.xs,
    },
    // Kit SwitchRow, flush with the section headings (its pressed tint bleeds 8 pt each side).
    switchRow: {
      marginHorizontal: -t.spacing.sm,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.radius.md,
    },
    flex: { flex: 1 },
    footer: {
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.md,
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    footerInner: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth - 2 * t.layout.screenGutter,
      alignSelf: 'center',
    },
  });

/** 'YYYY-MM-DD' Warsaw calendar date of `iso` + `days`. */
function warsawDatePlus(iso: string, days: number): string {
  const d = toWarsaw(iso);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + days, 12));
  return utc.toISOString().slice(0, 10);
}

function SummaryRow({
  icon,
  title,
  onChange,
  changeLabel,
}: {
  icon: ReactNode;
  title: string;
  onChange?: () => void;
  changeLabel: string;
}) {
  const styles = useThemedStyles(createStyles);
  const content = (
    <>
      {icon}
      <Text variant="bodyStrong" numberOfLines={2} style={styles.summaryText}>
        {title}
      </Text>
      {onChange ? (
        <Text variant="label" color="primaryText">
          {changeLabel}
        </Text>
      ) : null}
    </>
  );
  if (!onChange) {
    return <View style={styles.summaryRow}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${changeLabel}`}
      style={({ pressed }) => [styles.summaryRow, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

export function DetailsStep() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'vocab', 'common']);
  const language = useLanguage();
  const headerHeight = useHeaderHeight();
  const toast = useToast();
  const errorText = useErrorText();
  const { draft, steps } = useCreateDraft();
  const create = useCreateEvent();
  const propose = useProposeMeeting();

  const sportId = draft.sportId;
  const startsAt = draft.startsAt;
  const [total, setTotal] = useState(() => defaultSpots(sportId));
  const [have, setHave] = useState(1);
  const [level, setLevel] = useState<number | null>(null);
  const [duration, setDuration] = useState(() => defaultDuration(sportId));
  const [moreOpen, setMoreOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>(() =>
    startsAt ? [warsawWeekday(startsAt)] : [],
  );
  const [weeks, setWeeks] = useState<number>(SERIES_DEFAULT_WEEKS);

  if (!sportId) return <Redirect href={STEP_PATHS.sport} />;
  if (!draft.venue) return <Redirect href={STEP_PATHS.venue} />;
  if (!startsAt) return <Redirect href={STEP_PATHS.time} />;

  const venue = draft.venue;
  const meeting = draft.matchId !== null;
  const sport = sportName(sportId, t);
  const need = Math.max(0, total - have);
  const durations = [...new Set([60, 90, 120, defaultDuration(sportId)])].sort((a, b) => a - b);
  const until = warsawDatePlus(startsAt, weeks * 7);
  const busy = create.isPending || propose.isPending;
  const canSubmit = !busy && (!repeat || weekdays.length > 0);

  const changeTo = (href: Href) => router.dismissTo(href);

  const onError = (e: unknown) => {
    const code = getRpcErrorCode(e);
    if (code === 'profile_incomplete') {
      toast.show(errorText(e), 'warning');
      router.push('/onboarding');
    } else if (code === 'invalid_input' && new Date(startsAt).getTime() <= Date.now() + 60_000) {
      toast.show(t('events:create.timePassed'), 'warning');
      router.dismissTo(STEP_PATHS.time);
    } else if (code === 'rate_limited') {
      toast.show(t('events:create.rateLimited'), 'danger');
    } else {
      toast.show(errorText(e), 'danger');
    }
  };

  const submit = () => {
    if (!canSubmit) return;
    if (meeting && draft.matchId) {
      propose.mutate(
        {
          matchId: draft.matchId,
          sportId,
          venueId: venue.id,
          startsAt,
          durationMin: duration,
          note,
        },
        {
          onSuccess: (res) => {
            successHaptic();
            toast.show(t('events:create.proposed'), 'success');
            router.dismissTo({ pathname: '/chat/[id]', params: { id: res.conversation_id } });
          },
          onError,
        },
      );
      return;
    }
    create.mutate(
      {
        sportId,
        venueId: venue.id,
        startsAt,
        durationMin: duration,
        spotsTotal: total,
        spotsReserved: Math.max(0, have - 1),
        level,
        title,
        description,
        repeatWeekdays: repeat ? weekdays : null,
        repeatUntil: repeat ? until : null,
      },
      {
        onSuccess: (res) => {
          successHaptic();
          toast.show(
            repeat ? t('events:create.createdSeries') : t('events:create.created'),
            'success',
          );
          router.replace({ pathname: '/event/[id]', params: { id: res.event_id } });
        },
        onError,
      },
    );
  };

  const toggleWeekday = (d: number) =>
    setWeekdays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
      {/* iOS: the keyboard pushes the footer ("Создать") up and the fields scroll into view. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <StepHeader
            step="details"
            title={
              meeting ? t('events:create.details.titleMeeting') : t('events:create.details.title')
            }
          />

          <Card padded={false}>
            <SummaryRow
              icon={<SportIcon sportId={sportId} size={24} />}
              title={sport}
              changeLabel={t('events:create.change')}
              onChange={steps.includes('sport') ? () => changeTo(STEP_PATHS.sport) : undefined}
            />
            <View style={styles.divider} />
            <SummaryRow
              icon={<Icon name="map-pin" size={22} color="textMuted" />}
              title={venueName(
                {
                  name: venue.name,
                  kind: venue.kind,
                  sportIds: venue.sportIds ?? [sportId],
                  districtKey: venue.districtKey,
                },
                t,
              )}
              changeLabel={t('events:create.change')}
              onChange={steps.includes('venue') ? () => changeTo(STEP_PATHS.venue) : undefined}
            />
            <View style={styles.divider} />
            <SummaryRow
              icon={<Icon name="clock" size={22} color="textMuted" />}
              title={formatEventWhen(startsAt, language)}
              changeLabel={t('events:create.change')}
              onChange={() => changeTo(STEP_PATHS.time)}
            />
          </Card>

          {meeting ? (
            <View style={styles.section}>
              <Text color="textMuted">{t('events:create.details.meetingHint')}</Text>
              <TextField
                label={t('events:create.details.note')}
                value={note}
                onChangeText={setNote}
                placeholder={t('events:create.details.notePlaceholder')}
                maxLength={TEXT_LIMITS.eventDescription}
                multiline
              />
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text variant="heading" accessibilityRole="header">
                  {t('events:create.details.players')}
                </Text>
                <Stepper
                  label={t('events:create.details.total')}
                  value={total}
                  min={EVENT_LIMITS.minSpots}
                  max={EVENT_LIMITS.maxSpots}
                  onChange={(v) => {
                    setTotal(v);
                    if (have > v - 1) setHave(Math.max(1, v - 1));
                  }}
                />
                <Stepper
                  label={t('events:create.details.have')}
                  value={have}
                  min={1}
                  max={Math.max(1, total - 1)}
                  onChange={setHave}
                />
                <View style={styles.need} accessibilityLiveRegion="polite">
                  <Icon name="user-plus" size={18} color="primaryText" />
                  <Text variant="bodyStrong">
                    {need > 0
                      ? t('events:create.details.need', { count: need })
                      : t('events:create.details.needNone')}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text variant="heading" accessibilityRole="header">
                  {t('events:create.details.level')}
                </Text>
                <View
                  style={styles.chips}
                  role="radiogroup"
                  accessibilityLabel={t('events:create.details.level')}
                >
                  <Chip
                    label={levelLabel(null, t)}
                    selected={level === null}
                    selection="radio"
                    onPress={() => setLevel(null)}
                  />
                  {LEVELS.map((l) => (
                    <Chip
                      key={l}
                      label={levelLabel(l, t)}
                      selected={level === l}
                      selection="radio"
                      onPress={() => setLevel(l)}
                    />
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {t('events:create.details.duration')}
            </Text>
            <View
              style={styles.chips}
              role="radiogroup"
              accessibilityLabel={t('events:create.details.duration')}
            >
              {durations.map((d) => (
                <Chip
                  key={d}
                  label={t('events:create.details.minutes', { count: d })}
                  selected={duration === d}
                  selection="radio"
                  onPress={() => setDuration(d)}
                />
              ))}
            </View>
          </View>

          {meeting ? null : (
            <>
              <View style={styles.section}>
                <SwitchRow
                  title={t('events:create.details.repeat')}
                  subtitle={t('events:create.details.repeatHint')}
                  titleVariant="heading"
                  value={repeat}
                  onValueChange={setRepeat}
                  style={styles.switchRow}
                />
                {repeat ? (
                  <>
                    <View
                      style={styles.chips}
                      role="group"
                      accessibilityLabel={t('events:create.details.repeat')}
                    >
                      {WEEKDAYS.map((d) => (
                        <Chip
                          key={d}
                          label={t(`vocab:weekdaysShort.${d}`)}
                          selected={weekdays.includes(d)}
                          onPress={() => toggleWeekday(d)}
                          accessibilityLabel={t(`vocab:weekdays.${d}`)}
                        />
                      ))}
                    </View>
                    {weekdays.length === 0 ? (
                      <Text variant="label" color="danger">
                        {t('events:create.details.pickWeekday')}
                      </Text>
                    ) : null}
                    <Text variant="label" color="textMuted">
                      {t('events:create.details.until')}
                    </Text>
                    <View
                      style={styles.chips}
                      role="radiogroup"
                      accessibilityLabel={t('events:create.details.until')}
                    >
                      {REPEAT_WEEKS.map((w) => (
                        <Chip
                          key={w}
                          label={t('events:create.details.weeks', { count: w })}
                          selected={weeks === w}
                          selection="radio"
                          onPress={() => setWeeks(w)}
                        />
                      ))}
                    </View>
                    <Text variant="label" color="textMuted">
                      {t('events:create.details.untilDate', {
                        date: formatDate(`${until}T12:00:00Z`, language),
                      })}
                    </Text>
                  </>
                ) : null}
              </View>

              {moreOpen ? (
                <View style={styles.section}>
                  <TextField
                    label={t('events:create.details.titleField')}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t('events:create.details.titlePlaceholder')}
                    maxLength={TEXT_LIMITS.eventTitle}
                  />
                  <TextField
                    label={t('events:create.details.description')}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('events:create.details.descriptionPlaceholder')}
                    maxLength={TEXT_LIMITS.eventDescription}
                    multiline
                  />
                </View>
              ) : (
                <Button
                  title={t('events:create.details.addText')}
                  icon="edit-3"
                  variant="ghost"
                  onPress={() => setMoreOpen(true)}
                />
              )}
            </>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.footerInner}>
            <Button
              title={
                meeting ? t('events:create.details.propose') : t('events:create.details.create')
              }
              size="lg"
              fullWidth
              loading={busy}
              disabled={!canSubmit}
              onPress={submit}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
