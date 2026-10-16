import type { ParticipantRow } from '@bojo/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Badge, IconButton, Skeleton, Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

import { levelLabel } from '../format';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
      minHeight: 56,
    },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 48 },
    pressed: { opacity: 0.7 },
    text: { flex: 1, minWidth: 0, gap: 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    skeleton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    skeletonText: { flex: 1, gap: 6 },
  });

export interface ParticipantsListProps {
  rows: ParticipantRow[] | undefined;
  loading: boolean;
  /** The viewer is the organizer → can remove others. */
  canRemove: boolean;
  meId: string | null;
  onRemove: (p: ParticipantRow) => void;
}

/** Going (+ invited for the organizer) participants; blocked users are already hidden by the server. */
export function ParticipantsList({
  rows,
  loading,
  canRemove,
  meId,
  onRemove,
}: ParticipantsListProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('events');

  if (loading) {
    return (
      <View>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeleton}>
            <Skeleton width={40} height={40} radius={20} />
            <View style={styles.skeletonText}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="30%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      {(rows ?? []).map((p) => {
        const isMe = p.user_id === meId;
        const details = [
          p.level != null ? levelLabel(p.level, t) : null,
          p.reliability_score != null
            ? t('detail.reliability', { value: p.reliability_score })
            : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const name = isMe ? t('detail.you', { name: p.display_name }) : p.display_name;
        return (
          <View key={p.user_id} style={styles.row}>
            <Pressable
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.user_id } })}
              accessibilityRole="button"
              accessibilityLabel={[
                name,
                p.is_organizer ? t('detail.organizerBadge') : null,
                p.status === 'invited' ? t('status.invited') : null,
                p.is_verified ? t('detail.verified') : null,
                details,
              ]
                .filter(Boolean)
                .join(', ')}
              style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
            >
              <Avatar name={p.display_name} path={p.avatar_path} size={40} />
              <View style={styles.text}>
                <View style={styles.nameRow}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {name}
                  </Text>
                  {p.is_verified ? (
                    <Icon name="check-circle" size={14} color="primaryText" />
                  ) : null}
                  {p.is_organizer ? <Badge label={t('detail.organizerBadge')} /> : null}
                  {p.status === 'invited' ? (
                    <Badge label={t('status.invited')} icon="mail" />
                  ) : null}
                </View>
                {details ? (
                  <Text variant="label" color="textMuted" numberOfLines={1}>
                    {details}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            {canRemove && !p.is_organizer && !isMe ? (
              <IconButton
                icon="user-x"
                color="textMuted"
                onPress={() => onRemove(p)}
                accessibilityLabel={t('detail.removeA11y', { name: p.display_name })}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
