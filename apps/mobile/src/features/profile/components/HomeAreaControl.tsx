import { isDistrictKey, type DistrictKey } from '@bojo/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { Icon } from '@/icons';
import { getRpcErrorCode, useErrorText } from '@/lib/errors';
import { useThemedStyles, type Theme } from '@/theme';

import { LOCATION_UNAVAILABLE, useClearHomeLocation, useSetHomeLocation } from '../api';

export interface HomeAreaControlProps {
  /** A home area is already stored (from useMyPrivate().has_home). */
  hasHome: boolean;
  /** Called with the district the server derived from the snapped point. */
  onDetected?: (district: DistrictKey | null) => void;
  /** Offer "remove" when a home area exists (edit profile). */
  allowClear?: boolean;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    box: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
      gap: t.spacing.md,
    },
    head: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headText: { flex: 1, gap: 2 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    status: { flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' },
    statusText: { flex: 1 },
  });

/**
 * Optional home area. The privacy explanation is shown BEFORE the OS permission prompt, which only
 * appears after an explicit tap on "detect".
 */
export function HomeAreaControl({ hasHome, onDetected, allowClear = false }: HomeAreaControlProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['profile', 'vocab']);
  const errorText = useErrorText();
  const setHome = useSetHomeLocation();
  const clearHome = useClearHomeLocation();
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const detect = () => {
    setStatus(null);
    setHome.mutate(undefined, {
      onSuccess: ({ district_key }) => {
        const district = isDistrictKey(district_key) ? district_key : null;
        onDetected?.(district);
        setStatus({
          tone: 'ok',
          text: district
            ? t('profile:home.detected', { district: t(`vocab:districts.${district}`) })
            : t('profile:home.saved'),
        });
      },
      onError: (e) => {
        const message = e instanceof Error ? e.message : '';
        const code = getRpcErrorCode(e);
        let text: string;
        if (message === LOCATION_UNAVAILABLE) text = t('profile:home.unavailable');
        else if (code === 'rate_limited') text = t('profile:home.rateLimited');
        else text = errorText(e);
        setStatus({ tone: 'error', text });
      },
    });
  };

  const clear = () => {
    setStatus(null);
    clearHome.mutate(undefined, {
      onSuccess: () => setStatus({ tone: 'ok', text: t('profile:home.cleared') }),
      onError: (e) => setStatus({ tone: 'error', text: errorText(e) }),
    });
  };

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View style={styles.iconWrap} aria-hidden>
          <Icon name="lock" size={18} color="text" />
        </View>
        <View style={styles.headText}>
          <Text variant="bodyStrong">{t('profile:home.title')}</Text>
          <Text variant="label" color="textMuted">
            {t('profile:home.explain')}
          </Text>
        </View>
      </View>

      {hasHome ? (
        <View style={styles.status}>
          <Icon name="check-circle" size={16} color="primaryText" />
          <Text variant="label" style={styles.statusText}>
            {t('profile:home.isSet')}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={hasHome ? t('profile:home.update') : t('profile:home.detect')}
          icon="navigation"
          variant="secondary"
          onPress={detect}
          loading={setHome.isPending}
          disabled={clearHome.isPending}
          testID="home-detect"
        />
        {allowClear && hasHome ? (
          <Button
            title={t('profile:home.clear')}
            icon="trash-2"
            variant="ghost"
            onPress={clear}
            loading={clearHome.isPending}
            disabled={setHome.isPending}
          />
        ) : null}
      </View>

      {status ? (
        <Text
          variant="label"
          color={status.tone === 'error' ? 'danger' : 'textMuted'}
          role={status.tone === 'error' ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
        >
          {status.text}
        </Text>
      ) : null}
    </View>
  );
}
