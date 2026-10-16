import { isLevel, levelCloseness, type PersonSummaryRow } from '@bojo/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, ListItem, Screen, Text, useToast } from '@/components/ui';
import {
  CommonSlotsLine,
  MatchModal,
  openMatchChat,
  proposeMeeting,
  useMyLike,
  usePersonSummary,
  useSwipe,
  WhyChips,
  whyReasons,
  type MatchInfo,
} from '@/features/people';
import {
  Divider,
  PersonHero,
  ReliabilityInline,
  Section,
  SportLevelTags,
  useMySports,
} from '@/features/profile';
import { ReportSheet, useBlockUserWithConfirm } from '@/features/safety';
import { Icon } from '@/icons';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { getRpcErrorCode, useErrorText } from '@/lib/errors';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    content: { gap: t.spacing.xl, paddingBottom: t.spacing.xxl },
    actions: { gap: t.spacing.sm },
    stats: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: t.spacing.lg,
      marginTop: -t.spacing.sm,
    },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pending: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceAlt,
    },
    pendingText: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });

export default function PersonScreen() {
  const { t } = useTranslation(['people', 'common']);
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { session } = useAuth();
  const requireAuth = useRequireAuth();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const person = usePersonSummary(id);
  const title = <Stack.Screen options={{ title: t('common:screens.person') }} />;

  if (!session) {
    return (
      <Screen>
        {title}
        <EmptyState
          icon="user"
          title={t('common:states.signInRequired')}
          message={t('people:person.signIn')}
          action={{ label: t('common:actions.signIn'), onPress: () => requireAuth() }}
        />
      </Screen>
    );
  }
  if (person.isPending) {
    return (
      <Screen>
        {title}
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.textMuted} accessibilityLabel={t('common:a11y.loading')} />
        </View>
      </Screen>
    );
  }
  if (person.error) {
    const notFound = getRpcErrorCode(person.error) === 'not_found' || person.error.message === 'not_found';
    return (
      <Screen>
        {title}
        {notFound ? (
          <EmptyState
            icon="user-x"
            title={t('people:person.unavailable')}
            message={t('people:person.unavailableText')}
            action={{
              label: t('common:actions.back'),
              variant: 'secondary',
              onPress: () => (router.canGoBack() ? router.back() : router.replace('/people')),
            }}
          />
        ) : (
          <ErrorState error={person.error} onRetry={() => void person.refetch()} />
        )}
      </Screen>
    );
  }
  return (
    <>
      {title}
      <PersonDetails person={person.data} />
    </>
  );
}

function PersonDetails({ person }: { person: PersonSummaryRow }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['people', 'safety', 'common']);
  const { profile } = useAuth();
  const { show } = useToast();
  const errorText = useErrorText();
  const mySports = useMySports();
  const myLike = useMyLike(person.is_me ? undefined : person.user_id);
  const swipe = useSwipe();
  const { requestBlock, dialog, isPending: blocking } = useBlockUserWithConfirm();
  const [reportOpen, setReportOpen] = useState(false);
  const [match, setMatch] = useState<MatchInfo | null>(null);

  // Level closeness over common sports (same formula as the server score).
  const myLevels = new Map((mySports.data ?? []).map((s) => [s.sport_id as string, s.level]));
  const pairs: [number, number][] = [];
  person.sport_ids.forEach((sid, i) => {
    const theirs = person.sport_levels[i];
    const mine = myLevels.get(sid);
    if (mine !== undefined && isLevel(theirs)) pairs.push([mine, theirs]);
  });
  const reasons = person.is_me
    ? []
    : whyReasons({
        levelCloseness: pairs.length > 0 ? levelCloseness(pairs) : null,
        distanceKm: person.distance_km_approx,
        sameDistrict: profile?.district_key != null && profile.district_key === person.district_key,
        commonSlotsCount: person.common_slots.length,
        commonSportsCount: person.common_sport_ids.length,
        sameGoal: profile?.goal != null && profile.goal === person.goal,
      });
  const sportForMeeting = person.common_sport_ids[0] ?? person.sport_ids[0] ?? null;

  const like = () => {
    swipe
      .mutateAsync({ targetId: person.user_id, liked: true, sportId: sportForMeeting })
      .then((result) => {
        if (result.match_id) {
          setMatch({
            matchId: result.match_id,
            conversationId: result.conversation_id,
            otherName: person.display_name,
            otherAvatarPath: person.avatar_path,
            sportId: sportForMeeting,
          });
        } else {
          show(t('people:person.likeSent', { name: person.display_name }), 'success');
        }
      })
      .catch((e: unknown) =>
        show(getRpcErrorCode(e) === 'not_found' ? t('people:person.notInPool') : errorText(e), 'danger'),
      );
  };

  const block = async () => {
    const done = await requestBlock(person.user_id, person.display_name);
    if (done) {
      if (router.canGoBack()) router.back();
      else router.replace('/people');
    }
  };

  return (
    <Screen scroll>
      <View style={styles.content}>
        <PersonHero
          name={person.display_name}
          avatarPath={person.avatar_path}
          isVerified={person.is_verified}
          districtKey={person.district_key}
          distanceKm={person.is_me ? null : person.distance_km_approx}
          goal={person.goal}
        />

        {person.reliability_score !== null || person.attended_count > 0 ? (
          <View style={styles.stats}>
            <ReliabilityInline score={person.reliability_score} />
            {person.attended_count > 0 ? (
              <View style={styles.stat}>
                <Icon name="check-square" size={15} color="textMuted" />
                <Text variant="label" color="textMuted">
                  {t('people:person.attended', { count: person.attended_count })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {person.is_me ? (
          <Button
            title={t('people:person.editMine')}
            icon="edit-2"
            variant="secondary"
            onPress={() => router.push('/edit-profile')}
          />
        ) : person.match_id ? (
          <View style={styles.actions}>
            <Button
              title={t('people:match.write')}
              icon="message-circle"
              size="lg"
              fullWidth
              onPress={() => person.conversation_id && openMatchChat(person.conversation_id)}
              disabled={!person.conversation_id}
              testID="person-write"
            />
            <Button
              title={t('people:match.propose')}
              icon="calendar"
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => person.match_id && proposeMeeting(person.match_id, sportForMeeting)}
              testID="person-propose"
            />
          </View>
        ) : myLike.data ? (
          <View style={styles.pending} accessible>
            <Icon name="clock" size={18} color="textMuted" />
            <Text variant="label" style={styles.pendingText}>
              {t('people:person.waiting', { name: person.display_name })}
            </Text>
          </View>
        ) : (
          <Button
            title={t('people:actions.like')}
            icon="check"
            size="lg"
            fullWidth
            onPress={like}
            loading={swipe.isPending}
            testID="person-like"
          />
        )}

        {reasons.length > 0 ? (
          <Section title={t('people:person.why')}>
            <WhyChips reasons={reasons} />
          </Section>
        ) : null}

        <Section title={t('people:person.sports')}>
          <SportLevelTags
            sportIds={person.sport_ids}
            levels={person.sport_levels}
            commonSportIds={person.is_me ? [] : person.common_sport_ids}
            commonFirst
          />
        </Section>

        {!person.is_me && person.common_slots.length > 0 ? (
          <Section title={t('people:person.time')}>
            <CommonSlotsLine slots={person.common_slots} numberOfLines={3} />
          </Section>
        ) : null}

        {person.bio ? (
          <Section title={t('people:person.about')}>
            <Text>{person.bio}</Text>
          </Section>
        ) : null}

        {!person.is_me ? (
          <Section card padded={false}>
            <ListItem
              title={t('safety:report.action')}
              left={<Icon name="flag" size={20} color="danger" />}
              onPress={() => setReportOpen(true)}
              right={null}
              testID="person-report"
            />
            <Divider />
            <ListItem
              title={t('safety:block.action')}
              subtitle={t('people:person.blockHint')}
              left={<Icon name="slash" size={20} color="danger" />}
              onPress={() => void block()}
              disabled={blocking}
              right={null}
              testID="person-block"
            />
          </Section>
        ) : null}
      </View>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId={person.user_id}
      />
      {dialog}
      <MatchModal
        match={match}
        myName={profile?.display_name ?? ''}
        myAvatarPath={profile?.avatar_path ?? null}
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
