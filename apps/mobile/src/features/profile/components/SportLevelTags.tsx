import { isLevel, isSportId } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Chip } from '@/components/ui';
import { SportIcon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

export interface SportLevelTagsProps {
  sportIds: readonly string[];
  /** Same order as sportIds. */
  levels: readonly number[];
  /**
   * Sports shared with the viewer — outline + check + bold label (not the lime fill, which means an
   * active filter). The "why" chips also say it in words.
   */
  commonSportIds?: readonly string[];
  /** Put common sports first (cards). */
  commonFirst?: boolean;
  /** Show at most N tags (cards). */
  max?: number;
  style?: StyleProp<ViewStyle>;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  });

/** "⚽ Футбол · Средний" tags. Common sports are highlighted with an outline + check. */
export function SportLevelTags({
  sportIds,
  levels,
  commonSportIds = [],
  commonFirst = false,
  max,
  style,
}: SportLevelTagsProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['vocab', 'profile']);
  const items = sportIds
    .map((id, i) => ({ id, level: levels[i], common: commonSportIds.includes(id) }))
    .filter((x) => isSportId(x.id));
  if (commonFirst) items.sort((a, b) => Number(b.common) - Number(a.common));
  const shown = max !== undefined ? items.slice(0, max) : items;

  return (
    <View style={[styles.row, style]}>
      {shown.map(({ id, level, common }) => {
        const sport = isSportId(id) ? t(`vocab:sports.${id}`) : id;
        const levelText = isLevel(level) ? t(`vocab:levels.${level}`) : null;
        const label = levelText ? `${sport} · ${levelText}` : sport;
        return (
          <Chip
            key={id}
            label={label}
            appearance={common ? 'highlight' : 'default'}
            icon={({ color, size }) => <SportIcon sportId={id} size={size + 2} color={color} />}
            accessibilityLabel={common ? t('profile:sports.commonA11y', { label }) : label}
          />
        );
      })}
    </View>
  );
}
