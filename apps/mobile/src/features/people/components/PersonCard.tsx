import { BUCKETS, type CandidateRow, type UserGoal } from '@bojo/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { ReliabilityInline, SportLevelTags, useLocationLine, VerifiedBadge } from '@/features/profile';
import { Icon, SportIcon } from '@/icons';
import { publicUrl } from '@/lib/storage';
import { useReduceMotion, useThemedStyles, type Theme } from '@/theme';

import { whyReasons } from '../why';
import { CommonSlotsLine, WhyChips } from './Facts';

export interface PersonCardProps {
  person: CandidateRow;
  /** Viewer's district / goal, for the "why" chips. */
  myDistrict: string | null;
  myGoal: UserGoal | null;
  onOpen?: () => void;
}

/** Big-card initials from words that start with a letter ("[DEV] Anna" → "A"). */
function cardInitials(name: string): string {
  const isLetter = (ch: string) => ch.toLowerCase() !== ch.toUpperCase();
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => isLetter(Array.from(w)[0] ?? ''));
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toLocaleUpperCase();
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.xl,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    photo: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 160,
      minHeight: 120,
      maxHeight: 340,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: { fontSize: 64, lineHeight: 72 },
    sportMark: { position: 'absolute', left: t.spacing.lg, bottom: t.spacing.lg, flexDirection: 'row', gap: 6 },
    info: { position: 'absolute', top: t.spacing.sm, right: t.spacing.sm },
    body: { padding: t.spacing.lg, paddingTop: t.spacing.md, gap: t.spacing.sm + 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    name: { flexShrink: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: t.colors.textMuted },
  });

/** Swipe card: who, where (district + ~km only), sports with level, schedule overlap, why. */
export function PersonCard({ person, myDistrict, myGoal, onOpen }: PersonCardProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['people', 'vocab']);
  const reduceMotion = useReduceMotion();
  const [failed, setFailed] = useState(false);
  const location = useLocationLine(person.district_key, person.distance_km_approx);
  const reasons = whyReasons({
    levelCloseness: person.score_level,
    distanceKm: person.distance_km_approx,
    sameDistrict: myDistrict !== null && person.district_key === myDistrict,
    commonSlotsCount: person.common_slots.length,
    scheduleScore: person.score_schedule,
    commonSportsCount: person.common_sport_ids.length,
    sportScore: person.score_sport,
    sameGoal: myGoal !== null && person.goal === myGoal,
  });
  const showPhoto = Boolean(person.avatar_path) && !failed;

  return (
    <View style={styles.card}>
      <View style={styles.photo}>
        {showPhoto && person.avatar_path ? (
          <Image
            source={{ uri: publicUrl(BUCKETS.avatars, person.avatar_path) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={reduceMotion ? 0 : 150}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text variant="display" color="textMuted" style={styles.initials} aria-hidden>
            {cardInitials(person.display_name) || '?'}
          </Text>
        )}
        {!showPhoto ? (
          <View style={styles.sportMark} aria-hidden>
            {person.common_sport_ids.slice(0, 3).map((id) => (
              <SportIcon key={id} sportId={id} size={22} color="textMuted" />
            ))}
          </View>
        ) : null}
        {onOpen ? (
          <IconButton
            icon="info"
            variant="surface"
            onPress={onOpen}
            accessibilityLabel={t('people:card.open', { name: person.display_name })}
            style={styles.info}
            testID="person-card-open"
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text variant="title" numberOfLines={1} style={styles.name}>
            {person.display_name}
          </Text>
          {person.is_verified ? <VerifiedBadge compact /> : null}
        </View>

        {location || person.goal ? (
          <View style={styles.metaRow}>
            {location ? (
              <>
                <Icon name="map-pin" size={14} color="textMuted" />
                <Text variant="label" color="textMuted">
                  {location}
                </Text>
              </>
            ) : null}
            {location && person.goal ? <View style={styles.dot} /> : null}
            {person.goal ? (
              <Text variant="label" color="textMuted">
                {t(`vocab:goals.${person.goal}`)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <SportLevelTags
          sportIds={person.sport_ids}
          levels={person.sport_levels}
          commonSportIds={person.common_sport_ids}
          commonFirst
          max={3}
        />

        <CommonSlotsLine slots={person.common_slots} />
        <ReliabilityInline score={person.reliability_score} />
        <WhyChips reasons={reasons} />

        {person.bio ? (
          <Text color="textMuted" numberOfLines={2}>
            {person.bio}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
