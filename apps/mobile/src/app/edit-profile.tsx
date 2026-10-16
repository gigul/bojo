import { isDistrictKey, TEXT_LIMITS, type DistrictKey, type ProfileRow, type UserGoal } from '@bojo/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, Screen, Text, TextField, useToast } from '@/components/ui';
import {
  AvailabilityGrid,
  AvatarEditor,
  DistrictPicker,
  GoalPicker,
  HomeAreaControl,
  Section,
  SportLevelPicker,
  SwitchRow,
  useMyAvailability,
  useMyPrivate,
  useMySports,
  useSaveAvailability,
  useSaveSports,
  useUpdateProfile,
  type MySport,
  type ProfilePatch,
} from '@/features/profile';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/errors';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

const MIN_NAME = 2;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { gap: t.spacing.xxl, paddingBottom: t.spacing.xl },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    footer: {
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.md,
      gap: t.spacing.sm,
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
    },
    fields: { gap: t.spacing.lg },
  });

export default function EditProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['profile', 'common']);
  const { session, profile } = useAuth();
  const requireAuth = useRequireAuth();
  const sports = useMySports();
  const availability = useMyAvailability();
  const privateData = useMyPrivate();
  const title = <Stack.Screen options={{ title: t('common:screens.editProfile') }} />;

  if (!session) {
    return (
      <Screen>
        {title}
        <EmptyState
          icon="user"
          title={t('profile:anon.title')}
          action={{ label: t('common:actions.signIn'), onPress: () => requireAuth('/edit-profile') }}
        />
      </Screen>
    );
  }
  if (!profile || sports.isPending || availability.isPending) {
    return (
      <Screen>
        {title}
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.textMuted} accessibilityLabel={t('common:a11y.loading')} />
        </View>
      </Screen>
    );
  }
  return (
    <>
      {title}
      <EditForm
        profile={profile}
        initialSports={sports.data ?? []}
        initialSlots={availability.data ?? []}
        hasHome={privateData.data?.has_home ?? false}
      />
    </>
  );
}

function sameSports(a: readonly MySport[], b: readonly MySport[]) {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((s) => [s.sport_id, s.level]));
  return b.every((s) => map.get(s.sport_id) === s.level);
}

function sameSlots(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((k) => b.includes(k));
}

function EditForm({
  profile,
  initialSports,
  initialSlots,
  hasHome,
}: {
  profile: ProfileRow;
  initialSports: MySport[];
  initialSlots: string[];
  hasHome: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['profile', 'common']);
  const errorText = useErrorText();
  const { show } = useToast();
  const updateProfile = useUpdateProfile();
  const saveSports = useSaveSports();
  const saveSlots = useSaveAvailability();

  const [name, setName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [district, setDistrict] = useState<DistrictKey | null>(
    isDistrictKey(profile.district_key) ? profile.district_key : null,
  );
  const [goal, setGoal] = useState<UserGoal | null>(profile.goal);
  const [discoverable, setDiscoverable] = useState(profile.discoverable);
  const [sports, setSports] = useState<MySport[]>(initialSports);
  const [slots, setSlots] = useState<string[]>(initialSlots);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const patch: ProfilePatch = {};
  if (trimmedName !== profile.display_name) patch.display_name = trimmedName;
  if ((trimmedBio || null) !== (profile.bio ?? null)) patch.bio = trimmedBio || null;
  if (district !== profile.district_key) patch.district_key = district;
  if (goal !== profile.goal) patch.goal = goal;
  if (discoverable !== profile.discoverable) patch.discoverable = discoverable;
  const sportsChanged = !sameSports(sports, initialSports);
  const slotsChanged = !sameSlots(slots, initialSlots);
  const dirty = Object.keys(patch).length > 0 || sportsChanged || slotsChanged;
  const nameError = trimmedName.length < MIN_NAME ? t('profile:edit.nameTooShort', { count: MIN_NAME }) : null;
  const sportsError = sports.length === 0 ? t('profile:edit.sportsRequired') : null;

  const onSave = async () => {
    if (nameError || sportsError) {
      setError(nameError ?? sportsError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (Object.keys(patch).length > 0) await updateProfile.mutateAsync(patch);
      if (sportsChanged) await saveSports.mutateAsync(sports);
      if (slotsChanged) await saveSlots.mutateAsync(slots);
      show(t('profile:edit.saved'), 'success');
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
      <Screen scroll edges={[]}>
        <View style={styles.content}>
          <Section title={t('profile:edit.photoAndName')}>
            <View style={styles.fields}>
              <AvatarEditor name={trimmedName} />
              <TextField
                label={t('profile:edit.name')}
                value={name}
                onChangeText={setName}
                maxLength={TEXT_LIMITS.displayName}
                autoComplete="given-name"
                autoCapitalize="words"
                error={name.length > 0 ? nameError : null}
                hint={t('profile:edit.counter', { count: name.length, max: TEXT_LIMITS.displayName })}
                testID="edit-name"
              />
              <TextField
                label={t('profile:edit.bio')}
                value={bio}
                onChangeText={setBio}
                placeholder={t('profile:edit.bioPlaceholder')}
                maxLength={TEXT_LIMITS.bio}
                multiline
                hint={t('profile:edit.counter', { count: bio.length, max: TEXT_LIMITS.bio })}
                testID="edit-bio"
              />
            </View>
          </Section>

          <Section title={t('profile:sections.sports')} subtitle={t('profile:edit.sportsHint')}>
            <SportLevelPicker value={sports} onChange={setSports} />
          </Section>

          <Section title={t('profile:sections.availability')} subtitle={t('profile:edit.availabilityHint')}>
            <AvailabilityGrid value={slots} onChange={setSlots} />
          </Section>

          <Section title={t('profile:edit.district')} subtitle={t('profile:edit.districtHint')}>
            <DistrictPicker value={district} onChange={setDistrict} />
          </Section>

          <HomeAreaControl
            hasHome={hasHome}
            allowClear
            onDetected={(d) => {
              if (d) setDistrict(d);
            }}
          />

          <Section title={t('profile:edit.goal')}>
            <GoalPicker value={goal} onChange={setGoal} />
          </Section>

          <Section title={t('profile:edit.matching')} card padded={false}>
            <SwitchRow
              title={t('profile:edit.discoverable')}
              subtitle={t('profile:edit.discoverableHint')}
              value={discoverable}
              onValueChange={setDiscoverable}
              testID="edit-discoverable"
            />
          </Section>
        </View>
      </Screen>
      <View style={styles.footer}>
        {error ? (
          <Text variant="label" color="danger" role="alert" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          title={t('common:actions.save')}
          onPress={() => void onSave()}
          size="lg"
          fullWidth
          disabled={!dirty}
          loading={saving}
          testID="edit-save"
        />
      </View>
    </SafeAreaView>
  );
}
