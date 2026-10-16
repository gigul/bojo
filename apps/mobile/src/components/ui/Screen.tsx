import type { ReactElement, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useThemedStyles, type Theme } from '@/theme';

export interface ScreenProps {
  children?: ReactNode;
  /** Wrap content in a ScrollView (keyboard-aware on iOS). */
  scroll?: boolean;
  /** Screen gutter (20) + vertical padding, centred with a max readable width on wide screens. Default true. */
  padded?: boolean;
  /**
   * Safe-area edges to pad. Default `['bottom','left','right']` — right for screens under a native
   * Stack header (the header covers the top). Headerless screens (tabs, custom modals) pass
   * `['top','left','right']` (tab bar covers the bottom) or all four.
   */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  testID?: string;
}

const DEFAULT_EDGES: readonly Edge[] = ['bottom', 'left', 'right'];

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    padded: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.lg,
    },
    scrollPadded: { flexGrow: 1 },
  });

/** Screen root: themed background, safe area, optional scroll and gutter. */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = DEFAULT_EDGES,
  style,
  contentContainerStyle,
  refreshControl,
  testID,
}: ScreenProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <SafeAreaView edges={edges} style={[styles.root, style]} testID={testID}>
      {scroll ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              padded ? [styles.padded, styles.scrollPadded] : null,
              contentContainerStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, padded ? styles.padded : null, contentContainerStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
