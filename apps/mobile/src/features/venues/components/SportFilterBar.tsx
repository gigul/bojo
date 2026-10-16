// Horizontal sport filter chips floating over the map (multi-select; "Все" clears the filter).
// Selection is announced by the kit Chip itself (aria-pressed on web, selected state natively).
import { SPORTS, type SportId } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Chip, ChipRow } from '@/components/ui';
import { SportIcon } from '@/icons';
import { floatingShadow, useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.xs,
      gap: t.spacing.sm,
    },
    floating: floatingShadow(t.scheme),
    idle: {
      backgroundColor: t.colors.surface,
      borderColor: t.scheme === 'dark' ? t.colors.border : 'transparent',
      ...floatingShadow(t.scheme),
    },
  });

export function SportFilterBar({
  selected,
  onChange,
}: {
  selected: readonly SportId[];
  onChange: (next: SportId[]) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['map', 'vocab']);
  const none = selected.length === 0;

  const toggle = (id: SportId) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <ChipRow
      contentContainerStyle={styles.content}
      role="group"
      accessibilityLabel={t('map:sportFilter')}
      // Over the map a second line of chips is fine from tablet width on.
      wrapFrom={768}
    >
      <Chip
        label={t('map:allSports')}
        selected={none}
        onPress={() => onChange([])}
        accessibilityLabel={t('map:allSportsA11y')}
        style={none ? styles.floating : styles.idle}
      />
      {SPORTS.map((sport) => {
        const isOn = selected.includes(sport.id);
        return (
          <Chip
            key={sport.id}
            label={t(`vocab:sports.${sport.id}`)}
            selected={isOn}
            onPress={() => toggle(sport.id)}
            icon={({ color, size }) => (
              <SportIcon sportId={sport.id} size={size + 2} color={color} />
            )}
            style={isOn ? styles.floating : styles.idle}
          />
        );
      })}
    </ChipRow>
  );
}
