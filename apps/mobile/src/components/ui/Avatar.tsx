import { BUCKETS } from '@bojo/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { initials } from '@/lib/format';
import { publicUrl } from '@/lib/storage';
import { useReduceMotion, useTheme } from '@/theme';

import { Text } from './Text';

export interface AvatarProps {
  /** Object path in the `avatars` bucket ("<userId>/<uuid>.jpg"); null → initials. */
  path?: string | null;
  name: string;
  /** Diameter, default 40. */
  size?: number;
  /** Ring in the surface colour (used when avatars overlap). */
  ring?: boolean;
  /** Decorative by default (the name is usually shown next to it). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({
  path,
  name,
  size = 40,
  ring = false,
  accessibilityLabel,
  style,
}: AvatarProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const showImage = Boolean(path) && failedPath !== path;
  const labelled = Boolean(accessibilityLabel);

  return (
    <View
      {...(labelled
        ? { role: 'img' as const, 'aria-label': accessibilityLabel }
        : { 'aria-hidden': true })}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: ring ? 2 : 0,
          borderColor: theme.colors.surface,
        },
        style,
      ]}
    >
      {showImage && path ? (
        <Image
          source={{ uri: publicUrl(BUCKETS.avatars, path) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={reduceMotion ? 0 : 150}
          recyclingKey={path}
          onError={() => setFailedPath(path)}
        />
      ) : (
        <Text
          variant="label"
          color="textMuted"
          allowFontScaling={false}
          style={{
            fontSize: Math.max(10, Math.round(size * 0.36)),
            lineHeight: Math.round(size * 0.5),
          }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
