// Visual map pins shared by the native (Marker children) and web (maplibre DOM marker) maps.
// Purely presentational: interaction + accessibility live on the platform wrapper.
import { memo } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { SportIcon } from '@/icons';
import { fontStyle, useTheme, useThemedStyles, type Theme } from '@/theme';

/** Every pin renders inside a fixed box so its centre (= the coordinate) never moves between states. */
export const PIN_BOX = 60;
const PIN = 36;
/** Selected pins are bigger + haloed: in the dark theme pin/selected fills differ by only ~1.2:1. */
const PIN_SELECTED = 44;
const HALO = 58;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    box: {
      width: PIN_BOX,
      height: PIN_BOX,
      alignItems: 'center',
      justifyContent: 'center',
    },
    halo: {
      position: 'absolute',
      width: HALO,
      height: HALO,
      borderRadius: HALO / 2,
      backgroundColor: t.colors.primary,
      opacity: 0.35,
    },
    pin: {
      width: PIN,
      height: PIN,
      borderRadius: PIN / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.mapMarker,
      borderWidth: 2,
      borderColor: t.colors.surface,
    },
    pinEvents: { borderWidth: 3, borderColor: t.colors.primary },
    pinSelected: {
      width: PIN_SELECTED,
      height: PIN_SELECTED,
      borderRadius: PIN_SELECTED / 2,
      backgroundColor: t.colors.mapMarkerSelected,
      borderWidth: 3,
      borderColor: t.colors.onPrimary,
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 6,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.primary,
      borderWidth: 1.5,
      borderColor: t.colors.onPrimary,
    },
    badgeText: {
      ...fontStyle('extrabold', t.fontsLoaded),
      fontSize: 10,
      lineHeight: 12,
      color: t.colors.onPrimary,
      includeFontPadding: false,
    },
    cluster: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.mapMarker,
      borderWidth: 2,
      borderColor: t.colors.surface,
    },
    clusterText: {
      ...fontStyle('extrabold', t.fontsLoaded),
      fontSize: 13,
      lineHeight: 16,
      color: t.colors.textInverse,
      includeFontPadding: false,
    },
    meHalo: {
      position: 'absolute',
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.primary,
      opacity: 0.3,
    },
    meOutline: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.mapMarker,
    },
    me: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: t.colors.primary,
      borderWidth: 3,
      borderColor: t.colors.surface,
    },
  });

export interface VenuePinProps {
  pictogram: string;
  selected: boolean;
  /** Upcoming events (the small count badge). */
  eventsCount: number;
  /** A game today → lime ring (DESIGN.md: "акцентное кольцо, если есть событие сегодня"). */
  today: boolean;
}

export const VenuePin = memo(function VenuePin({
  pictogram,
  selected,
  eventsCount,
  today,
}: VenuePinProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.box} pointerEvents="none">
      {selected ? <View style={styles.halo} /> : null}
      <View
        style={[
          styles.pin,
          today && !selected ? styles.pinEvents : null,
          selected ? styles.pinSelected : null,
        ]}
      >
        <SportIcon
          sportId={pictogram}
          size={selected ? 24 : 20}
          color={selected ? 'onPrimary' : 'textInverse'}
        />
      </View>
      {eventsCount > 0 ? (
        <View style={styles.badge}>
          <RNText style={styles.badgeText} allowFontScaling={false}>
            {eventsCount > 9 ? '9+' : String(eventsCount)}
          </RNText>
        </View>
      ) : null}
    </View>
  );
});

/** Cluster bubble: count inside, grows gently with the count; lime ring when a venue has a game today. */
export const ClusterPin = memo(function ClusterPin({
  count,
  hasToday,
}: {
  count: number;
  hasToday: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const size = Math.round(Math.min(52, 36 + Math.log2(Math.max(count, 2)) * 3));
  return (
    <View style={styles.box} pointerEvents="none">
      <View
        style={[
          styles.cluster,
          { width: size, height: size, borderRadius: size / 2 },
          hasToday ? { borderWidth: 3, borderColor: theme.colors.primary } : null,
        ]}
      >
        <RNText style={styles.clusterText} allowFontScaling={false}>
          {count > 999 ? '999+' : String(count)}
        </RNText>
      </View>
    </View>
  );
});

/** The device's own position (local only, never sent anywhere — §8). */
export const UserDot = memo(function UserDot() {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.box} pointerEvents="none">
      <View style={styles.meHalo} />
      <View style={styles.meOutline}>
        <View style={styles.me} />
      </View>
    </View>
  );
});
