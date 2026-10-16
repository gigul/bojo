import { isValidElement, type ReactElement, type ReactNode } from 'react';

import { Icon, type IconName } from '@/icons';

/**
 * Icon slot used by Button / Chip / EmptyState: a Feather name, a ready element, or a render
 * function receiving the colour/size the component wants (keeps icon colour in sync with state).
 */
export type IconSlot =
  IconName | ReactElement | ((p: { color: string; size: number }) => ReactNode);

export function renderIconSlot(slot: IconSlot | undefined, color: string, size: number): ReactNode {
  if (slot === undefined) return null;
  if (typeof slot === 'string') return <Icon name={slot} color={color} size={size} />;
  if (typeof slot === 'function') return slot({ color, size });
  return isValidElement(slot) ? slot : null;
}
