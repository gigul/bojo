import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { resolveColor, useTheme, type ColorValueOrToken } from '@/theme';

/** Any Feather glyph name (https://feathericons.com). */
export type IconName = ComponentProps<typeof Feather>['name'];

export interface IconProps {
  name: IconName;
  /** Default 24. */
  size?: number;
  /** Theme colour name or any colour string. Default `text`. */
  color?: ColorValueOrToken;
  /** Decorative by default; give a label only when the icon stands alone (prefer IconButton). */
  accessibilityLabel?: string;
}

/** UI icon (Feather — same stroke logic as the sport pictograms). */
export function Icon({ name, size = 24, color = 'text', accessibilityLabel }: IconProps) {
  const theme = useTheme();
  return (
    <Feather
      name={name}
      size={size}
      color={resolveColor(theme, color)}
      allowFontScaling={false}
      {...(accessibilityLabel
        ? { role: 'img' as const, 'aria-label': accessibilityLabel }
        : { 'aria-hidden': true })}
    />
  );
}
