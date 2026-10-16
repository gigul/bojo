// Organizer marks each going participant "came / didn't come" → submit_attendance (reliability).
import type { ParticipantRow } from '@bojo/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Chip, EmptyState, ErrorState, Skeleton, Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useLanguage } from '@/i18n';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { formatEventWhen } from '@/lib/datetime';
import { useThemedStyles, type Theme } from '@/theme';

import { useEvent, useEventParticipants, useSubmitAttendance } from './api';
import { eventTitle } from './format';
import { useNow } from './useNow';

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
      gap: t.spacing.lg,
    },
    intro: { gap: t.spacing.xs },
    note: {
      flexDirection: 'row',
      gap: t.spacing.md,
      padding: t.spacing.lg,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surfaceAlt,
    },
    noteText: { flex: 1 },
    listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    person: {
      gap: t.spacing.sm,
      paddingVertical: t.spacing.md,
      borderBottomWidth: t.layout.hairline,
      borderBottomColor: t.colors.border,
    },
    personTop: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    marks: { flexDirection: 'row', gap: t.spacing.sm, paddingLeft: 52 },
    footer: {
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.md,
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
    },
    footerInner: { width: '100%', maxWidth: t.layout.maxContentWidth - 40, alignSelf: 'center' },
    skeleton: { padding: t.layout.screenGutter, gap: t.spacing.md },
  });

type Marks = Record<string, boolean>;

function initialMarks(rows: ParticipantRow[] | undefined): Marks {
  const marks: Marks = {};
  for (const p of rows ?? []) if (p.attended !== null) marks[p.user_id] = p.attended;
  return marks;
}

export function AttendanceView({ eventId }: { eventId: string }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'common']);
  const language = useLanguage();
  const { session, isLoading: authLoading } = useAuth();
  const requireAuth = useRequireAuth();
  const now = useNow();
  const event = useEvent(eventId);
  const participants = useEventParticipants(eventId);
  const submit = useSubmitAttendance();
  const [edited, setEdited] = useState<Marks | null>(null);

  const header = <Stack.Screen options={{ title: t('common:screens.attendance') }} />;
  const e = event.data;

  if (!session && !authLoading) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <EmptyState
          icon="check-square"
          title={t('common:states.signInRequired')}
          action={{
            label: t('common:actions.signIn'),
            onPress: () => requireAuth(`/event/${eventId}/attendance`),
          }}
        />
      </SafeAreaView>
    );
  }
  if (event.isPending || participants.isPending) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <View style={styles.skeleton}>
          <Skeleton width="60%" height={24} />
          <Skeleton width="100%" height={72} radius={20} />
          <Skeleton width="100%" height={56} />
          <Skeleton width="100%" height={56} />
        </View>
      </SafeAreaView>
    );
  }
  if (event.isError || !e) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <ErrorState error={event.error} onRetry={() => void event.refetch()} />
      </SafeAreaView>
    );
  }
  if (!e.is_organizer) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <EmptyState icon="lock" title={t('events:attendance.onlyOrganizer')} />
      </SafeAreaView>
    );
  }
  if (!e.attendance_open) {
    const notYet = new Date(e.starts_at).getTime() > now && e.status !== 'cancelled';
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <EmptyState
          icon="clock"
          title={notYet ? t('events:attendance.notYetTitle') : t('events:attendance.closedTitle')}
          message={
            notYet ? t('events:attendance.notYetMessage') : t('events:attendance.closedMessage')
          }
          action={{
            label: t('common:actions.back'),
            onPress: () => router.back(),
            variant: 'secondary',
          }}
        />
      </SafeAreaView>
    );
  }

  const others = (participants.data ?? []).filter((p) => !p.is_organizer && p.status === 'going');
  const marks = edited ?? initialMarks(participants.data);
  const setMark = (userId: string, attended: boolean) =>
    setEdited({ ...marks, [userId]: attended });
  const decided = others.filter((p) => marks[p.user_id] !== undefined);

  const save = () => {
    submit.mutate(
      {
        eventId,
        marks: decided.map((p) => ({ user_id: p.user_id, attended: marks[p.user_id] === true })),
      },
      {
        onSuccess: () => {
          if (router.canGoBack()) router.back();
        },
      },
    );
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.intro}>
          <Text variant="label" color="textMuted">
            {eventTitle(e, t)} · {formatEventWhen(e.starts_at, language)}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {t('events:attendance.title')}
          </Text>
        </View>
        <View style={styles.note}>
          <Icon name="info" size={20} color="textMuted" />
          <Text color="textMuted" style={styles.noteText}>
            {t('events:attendance.explain')}
          </Text>
        </View>

        {others.length === 0 ? (
          <EmptyState icon="users" title={t('events:attendance.nobody')} />
        ) : (
          <View>
            <View style={styles.listHeader}>
              <Text variant="heading" accessibilityRole="header">
                {t('events:attendance.participants', { count: others.length })}
              </Text>
              <Button
                title={t('events:attendance.allCame')}
                variant="ghost"
                onPress={() => setEdited(Object.fromEntries(others.map((p) => [p.user_id, true])))}
              />
            </View>
            {others.map((p) => {
              const mark = marks[p.user_id];
              return (
                <View key={p.user_id} style={styles.person}>
                  <View style={styles.personTop}>
                    <Avatar name={p.display_name} path={p.avatar_path} size={40} />
                    <Text variant="bodyStrong">{p.display_name}</Text>
                  </View>
                  <View
                    style={styles.marks}
                    accessibilityRole="radiogroup"
                    accessibilityLabel={p.display_name}
                  >
                    <Chip
                      label={t('events:attendance.came')}
                      selected={mark === true}
                      selection="radio"
                      onPress={() => setMark(p.user_id, true)}
                      accessibilityLabel={`${p.display_name}: ${t('events:attendance.came')}`}
                    />
                    <Chip
                      label={t('events:attendance.noShow')}
                      selected={mark === false}
                      selection="radio"
                      onPress={() => setMark(p.user_id, false)}
                      accessibilityLabel={`${p.display_name}: ${t('events:attendance.noShow')}`}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      {others.length > 0 ? (
        <View style={styles.footer}>
          <View style={styles.footerInner}>
            <Button
              title={t('events:attendance.save', { count: decided.length })}
              size="lg"
              fullWidth
              disabled={decided.length === 0}
              loading={submit.isPending}
              onPress={save}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
