// Venue hero: full-width 16:9 photo carousel, or — when there are no photos — an honest placeholder
// (pictogram on surfaceAlt) with an "Add photo" call to action. We never show stock/fake photos.
import { BUCKETS, type VenuePhotoRow } from '@bojo/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Button, IconButton, Text } from '@/components/ui';
import { SportIcon } from '@/icons';
import { publicUrl } from '@/lib/storage';
import { lightColors, useReduceMotion, useTheme, useThemedStyles, type Theme } from '@/theme';

/** Text/icons on the (always dark) photo overlay scrim, in both themes. */
const ON_SCRIM = lightColors.textInverse;

export interface HeroPhoto {
  id: string;
  uri: string;
  attribution: string | null;
}

/** Storage photos → public URL; external photos only with their attribution (licence, OSM_IMPORT.md). */
export function toHeroPhotos(rows: readonly VenuePhotoRow[]): HeroPhoto[] {
  const out: HeroPhoto[] = [];
  for (const row of rows) {
    if (row.storage_path) {
      out.push({
        id: row.id,
        uri: publicUrl(BUCKETS.venuePhotos, row.storage_path),
        attribution: row.attribution,
      });
    } else if (row.external_url && row.attribution) {
      out.push({ id: row.id, uri: row.external_url, attribution: row.attribution });
    }
  }
  return out;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { width: '100%', aspectRatio: 16 / 9, backgroundColor: t.colors.surfaceAlt },
    page: { height: '100%' },
    image: { width: '100%', height: '100%' },
    counter: {
      position: 'absolute',
      top: t.spacing.md,
      right: t.spacing.md,
      paddingHorizontal: t.spacing.sm + 2,
      minHeight: 24,
      justifyContent: 'center',
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.overlay,
    },
    attribution: {
      position: 'absolute',
      left: t.spacing.md,
      bottom: t.spacing.md,
      maxWidth: '70%',
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 2,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.overlay,
    },
    report: {
      position: 'absolute',
      right: t.spacing.sm,
      bottom: t.spacing.sm,
      backgroundColor: t.colors.overlay,
    },
    navLeft: { position: 'absolute', left: t.spacing.sm, top: '50%', marginTop: -22 },
    navRight: { position: 'absolute', right: t.spacing.sm, top: '50%', marginTop: -22 },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.xl,
    },
    busy: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      backgroundColor: t.colors.overlay,
    },
    onOverlay: { color: ON_SCRIM },
    // `secondary` is surfaceAlt — the placeholder's own colour — so lift the button onto surface.
    addButton: {
      marginTop: t.spacing.xs,
      backgroundColor: t.colors.surface,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
    },
  });

export function PhotoHero({
  photos,
  pictogram,
  uploading,
  onAddPhoto,
  onReportPhoto,
}: {
  photos: HeroPhoto[];
  pictogram: string;
  uploading: boolean;
  onAddPhoto: () => void;
  onReportPhoto: (photoId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { t } = useTranslation('venues');
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [scroller, setScroller] = useState<ScrollView | null>(null);
  const count = photos.length;
  const current = Math.min(index, Math.max(0, count - 1));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };
  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i));
    setIndex(next);
    scroller?.scrollTo({ x: next * width, animated: !reduceMotion });
  };

  return (
    <View style={styles.root} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {count === 0 ? (
        <View style={styles.placeholder}>
          <SportIcon sportId={pictogram} size={48} color="textMuted" />
          <Text variant="bodyStrong" align="center">
            {t('photo.emptyTitle')}
          </Text>
          <Text variant="label" color="textMuted" align="center" numberOfLines={2}>
            {t('photo.emptyMessage')}
          </Text>
          <Button
            title={t('detail.addPhoto')}
            onPress={onAddPhoto}
            variant="secondary"
            icon="camera"
            disabled={uploading}
            style={styles.addButton}
          />
        </View>
      ) : (
        <>
          <ScrollView
            ref={setScroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            onScrollEndDrag={Platform.OS === 'web' ? onScrollEnd : undefined}
          >
            {photos.map((photo, i) => (
              <View key={photo.id} style={[styles.page, { width: width || 1 }]}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.image}
                  contentFit="cover"
                  transition={reduceMotion ? 0 : 200}
                  recyclingKey={photo.id}
                  accessible
                  accessibilityLabel={t('photo.a11y', { index: i + 1, count })}
                />
                {photo.attribution ? (
                  <View style={styles.attribution}>
                    <Text variant="caption" style={styles.onOverlay} numberOfLines={1}>
                      {t('photo.by', { author: photo.attribution })}
                    </Text>
                  </View>
                ) : null}
                <IconButton
                  icon="flag"
                  onPress={() => onReportPhoto(photo.id)}
                  accessibilityLabel={t('photo.report')}
                  color={ON_SCRIM}
                  iconSize={18}
                  style={styles.report}
                />
              </View>
            ))}
          </ScrollView>
          {count > 1 ? (
            <View style={styles.counter} aria-hidden>
              <Text variant="label" style={styles.onOverlay}>
                {t('photo.counter', { index: current + 1, count })}
              </Text>
            </View>
          ) : null}
          {count > 1 && Platform.OS === 'web' ? (
            <>
              {current > 0 ? (
                <IconButton
                  icon="chevron-left"
                  variant="surface"
                  onPress={() => goTo(current - 1)}
                  accessibilityLabel={t('photo.previous')}
                  style={styles.navLeft}
                />
              ) : null}
              {current < count - 1 ? (
                <IconButton
                  icon="chevron-right"
                  variant="surface"
                  onPress={() => goTo(current + 1)}
                  accessibilityLabel={t('photo.next')}
                  style={styles.navRight}
                />
              ) : null}
            </>
          ) : null}
        </>
      )}
      {uploading ? (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="label" style={styles.onOverlay}>
            {t('photo.uploading')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
