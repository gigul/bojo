import { SPORT_IDS, type EventDateRange } from '@bojo/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Chip, ChipRow } from '@/components/ui';
import { SportIcon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

import { districtName, sportName } from '../format';
import { DistrictSheet } from './DistrictSheet';

export interface FeedFilterState {
  dateRange: EventDateRange;
  sportIds: string[];
  districtKey: string | null;
  onlyWithSpots: boolean;
}

export const DEFAULT_FEED_FILTERS: FeedFilterState = {
  dateRange: 'upcoming',
  sportIds: [],
  districtKey: null,
  onlyWithSpots: false,
};

export function hasActiveFilters(f: FeedFilterState): boolean {
  return (
    f.dateRange !== 'upcoming' || f.sportIds.length > 0 || f.districtKey !== null || f.onlyWithSpots
  );
}

const DATE_RANGES: readonly EventDateRange[] = ['upcoming', 'today', 'tomorrow', 'weekend', 'week'];

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { gap: t.spacing.sm, paddingBottom: t.spacing.sm },
    row: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenGutter },
    separator: {
      width: t.layout.hairline,
      alignSelf: 'stretch',
      marginVertical: 6,
      backgroundColor: t.colors.border,
    },
  });

export interface FeedFiltersProps {
  value: FeedFilterState;
  onChange: (next: FeedFilterState) => void;
}

/** Date (single) · district · "has spots" · sports (multi) filter rows for the feed. */
export function FeedFilters({ value, onChange }: FeedFiltersProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'vocab', 'common']);
  const [districtOpen, setDistrictOpen] = useState(false);

  const toggleSport = (id: string) =>
    onChange({
      ...value,
      sportIds: value.sportIds.includes(id)
        ? value.sportIds.filter((s) => s !== id)
        : [...value.sportIds, id],
    });

  return (
    <View style={styles.root}>
      {/* One date at a time: a radio group (scrolls on phones, wraps on wide screens). */}
      <ChipRow
        contentContainerStyle={styles.row}
        role="radiogroup"
        accessibilityLabel={t('events:filters.dateA11y')}
      >
        {DATE_RANGES.map((range) => (
          <Chip
            key={range}
            label={t(`events:filters.date.${range}`)}
            selected={value.dateRange === range}
            selection="radio"
            onPress={() => onChange({ ...value, dateRange: range })}
          />
        ))}
      </ChipRow>
      <ChipRow
        contentContainerStyle={styles.row}
        role="group"
        accessibilityLabel={t('common:actions.filters')}
      >
        <Chip
          label={
            value.districtKey ? districtName(value.districtKey, t) : t('events:filters.district')
          }
          icon={value.districtKey ? 'map-pin' : 'chevron-down'}
          selected={value.districtKey !== null}
          selection="none"
          onPress={() => setDistrictOpen(true)}
          accessibilityLabel={t('events:filters.districtA11y', {
            value: value.districtKey
              ? districtName(value.districtKey, t)
              : t('events:filters.allDistricts'),
          })}
        />
        <Chip
          label={t('events:filters.withSpots')}
          selected={value.onlyWithSpots}
          onPress={() => onChange({ ...value, onlyWithSpots: !value.onlyWithSpots })}
        />
        <View style={styles.separator} aria-hidden />
        {SPORT_IDS.map((id) => (
          <Chip
            key={id}
            label={sportName(id, t)}
            selected={value.sportIds.includes(id)}
            onPress={() => toggleSport(id)}
            icon={({ color, size }) => <SportIcon sportId={id} size={size + 2} color={color} />}
          />
        ))}
      </ChipRow>
      <DistrictSheet
        visible={districtOpen}
        value={value.districtKey}
        onChange={(districtKey) => onChange({ ...value, districtKey })}
        onClose={() => setDistrictOpen(false)}
      />
    </View>
  );
}
