// Bojo sport pictograms (DESIGN.md §Пиктограммы, ARCHITECTURE §0 A2).
// Grid 24×24, live area ≈ 20×20 (2…22), stroke 1.75, round caps/joins, no fills.
// One visual idea per glyph: a ball with its characteristic seam, a racket/paddle, a wave, a kettlebell,
// a running shoe. Glyphs are drawn with `currentColor`-style inheritance from the parent <G>.
import type { ReactElement } from 'react';
import { Circle, G, Path } from 'react-native-svg';

/** Small solid dot (perforations, pupils). Visually a stroke-sized dot, not a filled shape. */
function Dot({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return <Circle cx={cx} cy={cy} r={0.95} fill={color} stroke="none" />;
}

export type GlyphRenderer = (color: string) => ReactElement;

const football: GlyphRenderer = () => (
  <>
    <Circle cx={12} cy={12} r={9} />
    {/* centre pentagon + five seams to the rim */}
    <Path d="M12 8.25 L15.57 10.84 L14.2 15.03 L9.8 15.03 L8.43 10.84 Z" />
    <Path d="M12 8.25 V3 M15.57 10.84 L20.56 9.22 M14.2 15.03 L17.29 19.28 M9.8 15.03 L6.71 19.28 M8.43 10.84 L3.44 9.22" />
  </>
);

const basketball: GlyphRenderer = () => (
  <>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 3 V21 M3 12 H21" />
    <Path d="M5.64 5.64 C8.7 8.5 8.7 15.5 5.64 18.36" />
    <Path d="M18.36 5.64 C15.3 8.5 15.3 15.5 18.36 18.36" />
  </>
);

/** Three curved panels: a pinwheel of seams from the centre plus one parallel stripe per panel. */
const volleyball: GlyphRenderer = () => (
  <>
    <Circle cx={12} cy={12} r={9} />
    {[0, 120, 240].map((angle) => (
      <G key={angle} transform={`rotate(${angle} 12 12)`}>
        <Path d="M12 12 A8.5 8.5 0 0 0 20.16 15.8" />
        <Path d="M9.33 15.42 A12 12 0 0 0 15.8 20.16" />
      </G>
    ))}
  </>
);

/** Tennis ball: the two facing seam arcs, tilted so the S-curve reads at a glance. */
const tennis: GlyphRenderer = () => (
  <>
    <Circle cx={12} cy={12} r={9} />
    <G transform="rotate(-40 12 12)">
      <Path d="M4.6 6.8 C8.4 9.6 8.4 14.4 4.6 17.2" />
      <Path d="M19.4 6.8 C15.6 9.6 15.6 14.4 19.4 17.2" />
    </G>
  </>
);

/**
 * Padel: big upright solid racket with a perforation pattern and a throat into the handle — no
 * ball, so at 20 px it can't be confused with the table-tennis paddle (round, tilted, with a ball).
 */
const padel: GlyphRenderer = (color) => (
  <>
    <Path d="M12 2.5 C15.9 2.5 18.25 5.2 18.25 8.6 C18.25 11.75 16.2 14 13.5 14.75 L13 15.75 V20.6 A1 1 0 0 1 11 20.6 V15.75 L10.5 14.75 C7.8 14 5.75 11.75 5.75 8.6 C5.75 5.2 8.1 2.5 12 2.5 Z" />
    <Dot cx={9.6} cy={6.6} color={color} />
    <Dot cx={14.4} cy={6.6} color={color} />
    <Dot cx={12} cy={8.9} color={color} />
    <Dot cx={9.6} cy={11.2} color={color} />
    <Dot cx={14.4} cy={11.2} color={color} />
  </>
);

/**
 * Table tennis: big round blade with a short, wide outlined handle cut into it (a thin stick
 * would read as a magnifier), ball top-left.
 */
const tableTennis: GlyphRenderer = () => (
  <>
    <Path d="M8.05 13.48 L4.63 16.9 A2.1 2.1 0 0 0 7.61 19.87 L11.02 16.45 A7 7 0 1 0 8.05 13.48 Z" />
    <Circle cx={4.25} cy={4.5} r={1.9} />
  </>
);

/** Swimming: head and a stroking arm above two waves. */
const swimming: GlyphRenderer = () => (
  <>
    <Circle cx={17.25} cy={7} r={2.1} />
    <Path d="M3.75 12.25 L8.75 7.5 L13.25 11.5" />
    <Path d="M2.75 15.75 Q5.06 13.9 7.38 15.75 T12 15.75 T16.62 15.75 T21.25 15.75" />
    <Path d="M2.75 20 Q5.06 18.15 7.38 20 T12 20 T16.62 20 T21.25 20" />
  </>
);

/** Workout: kettlebell (handle wider than the bell top, so it never reads as a padlock). */
const workout: GlyphRenderer = () => (
  <>
    <Path d="M7.21 10.23 C6.4 9.2 6.1 8.1 6.1 7 C6.1 4.6 8.3 3 12 3 C15.7 3 17.9 4.6 17.9 7 C17.9 8.1 17.6 9.2 16.79 10.23" />
    <Path d="M9.55 20 A6.25 6.25 0 1 1 14.45 20 Z" />
  </>
);

/** Running: side view of a running shoe, toe to the right. */
const running: GlyphRenderer = () => (
  <>
    <Path d="M3.25 9.6 V17 Q3.25 18.75 5 18.75 H19.1 Q21 18.75 21 16.9 Q21 14.6 18.4 13.85 L13.6 12.4 L10.9 8.4 Q10.35 7.6 9.5 8.15 Q7.35 9.75 4.6 9.1 Q3.25 8.8 3.25 9.6 Z" />
    <Path d="M3.25 15.6 H20.9" />
    <Path d="M11.85 9.9 L10.4 10.95 M13 11.55 L11.55 12.6" />
  </>
);

/**
 * Several sports: two different balls — a big seamed ball and a small plain one. (A 2×2 grid of
 * circles read as an "apps" icon, especially as the photo placeholder.)
 */
const multi: GlyphRenderer = () => (
  <>
    <Circle cx={9.25} cy={14.75} r={6.75} />
    <Path d="M4.3 10.2 C7.2 12.6 7.2 16.9 4.3 19.3 M14.2 10.2 C11.3 12.6 11.3 16.9 14.2 19.3" />
    <Circle cx={17.75} cy={6.25} r={3.75} />
  </>
);

/** Unknown sport id. */
const generic: GlyphRenderer = (color) => (
  <>
    <Circle cx={12} cy={12} r={8.5} />
    <Dot cx={12} cy={12} color={color} />
  </>
);

export const SPORT_GLYPHS = {
  football,
  basketball,
  volleyball,
  beach_volleyball: volleyball,
  tennis,
  padel,
  table_tennis: tableTennis,
  swimming,
  workout,
  running,
  multi,
} as const satisfies Record<string, GlyphRenderer>;

export type SportGlyphName = keyof typeof SPORT_GLYPHS;

export const GENERIC_GLYPH: GlyphRenderer = generic;

export function getSportGlyph(sportId: string): GlyphRenderer {
  return (SPORT_GLYPHS as Record<string, GlyphRenderer>)[sportId] ?? GENERIC_GLYPH;
}
