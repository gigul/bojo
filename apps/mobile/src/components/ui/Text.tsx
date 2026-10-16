import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { resolveColor, useTheme, type ColorValueOrToken, type TypographyVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  /** Type-scale step (default `body`). */
  variant?: TypographyVariant;
  /** Theme colour name or any colour string (default `text`). */
  color?: ColorValueOrToken;
  numberOfLines?: number;
  align?: 'auto' | 'left' | 'center' | 'right';
}

const DENSE_VARIANTS: readonly TypographyVariant[] = ['label', 'caption'];

/** Themed text. Font scaling stays on; dense variants cap it at 1.6× (DESIGN.md), others at 2×. */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (DENSE_VARIANTS.includes(variant) ? 1.6 : 2)}
      {...rest}
      style={[
        theme.typography[variant],
        { color: resolveColor(theme, color) },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
