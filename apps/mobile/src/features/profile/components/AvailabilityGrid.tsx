import { DAY_PARTS, slotKey, WEEKDAYS, type DayPart, type Weekday } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

import { sortSlotKeys } from '../api';

export interface AvailabilityGridProps {
  /** Slot keys '<weekday>:<day_part>'. */
  value: readonly string[];
  onChange: (next: string[]) => void;
}

const PRESETS: { id: 'workdayEvenings' | 'weekend'; slots: string[] }[] = [
  { id: 'workdayEvenings', slots: [1, 2, 3, 4, 5].map((d) => slotKey(d as Weekday, 'evening')) },
  {
    id: 'weekend',
    slots: [6, 7].flatMap((d) => DAY_PARTS.map((p) => slotKey(d as Weekday, p))),
  },
];

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { gap: t.spacing.lg },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    table: { gap: t.spacing.xs + 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs + 2 },
    dayCol: { width: 40 },
    head: { flex: 1, alignItems: 'center' },
    cell: {
      flex: 1,
      height: 44,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellOn: { backgroundColor: t.colors.primary },
    cellPressed: { opacity: 0.75 },
  });

/** 7 weekdays × 3 day parts. Selected cells: lime fill + check (state is never colour-only). */
export function AvailabilityGrid({ value, onChange }: AvailabilityGridProps) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['profile', 'vocab']);
  const selected = new Set(value);

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(sortSlotKeys(next));
  };
  const applyPreset = (slots: string[]) => {
    const all = slots.every((s) => selected.has(s));
    const next = new Set(selected);
    for (const s of slots) {
      if (all) next.delete(s);
      else next.add(s);
    }
    onChange(sortSlotKeys(next));
  };

  return (
    <View style={styles.root}>
      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={t(`profile:availability.presets.${p.id}`)}
            selected={p.slots.every((s) => selected.has(s))}
            onPress={() => applyPreset(p.slots)}
            testID={`preset-${p.id}`}
          />
        ))}
        {selected.size > 0 ? (
          <Chip label={t('profile:availability.clear')} icon="x" onPress={() => onChange([])} />
        ) : null}
      </View>

      <View style={styles.table}>
        <View style={styles.row} aria-hidden>
          <View style={styles.dayCol} />
          {DAY_PARTS.map((part) => (
            <View key={part} style={styles.head}>
              <Text variant="label">{t(`vocab:dayParts.${part}`)}</Text>
              <Text variant="caption" color="textMuted">
                {t(`vocab:dayPartHours.${part}`)}
              </Text>
            </View>
          ))}
        </View>
        {WEEKDAYS.map((day) => (
          <View key={day} style={styles.row}>
            <Text variant="label" color="textMuted" style={styles.dayCol} aria-hidden>
              {t(`vocab:weekdaysShort.${day}`)}
            </Text>
            {DAY_PARTS.map((part: DayPart) => {
              const key = slotKey(day, part);
              const on = selected.has(key);
              const label = `${t(`vocab:weekdays.${day}`)}, ${t(`vocab:dayParts.${part}`)} ${t(`vocab:dayPartHours.${part}`)}`;
              return (
                <Pressable
                  key={key}
                  onPress={() => toggle(key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                  accessibilityLabel={label}
                  testID={`slot-${key}`}
                  style={({ pressed }) => [
                    styles.cell,
                    on ? styles.cellOn : null,
                    pressed ? styles.cellPressed : null,
                  ]}
                >
                  {on ? <Icon name="check" size={18} color={theme.colors.onPrimary} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
