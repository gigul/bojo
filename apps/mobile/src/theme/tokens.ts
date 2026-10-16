// Design tokens — the single source of visual truth (docs/DESIGN.md, ARCHITECTURE §2.6 + §0 A1).
// One bright accent (lime). Neutrals are slightly warm (paper / graphite) so venue photos carry colour.
import type { TextStyle, ViewStyle } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  /** Screen background. */
  background: string;
  /** Cards, sheets, tab bar. */
  surface: string;
  /** Chips, inputs, segmented tracks. */
  surfaceAlt: string;
  /** Hairline dividers / outlines. */
  border: string;
  text: string;
  /** Secondary text, ≥ 4.5:1 on background/surface/surfaceAlt. */
  textMuted: string;
  /** Text on inverted (`text`-coloured) or solid status backgrounds (danger/success/warning). */
  textInverse: string;
  /** Lime fill of the main action / free-spots badge / active state. Same in both themes. */
  primary: string;
  primaryPressed: string;
  /** Text/icons on `primary`. */
  onPrimary: string;
  /** The accent used as a text or icon colour (≥ 4.5:1). Lime is never text on light backgrounds. */
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  /** Modal / sheet scrim. */
  overlay: string;
  skeleton: string;
  /** Venue pin fill (pictogram inside uses `textInverse`). */
  mapMarker: string;
  /** Selected venue pin fill (pictogram inside uses `onPrimary`). */
  mapMarkerSelected: string;
}

export type ThemeColorName = keyof ThemeColors;

export const LIME = '#C8F031';
export const GRAPHITE = '#121411';

export const lightColors: ThemeColors = {
  background: '#F7F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFEA',
  border: '#E2E2DC',
  text: GRAPHITE,
  textMuted: '#5B6058',
  textInverse: '#F7F7F4',
  primary: LIME,
  primaryPressed: '#B4DB24',
  onPrimary: GRAPHITE,
  primaryText: '#3E6A00',
  success: '#1E7A3A',
  warning: '#8A5300',
  danger: '#B3261E',
  overlay: 'rgba(18,20,17,0.5)',
  skeleton: '#E8E8E2',
  mapMarker: GRAPHITE,
  mapMarkerSelected: LIME,
};

export const darkColors: ThemeColors = {
  background: '#0E0F0D',
  surface: '#181A17',
  surfaceAlt: '#222420',
  border: '#2E312C',
  text: '#F2F3EE',
  textMuted: '#A3A89E',
  textInverse: GRAPHITE,
  primary: LIME,
  primaryPressed: '#B4DB24',
  onPrimary: GRAPHITE,
  primaryText: LIME,
  success: '#8FD9A8',
  warning: '#F2C46B',
  danger: '#F2B8B5',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: '#262924',
  mapMarker: '#F2F3EE',
  mapMarkerSelected: LIME,
};

/** Spacing scale (§2.6). DESIGN.md's 20 pt screen gutter is `layout.screenGutter`. */
export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radii (§0 A1). Cards `lg`, buttons/chips `pill`, inputs `md`. */
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Layout constants from DESIGN.md that are not part of the spacing scale. */
export const layout = {
  /** Horizontal screen padding. */
  screenGutter: 20,
  /** Max readable content width on wide (web/tablet) screens. */
  maxContentWidth: 640,
  /** Hairline divider width. */
  hairline: 1,
} as const;

/** Minimum touch target (iOS 44 pt; Android 48 dp is reached via hitSlop where needed). */
export const MIN_TOUCH = 44;

export type TypographyVariant =
  'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'number';

/** Manrope faces loaded via @expo-google-fonts/manrope (names = keys registered with expo-font). */
export const FONT_FACES = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;
type FontWeightKey = keyof typeof FONT_FACES;

const WEIGHT_VALUE: Record<FontWeightKey, TextStyle['fontWeight']> = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

interface TypeSpec {
  size: number;
  lineHeight: number;
  weight: FontWeightKey;
  tabular?: boolean;
  letterSpacing?: number;
}

/**
 * DESIGN.md scale: display 32/38 800, title 22/28 700, headline 17/22 700, body 15/22 500,
 * label 13/18 600, caption 12/16 500. Mapped onto the §2.6 keys (+ `display`):
 *   heading = headline, bodyStrong = body at 700, number = tabular 22/28 800 (big times / counters).
 */
const TYPE_SCALE: Record<TypographyVariant, TypeSpec> = {
  display: { size: 32, lineHeight: 38, weight: 'extrabold', letterSpacing: -0.4 },
  title: { size: 22, lineHeight: 28, weight: 'bold', letterSpacing: -0.2 },
  heading: { size: 17, lineHeight: 22, weight: 'bold' },
  body: { size: 15, lineHeight: 22, weight: 'medium' },
  bodyStrong: { size: 15, lineHeight: 22, weight: 'bold' },
  label: { size: 13, lineHeight: 18, weight: 'semibold' },
  caption: { size: 12, lineHeight: 16, weight: 'medium' },
  number: { size: 22, lineHeight: 28, weight: 'extrabold', tabular: true, letterSpacing: -0.2 },
};

/**
 * With Manrope loaded each weight is its own family (no fontWeight → no synthetic bold on Android).
 * Before load / on error we fall back to the system font with a numeric weight.
 */
export function fontStyle(weight: FontWeightKey, fontsLoaded: boolean): TextStyle {
  return fontsLoaded ? { fontFamily: FONT_FACES[weight] } : { fontWeight: WEIGHT_VALUE[weight] };
}

export function buildTypography(fontsLoaded: boolean): Record<TypographyVariant, TextStyle> {
  const entries = (Object.keys(TYPE_SCALE) as TypographyVariant[]).map((variant) => {
    const spec = TYPE_SCALE[variant];
    const style: TextStyle = {
      fontSize: spec.size,
      lineHeight: spec.lineHeight,
      ...fontStyle(spec.weight, fontsLoaded),
      ...(spec.letterSpacing !== undefined ? { letterSpacing: spec.letterSpacing } : null),
      ...(spec.tabular ? { fontVariant: ['tabular-nums'] } : null),
    };
    return [variant, style] as const;
  });
  return Object.fromEntries(entries) as Record<TypographyVariant, TextStyle>;
}

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: Record<TypographyVariant, TextStyle>;
  minTouch: typeof MIN_TOUCH;
  /** Extension to §2.6: DESIGN.md layout constants. */
  layout: typeof layout;
  /** Extension to §2.6: true once Manrope is loaded (otherwise the system font is used). */
  fontsLoaded: boolean;
}

export function buildTheme(scheme: ColorScheme, fontsLoaded: boolean): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography: buildTypography(fontsLoaded),
    minTouch: MIN_TOUCH,
    layout,
    fontsLoaded,
  };
}

/** Floating elements over the map get a soft shadow in light mode; dark mode uses no shadows (DESIGN.md). */
export function floatingShadow(scheme: ColorScheme): ViewStyle {
  if (scheme === 'dark') return {};
  return { boxShadow: '0px 4px 12px rgba(18, 20, 17, 0.12)' };
}
