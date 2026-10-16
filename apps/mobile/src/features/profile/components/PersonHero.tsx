import { isDistrictKey, type UserGoal } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar, Text } from '@/components/ui';
import { Icon } from '@/icons';
import { formatApproxDistance } from '@/lib/format';
import { useThemedStyles, type Theme } from '@/theme';

import { VerifiedBadge } from './VerifiedBadge';

/**
 * "Мокотув · ~2 км". Another user's location is NEVER shown beyond the district and the bucketed
 * server-side distance (§8).
 */
export function useLocationLine(districtKey: string | null, distanceKm: number | null): string {
  const { t } = useTranslation('vocab');
  const parts: string[] = [];
  if (isDistrictKey(districtKey)) parts.push(t(`districts.${districtKey}`));
  const distance = formatApproxDistance(distanceKm, t);
  if (distance) parts.push(distance);
  return parts.join(' · ');
}

export interface PersonHeroProps {
  name: string;
  avatarPath: string | null;
  isVerified: boolean;
  districtKey: string | null;
  distanceKm?: number | null;
  goal: UserGoal | null;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { alignItems: 'center', gap: t.spacing.sm, paddingTop: t.spacing.sm },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
      maxWidth: '100%',
    },
    name: { flexShrink: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
    goal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: t.spacing.md,
      minHeight: 30,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surfaceAlt,
    },
  });

/** Centered identity block for the profile and person screens. */
export function PersonHero({ name, avatarPath, isVerified, districtKey, distanceKm = null, goal }: PersonHeroProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['profile', 'vocab']);
  const location = useLocationLine(districtKey, distanceKm);
  return (
    <View style={styles.root}>
      <Avatar path={avatarPath} name={name || '?'} size={112} />
      <View style={styles.nameRow}>
        <Text variant="title" accessibilityRole="header" numberOfLines={2} style={styles.name} align="center">
          {name}
        </Text>
        {isVerified ? <VerifiedBadge compact size={20} /> : null}
      </View>
      {location ? (
        <View style={styles.metaRow}>
          <Icon name="map-pin" size={15} color="textMuted" />
          <Text color="textMuted">{location}</Text>
        </View>
      ) : null}
      {goal ? (
        <View style={styles.goal}>
          <Icon name="target" size={14} color="textMuted" />
          <Text variant="label">{t('profile:goalLine', { goal: t(`vocab:goals.${goal}`) })}</Text>
        </View>
      ) : null}
    </View>
  );
}
