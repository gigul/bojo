import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';

import { Badge } from './Badge';

export interface SpotsBadgeProps {
  /** Free spots (use `spotsLeft(row)` from @/lib/format). */
  spotsLeft: number;
  /** Capacity, for the spoken label ("Свободно 3 места из 10"). */
  spotsTotal?: number;
  style?: StyleProp<ViewStyle>;
}

/** Lime "ещё 3" pill (free spots are an accent use in DESIGN.md) or neutral "Мест нет". */
export function SpotsBadge({ spotsLeft, spotsTotal, style }: SpotsBadgeProps) {
  const { t } = useTranslation('common');
  const left = Math.max(0, Math.floor(spotsLeft));
  if (left === 0) {
    return (
      <Badge
        label={t('spots.full')}
        tone="neutral"
        accessibilityLabel={t('spots.a11yFull')}
        style={style}
      />
    );
  }
  const spoken =
    spotsTotal !== undefined
      ? t('spots.a11y', { count: left, total: spotsTotal })
      : t('spots.a11yNoTotal', { count: left });
  return (
    <Badge
      label={t('spots.leftShort', { count: left })}
      tone="primary"
      accessibilityLabel={spoken}
      style={style}
    />
  );
}
