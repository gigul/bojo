import type { Theme, ThemeColorName } from './tokens';

/** A theme colour name or a literal colour string. */
export type ColorValueOrToken = ThemeColorName | (string & {});

/** Theme colour name → value; anything else is treated as a literal colour string. */
export function resolveColor(theme: Theme, color: ColorValueOrToken): string {
  return color in theme.colors ? theme.colors[color as ThemeColorName] : color;
}
