// Native-only ODbL attribution control (docs/OSM_IMPORT.md: "в мобильном — через видимый ⓘ/© контрол").
// The basemap (Apple / Google) draws its own legal notice; this one credits the OSM venue data.
import { OSM_COPYRIGHT_URL } from '@bojo/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      right: t.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
    },
    toggle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surface,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      opacity: 0.92,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      minHeight: 28,
      paddingHorizontal: t.spacing.sm + 2,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surface,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
    },
  });

export function MapAttribution({ bottom }: { bottom: number }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['map', 'common']);
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.root, { bottom }]} pointerEvents="box-none">
      {open ? (
        <Pressable
          onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
          accessibilityRole="link"
          accessibilityLabel={t('common:osm.attribution')}
          accessibilityHint={t('map:attribution.openHint')}
          hitSlop={8}
          style={styles.pill}
        >
          <Text variant="caption" maxFontSizeMultiplier={1.3}>
            {t('common:osm.attribution')}
          </Text>
          <Icon name="external-link" size={12} color="textMuted" />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={t('map:attribution.button')}
        aria-expanded={open}
        hitSlop={10}
        style={styles.toggle}
      >
        <Icon name={open ? 'x' : 'info'} size={15} color="textMuted" />
      </Pressable>
    </View>
  );
}
