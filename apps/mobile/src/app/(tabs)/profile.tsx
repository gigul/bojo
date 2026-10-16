import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, EmptyState, IconButton, ListItem, Screen, Skeleton, Text } from '@/components/ui';
import {
  Divider,
  PersonHero,
  ReliabilityBlock,
  Section,
  SportLevelTags,
  summarizeSlots,
  useMyAvailability,
  useMySports,
} from '@/features/profile';
import { Icon, SportIcon } from '@/icons';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: t.spacing.sm,
      marginRight: -t.spacing.sm,
    },
    content: { gap: t.spacing.xl, paddingBottom: t.spacing.xxl },
    actions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: t.spacing.sm,
      flexWrap: 'wrap',
    },
    note: {
      flexDirection: 'row',
      gap: t.spacing.md,
      alignItems: 'flex-start',
      padding: t.spacing.lg,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surfaceAlt,
    },
    noteText: { flex: 1, gap: 2 },
    skeleton: { alignItems: 'center', gap: t.spacing.md, paddingTop: t.spacing.xl },
  });

export default function ProfileTabScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['profile', 'common']);
  const { session, profile, isLoading } = useAuth();
  const requireAuth = useRequireAuth();

  if (!session) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Text variant="title" accessibilityRole="header" style={styles.header}>
          {t('common:screens.profile')}
        </Text>
        <EmptyState
          icon="user"
          title={t('profile:anon.title')}
          message={t('profile:anon.message')}
          action={{ label: t('common:actions.signIn'), onPress: () => requireAuth('/profile') }}
        />
      </Screen>
    );
  }

  if (isLoading || !profile) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <View style={styles.skeleton} accessibilityLabel={t('common:a11y.loading')}>
          <Skeleton width={112} height={112} radius={56} />
          <Skeleton width={180} height={24} />
          <Skeleton width={140} height={16} />
        </View>
      </Screen>
    );
  }

  return <OwnProfile />;
}

function OwnProfile() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['profile', 'common']);
  const { profile, refreshProfile } = useAuth();
  const sports = useMySports();
  const availability = useMyAvailability();
  const [refreshing, setRefreshing] = useState(false);

  if (!profile) return null;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), sports.refetch(), availability.refetch()]);
    setRefreshing(false);
  };

  const slots = availability.data ?? [];
  const slotsText = summarizeSlots(slots, t);
  const mySports = sports.data ?? [];

  return (
    <Screen
      scroll
      edges={['top', 'left', 'right']}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.textMuted}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {t('common:screens.profile')}
          </Text>
          <IconButton
            icon="settings"
            onPress={() => router.push('/settings')}
            accessibilityLabel={t('common:screens.settings')}
            testID="open-settings"
          />
        </View>

        <PersonHero
          name={profile.display_name}
          avatarPath={profile.avatar_path}
          isVerified={profile.is_verified}
          districtKey={profile.district_key}
          goal={profile.goal}
        />

        <View style={styles.actions}>
          <Button
            title={t('profile:actions.edit')}
            icon="edit-2"
            variant="secondary"
            onPress={() => router.push('/edit-profile')}
            testID="edit-profile"
          />
        </View>

        <Section title={t('profile:sections.reliability')} card>
          <ReliabilityBlock
            score={profile.reliability_score}
            attended={profile.attended_count}
            noShow={profile.no_show_count}
          />
        </Section>

        <Section title={t('profile:sections.sports')}>
          {sports.isPending ? (
            <Skeleton width="70%" height={36} radius={18} />
          ) : mySports.length > 0 ? (
            <SportLevelTags
              sportIds={mySports.map((s) => s.sport_id)}
              levels={mySports.map((s) => s.level)}
            />
          ) : (
            <Text color="textMuted">{t('profile:empty.sports')}</Text>
          )}
        </Section>

        <Section title={t('profile:sections.availability')}>
          <Text color={slotsText ? 'text' : 'textMuted'}>
            {slotsText || t('profile:empty.availability')}
          </Text>
        </Section>

        {profile.bio ? (
          <Section title={t('profile:sections.about')}>
            <Text>{profile.bio}</Text>
          </Section>
        ) : null}

        {!profile.is_verified ? (
          <View style={styles.note}>
            <Icon name="check-circle" size={18} color="textMuted" />
            <View style={styles.noteText}>
              <Text variant="bodyStrong">{t('profile:verified.howTitle')}</Text>
              <Text variant="label" color="textMuted">
                {t('profile:verified.howText')}
              </Text>
            </View>
          </View>
        ) : null}

        {!profile.discoverable ? (
          <View style={styles.note}>
            <Icon name="eye-off" size={18} color="textMuted" />
            <View style={styles.noteText}>
              <Text variant="bodyStrong">{t('profile:hidden.title')}</Text>
              <Text variant="label" color="textMuted">
                {t('profile:hidden.text')}
              </Text>
            </View>
          </View>
        ) : null}

        <Section card padded={false}>
          <ListItem
            title={t('profile:links.runs')}
            subtitle={t('profile:links.runsHint')}
            left={<SportIcon sportId="running" size={24} />}
            onPress={() => router.push('/runs')}
            testID="open-runs"
          />
          <Divider />
          <ListItem
            title={t('common:screens.settings')}
            subtitle={t('profile:links.settingsHint')}
            left={<Icon name="settings" size={22} />}
            onPress={() => router.push('/settings')}
          />
        </Section>
      </View>
    </Screen>
  );
}
