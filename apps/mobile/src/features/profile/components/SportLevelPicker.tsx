import { LEVELS, SPORTS, type Level, type SportId } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { Icon, SportIcon } from '@/icons';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

import type { MySport } from '../api';

export interface SportLevelPickerProps {
  value: readonly MySport[];
  onChange: (next: MySport[]) => void;
  /** Level preselected when a sport is added. */
  defaultLevel?: Level;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { gap: t.spacing.xl },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    tile: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 96,
      minHeight: 84,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surface,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xs + 2,
    },
    tileSelected: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    tilePressed: { opacity: 0.85 },
    check: { position: 'absolute', top: 6, right: 6 },
    levels: { gap: t.spacing.md },
    levelCard: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
      gap: t.spacing.md,
    },
    levelHeader: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  });

/** Pick 1–9 sports (tiles) and a level 1–5 for each (chips + one-line description). */
export function SportLevelPicker({ value, onChange, defaultLevel = 2 }: SportLevelPickerProps) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['profile', 'vocab']);
  const selected = new Map(value.map((s) => [s.sport_id, s.level]));

  const toggle = (id: SportId) => {
    if (selected.has(id)) onChange(value.filter((s) => s.sport_id !== id));
    else onChange([...value, { sport_id: id, level: defaultLevel }]);
  };
  const setLevel = (id: SportId, level: Level) =>
    onChange(value.map((s) => (s.sport_id === id ? { ...s, level } : s)));

  const ordered = SPORTS.filter((s) => selected.has(s.id));

  return (
    <View style={styles.root}>
      <View style={styles.grid} accessibilityRole="list">
        {SPORTS.map((sport) => {
          const isOn = selected.has(sport.id);
          const fg = isOn ? theme.colors.onPrimary : theme.colors.text;
          const name = t(`vocab:sports.${sport.id}`);
          return (
            <Pressable
              key={sport.id}
              onPress={() => toggle(sport.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isOn }}
              aria-checked={isOn}
              accessibilityLabel={name}
              testID={`sport-tile-${sport.id}`}
              style={({ pressed }) => [
                styles.tile,
                isOn ? styles.tileSelected : null,
                pressed ? styles.tilePressed : null,
              ]}
            >
              {isOn ? (
                <View style={styles.check}>
                  <Icon name="check" size={16} color={fg} />
                </View>
              ) : null}
              <SportIcon sportId={sport.id} size={30} color={fg} />
              <Text
                variant="label"
                color={fg}
                align="center"
                numberOfLines={2}
                maxFontSizeMultiplier={1.3}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {ordered.length > 0 ? (
        <View style={styles.levels}>
          <Text variant="heading" accessibilityRole="header">
            {t('profile:sports.levelTitle')}
          </Text>
          {ordered.map((sport) => {
            const level = selected.get(sport.id) ?? defaultLevel;
            const name = t(`vocab:sports.${sport.id}`);
            return (
              <View key={sport.id} style={styles.levelCard}>
                <View style={styles.levelHeader}>
                  <SportIcon sportId={sport.id} size={22} />
                  <Text variant="bodyStrong">{name}</Text>
                </View>
                <View
                  style={styles.chips}
                  accessibilityRole="radiogroup"
                  aria-label={t('profile:sports.levelFor', { sport: name })}
                >
                  {LEVELS.map((l) => (
                    <Chip
                      key={l}
                      label={t(`vocab:levels.${l}`)}
                      selected={level === l}
                      selection="radio"
                      onPress={() => setLevel(sport.id, l)}
                      accessibilityLabel={`${name}: ${t(`vocab:levels.${l}`)}, ${t(`profile:levelHints.${l}`)}`}
                      testID={`level-${sport.id}-${l}`}
                    />
                  ))}
                </View>
                <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
                  {t(`profile:levelHints.${level}`)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
