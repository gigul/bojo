import { isSportId, type CandidateRow, type ProfileRow } from '@bojo/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  Screen,
  Text,
  useToast,
} from '@/components/ui';
import {
  MatchModal,
  openMatchChat,
  PersonCard,
  proposeMeeting,
  SwipeDeck,
  useArrowKeys,
  useCandidates,
  useSwipe,
  type MatchInfo,
  type SwipeDeckHandle,
  type SwipeDirection,
} from '@/features/people';
import { useMySports } from '@/features/profile';
import { Icon, SportIcon } from '@/icons';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { getRpcErrorCode, useErrorText } from '@/lib/errors';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

/** Refetch more candidates when this many cards are left. */
const PREFETCH_AT = 3;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: t.layout.screenGutter, paddingTop: t.spacing.sm, gap: 2 },
    column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
    filters: { flexGrow: 0 },
    filtersContent: {
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.md,
    },
    deckArea: { flex: 1, paddingHorizontal: t.layout.screenGutter, paddingTop: t.spacing.xs },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xxl,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.md,
    },
    control: { alignItems: 'center', gap: t.spacing.xs },
    round: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius.pill,
    },
    pass: {
      width: 60,
      height: 60,
      backgroundColor: t.colors.surface,
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    like: { width: 72, height: 72, backgroundColor: t.colors.primary },
    pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
    disabled: { opacity: 0.4 },
    hint: { textAlign: 'center', paddingBottom: t.spacing.sm },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      marginHorizontal: t.layout.screenGutter,
      marginBottom: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceAlt,
    },
    noticeText: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyActions: { gap: t.spacing.sm, alignItems: 'center' },
    filtersSpacer: { height: t.spacing.md },
  });

export default function PeopleTabScreen() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['people', 'common']);
  const { session, profile, isLoading } = useAuth();
  const requireAuth = useRequireAuth();

  if (!session) {
    return (
      <Screen edges={['top', 'left', 'right']} padded={false}>
        <Header />
        <EmptyState
          icon="users"
          title={t('people:anon.title')}
          message={t('people:anon.message')}
          action={{ label: t('common:actions.signIn'), onPress: () => requireAuth('/people') }}
        />
      </Screen>
    );
  }
  if (isLoading || !profile) {
    return (
      <Screen edges={['top', 'left', 'right']} padded={false}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator
            color={theme.colors.textMuted}
            accessibilityLabel={t('common:a11y.loading')}
          />
        </View>
      </Screen>
    );
  }
  if (!profile.onboarded_at) {
    return (
      <Screen edges={['top', 'left', 'right']} padded={false}>
        <Header />
        <EmptyState
          icon="user-plus"
          title={t('people:incomplete.title')}
          message={t('people:incomplete.message')}
          action={{
            label: t('people:incomplete.action'),
            onPress: () => router.push('/onboarding'),
          }}
        />
      </Screen>
    );
  }
  return <Deck profile={profile} />;
}

function Header() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['people', 'common']);
  return (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header">
        {t('common:screens.people')}
      </Text>
      <Text variant="label" color="textMuted">
        {t('people:subtitle')}
      </Text>
    </View>
  );
}

function Deck({ profile }: { profile: ProfileRow }) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['people', 'common', 'vocab']);
  const { show } = useToast();
  const errorText = useErrorText();
  const mySports = useMySports();
  const [sportId, setSportId] = useState<string | null>(null);
  const candidates = useCandidates(sportId);
  const swipe = useSwipe();
  const [swiped, setSwiped] = useState<ReadonlySet<string>>(() => new Set());
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const deck = useRef<SwipeDeckHandle>(null);

  const queue = (candidates.data ?? []).filter((c) => !swiped.has(c.user_id));
  const top = queue[0];

  useArrowKeys({
    enabled: match === null && queue.length > 0,
    left: () => deck.current?.swipe('left'),
    right: () => deck.current?.swipe('right'),
  });

  const onSwiped = (person: CandidateRow, direction: SwipeDirection) => {
    const liked = direction === 'right';
    const remaining = queue.length - 1;
    setSwiped((prev) => new Set(prev).add(person.user_id));
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
    const sport = sportId ?? person.common_sport_ids[0] ?? null;
    // mutateAsync: every swipe gets its own result (fast consecutive swipes must not lose a match).
    swipe
      .mutateAsync({ targetId: person.user_id, liked, sportId: sport })
      .then((result) => {
        if (!result.match_id) return;
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined,
          );
        }
        setMatch({
          matchId: result.match_id,
          conversationId: result.conversation_id,
          otherName: person.display_name,
          otherAvatarPath: person.avatar_path,
          sportId: sport,
        });
      })
      .catch((e: unknown) => show(errorText(e), 'danger'))
      .finally(() => {
        if (remaining <= PREFETCH_AT) void candidates.refetch();
      });
  };

  const sportFilters = (mySports.data ?? []).map((s) => s.sport_id);
  const errorCode = candidates.error ? getRpcErrorCode(candidates.error) : null;

  let body: React.ReactNode;
  if (candidates.isPending) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator
          color={theme.colors.textMuted}
          accessibilityLabel={t('common:a11y.loading')}
        />
      </View>
    );
  } else if (errorCode === 'profile_incomplete') {
    body = (
      <EmptyState
        icon="user-plus"
        title={t('people:incomplete.title')}
        message={t('people:incomplete.messageSports')}
        action={{ label: t('people:incomplete.edit'), onPress: () => router.push('/edit-profile') }}
      />
    );
  } else if (candidates.error && queue.length === 0) {
    body = <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />;
  } else if (queue.length === 0) {
    body = candidates.isFetching ? (
      <View style={styles.center}>
        <ActivityIndicator
          color={theme.colors.textMuted}
          accessibilityLabel={t('common:a11y.loading')}
        />
      </View>
    ) : (
      <EmptyState
        icon="users"
        title={t('people:empty.title')}
        message={sportId ? t('people:empty.messageSport') : t('people:empty.message')}
        action={
          <View style={styles.emptyActions}>
            <Button
              title={t('people:empty.events')}
              icon="calendar"
              onPress={() => router.push('/events')}
            />
            {sportId ? (
              <Button
                title={t('people:empty.allSports')}
                variant="ghost"
                onPress={() => setSportId(null)}
              />
            ) : (
              <Button
                title={t('people:empty.refresh')}
                variant="ghost"
                onPress={() => void candidates.refetch()}
              />
            )}
          </View>
        }
      />
    );
  } else {
    body = (
      <>
        <View style={styles.deckArea}>
          <SwipeDeck
            ref={deck}
            items={queue}
            keyOf={(c) => c.user_id}
            onSwiped={onSwiped}
            likeLabel={t('people:actions.like')}
            passLabel={t('people:actions.pass')}
            renderItem={(person) => (
              <PersonCard
                person={person}
                myDistrict={profile.district_key}
                myGoal={profile.goal}
                onOpen={() =>
                  router.push({ pathname: '/person/[id]', params: { id: person.user_id } })
                }
              />
            )}
          />
        </View>
        <View style={styles.controls}>
          <View style={styles.control}>
            <Pressable
              onPress={() => deck.current?.swipe('left')}
              disabled={!top}
              accessibilityRole="button"
              accessibilityLabel={
                top
                  ? t('people:actions.passA11y', { name: top.display_name })
                  : t('people:actions.pass')
              }
              testID="deck-pass"
              style={({ pressed }) => [styles.round, styles.pass, pressed ? styles.pressed : null]}
            >
              <Icon name="x" size={28} color="text" />
            </Pressable>
            <Text variant="caption" color="textMuted" aria-hidden>
              {t('people:actions.pass')}
            </Text>
          </View>
          <View style={styles.control}>
            <Pressable
              onPress={() => deck.current?.swipe('right')}
              disabled={!top}
              accessibilityRole="button"
              accessibilityLabel={
                top
                  ? t('people:actions.likeA11y', { name: top.display_name })
                  : t('people:actions.like')
              }
              testID="deck-like"
              style={({ pressed }) => [styles.round, styles.like, pressed ? styles.pressed : null]}
            >
              <Icon name="check" size={32} color={theme.colors.onPrimary} />
            </Pressable>
            <Text variant="caption" color="textMuted" aria-hidden>
              {t('people:actions.like')}
            </Text>
          </View>
        </View>
        {Platform.OS === 'web' ? (
          <Text variant="caption" color="textMuted" style={styles.hint}>
            {t('people:keyboardHint')}
          </Text>
        ) : null}
      </>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']} padded={false}>
      <View style={styles.column}>
        <Header />
        {sportFilters.length > 1 ? (
          <ChipRow
            style={styles.filters}
            contentContainerStyle={styles.filtersContent}
            role="radiogroup"
            accessibilityLabel={t('people:filters.label')}
          >
            <Chip
              label={t('people:filters.all')}
              selected={sportId === null}
              selection="radio"
              onPress={() => setSportId(null)}
              testID="people-filter-all"
            />
            {sportFilters.map((id) => (
              <Chip
                key={id}
                label={isSportId(id) ? t(`vocab:sports.${id}`) : id}
                selected={sportId === id}
                selection="radio"
                onPress={() => setSportId(sportId === id ? null : id)}
                icon={({ color, size }) => <SportIcon sportId={id} size={size + 2} color={color} />}
                testID={`people-filter-${id}`}
              />
            ))}
          </ChipRow>
        ) : (
          <View style={styles.filtersSpacer} />
        )}
        {!profile.discoverable ? (
          <Pressable
            style={styles.notice}
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            accessibilityHint={t('people:hidden.hint')}
          >
            <Icon name="eye-off" size={16} color="textMuted" />
            <Text variant="label" style={styles.noticeText}>
              {t('people:hidden.text')}
            </Text>
            <Icon name="chevron-right" size={16} color="textMuted" />
          </Pressable>
        ) : null}
        {body}
      </View>
      <MatchModal
        match={match}
        myName={profile.display_name}
        myAvatarPath={profile.avatar_path}
        onClose={() => setMatch(null)}
        onWrite={(m) => {
          setMatch(null);
          if (m.conversationId) openMatchChat(m.conversationId);
        }}
        onPropose={(m) => {
          setMatch(null);
          proposeMeeting(m.matchId, m.sportId);
        }}
      />
    </Screen>
  );
}
