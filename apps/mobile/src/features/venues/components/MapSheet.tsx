// Snap bottom sheet for the Map tab: `collapsed` (header only) ↔ `half` (list). Drag the handle/header
// (gesture-handler + reanimated, works on web too) or press the handle button (keyboard / screen reader).
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/icons';
import { floatingShadow, useThemedStyles, type Theme } from '@/theme';

export type SheetSnap = 'collapsed' | 'half';

export interface MapSheetProps {
  /** Height of the area the sheet lives in (the map screen). */
  containerHeight: number;
  /** Visible height when collapsed (handle + header). The screen keeps it from `onHeaderLayout`. */
  collapsedHeight: number;
  /**
   * Measured height of the handle + header: it grows with the font scale, so the screen must not
   * assume a constant (the collapsed sheet would clip its own tabs).
   */
  onHeaderLayout?: (height: number) => void;
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** Spoken label of the expand/collapse button ("Развернуть список" / "Свернуть список"). */
  toggleLabel: string;
  header: ReactNode;
  children: ReactNode;
}

const HANDLE_AREA = 26;
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 } as const;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignSelf: 'center',
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      marginHorizontal: 'auto',
      backgroundColor: t.colors.surface,
      // Above the map even when it comes later in the (web) DOM order.
      zIndex: 2,
      borderTopLeftRadius: t.radius.xl,
      borderTopRightRadius: t.radius.xl,
      borderWidth: t.scheme === 'dark' ? t.layout.hairline : 0,
      borderBottomWidth: 0,
      borderColor: t.colors.border,
      ...floatingShadow(t.scheme),
    },
    top: { paddingBottom: t.spacing.md },
    handleStrip: {
      height: HANDLE_AREA,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingLeft: t.spacing.lg,
      paddingRight: t.spacing.sm,
    },
    headerSlot: { flex: 1 },
    toggle: {
      width: t.minTouch,
      height: t.minTouch,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    togglePressed: { backgroundColor: t.colors.surfaceAlt },
    handle: {
      width: 40,
      height: 5,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.border,
    },
    body: { flex: 1 },
  });

export function MapSheet({
  containerHeight,
  collapsedHeight,
  onHeaderLayout,
  snap,
  onSnapChange,
  toggleLabel,
  header,
  children,
}: MapSheetProps) {
  const styles = useThemedStyles(createStyles);
  const halfHeight = Math.max(collapsedHeight + 120, Math.round(containerHeight * 0.56));
  const travel = Math.max(0, halfHeight - collapsedHeight);

  const offset = useSharedValue(snap === 'half' ? 0 : travel);
  const start = useSharedValue(0);
  // The list stays mounted-but-hidden while collapsed so it isn't focusable / read off-screen.
  const [bodyVisible, setBodyVisible] = useState(snap === 'half');

  useEffect(() => {
    const target = snap === 'half' ? 0 : travel;
    offset.set(
      withSpring(target, SPRING, (finished) => {
        if (finished && target > 0) scheduleOnRN(setBodyVisible, false);
      }),
    );
  }, [snap, travel, offset]);

  const expand = () => {
    setBodyVisible(true);
    onSnapChange('half');
  };
  const settle = (toHalf: boolean) => {
    if (toHalf) expand();
    else onSnapChange('collapsed');
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      start.set(offset.get());
    })
    .onStart(() => {
      scheduleOnRN(setBodyVisible, true);
    })
    .onUpdate((e) => {
      const next = start.get() + e.translationY;
      offset.set(Math.min(travel + 24, Math.max(-24, next)));
    })
    .onEnd((e) => {
      const toHalf = e.velocityY < -400 || (e.velocityY <= 400 && offset.get() < travel / 2);
      offset.set(withSpring(toHalf ? 0 : travel, SPRING));
      scheduleOnRN(settle, toHalf);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }));

  const collapsed = snap === 'collapsed';
  const toggle = () => (collapsed ? expand() : onSnapChange('collapsed'));

  // Tap on the strip toggles too. (A Pressable under the pointer would swallow the pan on web, so
  // the strip is a plain view; keyboard / screen-reader users get the chevron button instead.)
  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) scheduleOnRN(toggle);
  });
  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <Animated.View
      style={[styles.sheet, { height: halfHeight }, animatedStyle]}
      nativeID="map-sheet"
    >
      <View
        style={styles.top}
        onLayout={(e) => onHeaderLayout?.(Math.ceil(e.nativeEvent.layout.height))}
      >
        <GestureDetector gesture={gesture}>
          <View
            style={styles.handleStrip}
            aria-hidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        <View style={styles.headerRow}>
          <View style={styles.headerSlot}>{header}</View>
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={toggleLabel}
            aria-expanded={!collapsed}
            hitSlop={4}
            style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
          >
            <Icon name={collapsed ? 'chevron-up' : 'chevron-down'} size={22} color="text" />
          </Pressable>
        </View>
      </View>
      <View
        nativeID="map-sheet-list"
        style={[styles.body, !bodyVisible && collapsed ? hiddenBody : null]}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
        aria-hidden={collapsed}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/** Hidden but keeps layout cheap; on web `display:none` also removes it from the tab order. */
const hiddenBody = Platform.OS === 'web' ? { display: 'none' as const } : { opacity: 0 };
