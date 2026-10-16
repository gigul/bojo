// Cross-platform accessibility helpers for the kit. React Native maps `accessibilityState` onto the
// native accessibility tree, but react-native-web ignores it: on web the same state must be spelled
// as ARIA attributes. Every kit control goes through these helpers so web and native stay in sync.
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text as RNText } from 'react-native';

export const IS_WEB = Platform.OS === 'web';

/** How a selectable control announces its state. */
export type SelectionKind = 'toggle' | 'radio' | 'tab' | 'none';

/**
 * Role + state props for a selectable pressable.
 * - `toggle` → button with `aria-pressed` (web) / `selected` (native)
 * - `radio`  → radio with `aria-checked` (put it inside a `role="radiogroup"` container)
 * - `tab`    → tab with `aria-selected` (inside a `role="tablist"` container)
 * - `none`   → plain button; the state is only visual (e.g. a chip that opens a sheet)
 */
export function selectionA11y(
  kind: SelectionKind,
  selected: boolean,
  disabled = false,
): Record<string, unknown> {
  switch (kind) {
    case 'radio':
      return IS_WEB
        ? { role: 'radio', 'aria-checked': selected, 'aria-disabled': disabled || undefined }
        : { accessibilityRole: 'radio', accessibilityState: { checked: selected, disabled } };
    case 'tab':
      return IS_WEB
        ? { role: 'tab', 'aria-selected': selected, 'aria-disabled': disabled || undefined }
        : { accessibilityRole: 'tab', accessibilityState: { selected, disabled } };
    case 'toggle':
      return IS_WEB
        ? { role: 'button', 'aria-pressed': selected, 'aria-disabled': disabled || undefined }
        : { accessibilityRole: 'button', accessibilityState: { selected, disabled } };
    case 'none':
      return IS_WEB
        ? { role: 'button', 'aria-disabled': disabled || undefined }
        : { accessibilityRole: 'button', accessibilityState: { disabled } };
  }
}

/** Props React Native's types don't know (DOM keyboard / context-menu events). `{}` natively. */
export function webOnly(props: Record<string, unknown>): Record<string, unknown> {
  return IS_WEB ? props : {};
}

interface KeyLike {
  key: string;
  preventDefault: () => void;
  currentTarget?: unknown;
}

const isSpace = (key: string) => key === ' ' || key === 'Spacebar';

/**
 * Web: Space activates radio / tab / switch roles (react-native-web only does that for role=button;
 * Enter already works). Returns an `onKeyDown` handler.
 */
export function spaceActivates(onActivate: () => void) {
  return (e: KeyLike) => {
    if (isSpace(e.key)) {
      e.preventDefault();
      onActivate();
    }
  };
}

const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp'];

/**
 * Web: arrow / Home / End keys move focus between the elements with `itemRole` inside the closest
 * ancestor with `groupRole` (radio group, tab list, toolbar). Returns the newly focused element so a
 * caller can also select it (radios and tabs follow focus). Null when the key isn't a navigation key.
 */
export function moveFocusInGroup(
  e: KeyLike,
  itemRole: string,
  groupRole: string,
): HTMLElement | null {
  if (!IS_WEB) return null;
  const forward = NEXT_KEYS.includes(e.key);
  const backward = PREV_KEYS.includes(e.key);
  const home = e.key === 'Home';
  const end = e.key === 'End';
  if (!forward && !backward && !home && !end) return null;
  const from = e.currentTarget as HTMLElement | null;
  const group = from?.closest?.(`[role="${groupRole}"]`);
  if (!from || !group) return null;
  const items = Array.from(group.querySelectorAll<HTMLElement>(`[role="${itemRole}"]`)).filter(
    (el) => el.getAttribute('aria-disabled') !== 'true',
  );
  const index = items.indexOf(from);
  if (items.length === 0) return null;
  let next: HTMLElement | undefined;
  if (home) next = items[0];
  else if (end) next = items[items.length - 1];
  else if (forward) next = items[(index + 1) % items.length];
  else next = items[(index - 1 + items.length) % items.length];
  if (!next) return null;
  e.preventDefault();
  next.focus();
  return next;
}

const hidden = StyleSheet.create({
  text: {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    overflow: 'hidden',
    opacity: 0,
  },
});

/**
 * Text that only assistive tech reads (web: a visually hidden node, so no `aria-label` lands on a
 * role-less element). Natively it renders nothing — give the native container an
 * `accessibilityLabel` instead.
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  if (!IS_WEB) return null;
  return <RNText style={hidden.text}>{children}</RNText>;
}
