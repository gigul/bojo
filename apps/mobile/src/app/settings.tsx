import { NOTIFY_RADIUS_KM, OSM_ATTRIBUTION, OSM_COPYRIGHT_URL } from '@bojo/shared';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  ListItem,
  Screen,
  Segmented,
  Stepper,
  Text,
  useToast,
} from '@/components/ui';
import { Divider, Section, SwitchRow, useDeleteAccount, useMyPrivate, useUpdatePrivate } from '@/features/profile';
import { useBlockedUsers, useBlockUser, useConfirmDialog } from '@/features/safety';
import { setLanguage, SUPPORTED_LANGUAGES, useLanguage, type Language } from '@/i18n';
import { Icon } from '@/icons';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/errors';
import { useTheme, useThemedStyles, useThemeMode, type Theme, type ThemeMode } from '@/theme';

const OPENFREEMAP_URL = 'https://openfreemap.org';
const RADIUS_SAVE_DELAY_MS = 600;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    content: { gap: t.spacing.xxl, paddingBottom: t.spacing.xxl },
    field: { gap: t.spacing.sm },
    hint: { marginTop: -t.spacing.xs },
    blockedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 60,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    blockedName: { flex: 1 },
    empty: { padding: t.spacing.lg },
    account: { gap: t.spacing.sm },
    loadingRow: { padding: t.spacing.lg, alignItems: 'flex-start' },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
    },
    noticeText: { flex: 1 },
  });

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['settings', 'common']);
  const { session } = useAuth();
  const requireAuth = useRequireAuth();

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('common:screens.settings') }} />
      <View style={styles.content}>
        <AppearanceSection />
        {session ? (
          <>
            <NotificationsSection />
            <BlockedSection />
          </>
        ) : null}
        <AboutSection />
        {session ? (
          <AccountSection />
        ) : (
          <Button title={t('common:actions.signIn')} onPress={() => requireAuth('/settings')} />
        )}
      </View>
    </Screen>
  );
}

function AppearanceSection() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['settings', 'common']);
  const { mode, setMode } = useThemeMode();
  const language = useLanguage();
  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: t('settings:appearance.themeSystem') },
    { value: 'light', label: t('settings:appearance.themeLight') },
    { value: 'dark', label: t('settings:appearance.themeDark') },
  ];
  const languageOptions = SUPPORTED_LANGUAGES.map((l) => ({ value: l, label: t(`common:language.${l}`) }));

  return (
    <Section title={t('settings:appearance.title')} card>
      <View style={styles.field}>
        <Text variant="label" color="textMuted">
          {t('common:theme.label')}
        </Text>
        <Segmented
          options={themeOptions}
          value={mode}
          onChange={setMode}
          accessibilityLabel={t('common:theme.label')}
        />
      </View>
      <View style={styles.field}>
        <Text variant="label" color="textMuted">
          {t('common:language.label')}
        </Text>
        <Segmented<Language>
          options={languageOptions}
          value={language}
          onChange={(l) => void setLanguage(l)}
          accessibilityLabel={t('common:language.label')}
        />
      </View>
    </Section>
  );
}

function NotificationsSection() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['settings', 'common']);
  const privateData = useMyPrivate();
  const update = useUpdatePrivate();
  const { show } = useToast();
  const errorText = useErrorText();
  const [radius, setRadius] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<number | null>(null);
  const { mutate } = update;

  // Flush a pending radius change when leaving the screen.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) mutate({ notify_radius_km: pending.current });
    },
    [mutate],
  );

  if (privateData.isPending) {
    return (
      <Section title={t('settings:notifications.title')} card padded={false}>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.textMuted} />
        </View>
      </Section>
    );
  }
  if (!privateData.data) return null;
  const data = privateData.data;
  const shownRadius = radius ?? data.notify_radius_km;

  const onRadius = (value: number) => {
    setRadius(value);
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      mutate(
        { notify_radius_km: value },
        { onError: (e) => show(errorText(e), 'danger') },
      );
    }, RADIUS_SAVE_DELAY_MS);
  };

  return (
    <Section title={t('settings:notifications.title')} card padded={false}>
      <SwitchRow
        title={t('settings:notifications.push')}
        subtitle={t('settings:notifications.pushHint')}
        value={data.push_enabled}
        onValueChange={(v) =>
          mutate({ push_enabled: v }, { onError: (e) => show(errorText(e), 'danger') })
        }
        testID="settings-push"
      />
      <Divider />
      <View style={[styles.field, { padding: theme.spacing.lg }]}>
        <Stepper
          label={t('settings:notifications.radius')}
          value={shownRadius}
          min={NOTIFY_RADIUS_KM.min}
          max={NOTIFY_RADIUS_KM.max}
          onChange={onRadius}
          formatValue={(v) => t('settings:notifications.km', { km: v })}
        />
        <Text variant="caption" color="textMuted" style={styles.hint}>
          {t('settings:notifications.radiusHint')}
        </Text>
        {!data.has_home ? (
          <View style={styles.notice}>
            <Icon name="info" size={14} color="textMuted" />
            <Text variant="caption" color="textMuted" style={styles.noticeText}>
              {t('settings:notifications.noHome')}
            </Text>
          </View>
        ) : null}
      </View>
      {!data.has_home ? (
        <>
          <Divider />
          <ListItem
            title={t('settings:notifications.setHome')}
            left={<Icon name="navigation" size={20} />}
            onPress={() => router.push('/edit-profile')}
          />
        </>
      ) : null}
    </Section>
  );
}

function BlockedSection() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['settings', 'safety']);
  const blocked = useBlockedUsers();
  const { unblock, isPending } = useBlockUser();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onUnblock = async (userId: string) => {
    setBusyId(userId);
    try {
      await unblock(userId);
    } catch {
      // toast already shown by useBlockUser
    } finally {
      setBusyId(null);
    }
  };

  const rows = blocked.data ?? [];
  return (
    <Section title={t('settings:blocked.title')} subtitle={t('settings:blocked.hint')} card padded={false}>
      {blocked.isPending ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.textMuted} />
        </View>
      ) : rows.length === 0 ? (
        <Text color="textMuted" style={styles.empty}>
          {t('settings:blocked.empty')}
        </Text>
      ) : (
        rows.map((row, i) => (
          <View key={row.user_id}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.blockedRow}>
              <Avatar path={row.avatar_path} name={row.display_name || '?'} size={40} />
              <Text variant="bodyStrong" numberOfLines={1} style={styles.blockedName}>
                {row.display_name}
              </Text>
              <Button
                title={t('safety:block.unblock')}
                variant="secondary"
                onPress={() => void onUnblock(row.user_id)}
                loading={busyId === row.user_id}
                disabled={isPending && busyId !== row.user_id}
                accessibilityLabel={`${t('safety:block.unblock')}: ${row.display_name}`}
                testID={`unblock-${row.user_id}`}
              />
            </View>
          </View>
        ))
      )}
    </Section>
  );
}

function AboutSection() {
  const { t } = useTranslation(['settings', 'common']);
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <Section title={t('settings:about.title')} card padded={false}>
      <ListItem
        title={t('settings:about.version')}
        subtitle={t('settings:about.versionValue', { version })}
        left={<Icon name="info" size={20} />}
      />
      <Divider />
      <ListItem
        title={t('settings:about.venueData')}
        subtitle={OSM_ATTRIBUTION}
        left={<Icon name="map" size={20} />}
        right={<Icon name="external-link" size={18} color="textMuted" />}
        onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
        accessibilityHint={t('settings:about.openLink')}
        testID="about-osm"
      />
      <Divider />
      <ListItem
        title={t('settings:about.mapTiles')}
        subtitle={t('settings:about.mapTilesValue')}
        left={<Icon name="layers" size={20} />}
        right={<Icon name="external-link" size={18} color="textMuted" />}
        onPress={() => void Linking.openURL(OPENFREEMAP_URL)}
        accessibilityHint={t('settings:about.openLink')}
      />
    </Section>
  );
}

function AccountSection() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['settings', 'common']);
  const { signOut, session } = useAuth();
  const { show } = useToast();
  const errorText = useErrorText();
  const deleteAccount = useDeleteAccount();
  const { confirm, dialog } = useConfirmDialog();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/');
    } finally {
      setSigningOut(false);
    }
  };

  const onDelete = async () => {
    const first = await confirm({
      title: t('settings:account.deleteTitle'),
      message: t('settings:account.deleteMessage'),
      confirmLabel: t('settings:account.deleteContinue'),
      destructive: true,
    });
    if (!first) return;
    const second = await confirm({
      title: t('settings:account.deleteTitle2'),
      message: t('settings:account.deleteMessage2', { email: session?.user.email ?? '' }),
      confirmLabel: t('settings:account.deleteForever'),
      destructive: true,
    });
    if (!second) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        show(t('settings:account.deleted'), 'success');
        router.replace('/');
      },
      onError: (e) => show(errorText(e), 'danger'),
    });
  };

  return (
    <Section title={t('settings:account.title')}>
      <View style={styles.account}>
        {session?.user.email ? (
          <Text variant="label" color="textMuted">
            {t('settings:account.signedInAs', { email: session.user.email })}
          </Text>
        ) : null}
        <Button
          title={t('common:actions.signOut')}
          icon="log-out"
          variant="secondary"
          onPress={() => void onSignOut()}
          loading={signingOut}
          fullWidth
          testID="settings-sign-out"
        />
        <Button
          title={t('settings:account.delete')}
          icon="trash-2"
          variant="ghost"
          onPress={() => void onDelete()}
          loading={deleteAccount.isPending}
          fullWidth
          testID="settings-delete"
        />
      </View>
      {dialog}
    </Section>
  );
}
