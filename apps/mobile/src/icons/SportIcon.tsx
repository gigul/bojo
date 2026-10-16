import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { resolveColor, useTheme, type ColorValueOrToken } from '@/theme';

import { getSportGlyph } from './sportGlyphs';

const STROKE = 1.75;
/** Glyph scale inside the active disc (keeps the visual stroke at 1.75). */
const ACTIVE_SCALE = 0.72;

export interface SportIconProps {
  /** Sport id from @bojo/shared SPORTS (or 'multi'); unknown ids render a generic circle glyph. */
  sportId: string;
  /** Rendered size in px/pt (default 24). */
  size?: number;
  /** Glyph colour: theme colour name or any colour string. Default `text` (`onPrimary` when active). */
  color?: ColorValueOrToken;
  /** Selected state: subtle filled lime disc behind a slightly smaller glyph. */
  active?: boolean;
  /** Disc colour when active (default theme `primary`). */
  activeBackground?: ColorValueOrToken;
  /** Decorative by default (the sport name is usually next to it). Give a label to expose it. */
  accessibilityLabel?: string;
}

export function SportIcon({
  sportId,
  size = 24,
  color,
  active = false,
  activeBackground,
  accessibilityLabel,
}: SportIconProps) {
  const theme = useTheme();
  const glyphColor = resolveColor(theme, color ?? (active ? 'onPrimary' : 'text'));
  const discColor = resolveColor(theme, activeBackground ?? 'primary');
  const renderGlyph = getSportGlyph(sportId);
  return (
    // ARIA props live on a wrapping View: react-native-svg forwards unknown props to the DOM on web.
    <View
      style={{ width: size, height: size }}
      {...(accessibilityLabel
        ? { role: 'img' as const, 'aria-label': accessibilityLabel }
        : { 'aria-hidden': true })}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {active ? <Circle cx={12} cy={12} r={12} fill={discColor} /> : null}
        <G
          fill="none"
          stroke={glyphColor}
          strokeWidth={active ? STROKE / ACTIVE_SCALE : STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={
            active ? `translate(12 12) scale(${ACTIVE_SCALE}) translate(-12 -12)` : undefined
          }
        >
          {renderGlyph(glyphColor)}
        </G>
      </Svg>
    </View>
  );
}
