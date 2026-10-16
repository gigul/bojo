// Events tab: public feed with filters (live counters) + "My events" (ARCHITECTURE §2.2). Owner: c.
import { isInServiceArea, type EventCardRow, type EventsFeedParams } from '@bojo/shared';
import { router } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Screen, Segmented, Text } from '@/components/ui';
import {
  DEFAULT_FEED_FILTERS,
  EventCard,
  EventCardSkeleton,
  FeedFilters,
  hasActiveFilters,
  useDeviceLocation,
  useEventsFeedInfinite,
  useMyEvents,
  type FeedFilterState,
} from '@/features/events';
import { NotificationsBell } from '@/features/notifications';
import { useLanguage } from '@/i18n';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { formatDayLabel, warsawDayDiff } from '@/lib/datetime';
import { roundCoord } from '@/lib/location';
import { floatingShadow, useTheme, useThemedStyles, type Theme } from '@/theme';

type Segment = 'all' | 'mine';
/** Covers the whole city from any point in it; sorting stays by start time. */
const FEED_RADIUS_KM = 30;

interface Section {
  key: string;
  title: string;
  data: EventCardRow[];
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: t.layout.screenGutter,
      paddingRight: t.spacing.sm,
      paddingTop: t.spacing.sm,
    },
    segment: { paddingHorizontal: t.layout.screenGutter, paddingVertical: t.spacing.md },
    content: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      flex: 1,
    },
    // Room for the floating "Создать" (52 + 16) so the last card's badge/"Иду" scroll clear of it.
    listContent: { paddingBottom: 132, flexGrow: 1 },
    sectionHeader: {
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.sm,
      backgroundColor: t.colors.background,
    },
    item: { paddingHorizontal: t.layout.screenGutter, paddingBottom: t.spacing.md },
    skeletons: {
      paddingHorizontal: t.layout.screenGutter,
      gap: t.spacing.md,
      paddingTop: t.spacing.md,
    },
    footer: { paddingVertical: t.spacing.lg, alignItems: 'center' },
    emptyActions: { gap: t.spacing.sm, alignItems: 'center' },
    stale: { opacity: 0.6 },
    // Aligned to the 640 pt content column, not to the window edge (wide web / tablets).
    fab: { position: 'absolute', left: 0, right: 0, bottom: t.spacing.lg, alignItems: 'center' },
    fabColumn: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      paddingHorizontal: t.layout.screenGutter,
      alignItems: 'flex-end',
    },
    fabButton: { ...floatingShadow(t.scheme) },
  });

function groupByDay(rows: readonly EventCardRow[], language: ReturnType<typeof useLanguage>) {
  const sections: Section[] = [];
  for (const row of rows) {
    const key = String(warsawDayDiff(row.starts_at));
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.data.push(row);
    else sections.push({ key, title: formatDayLabel(row.starts_at, language), data: [row] });
  }
  return sections;
}

function openEvent(id: string) {
  router.push({ pathname: '/event/[id]', params: { id } });
}

function Skeletons() {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.skeletons}>
      <EventCardSkeleton />
      <EventCardSkeleton />
      <EventCardSkeleton />
    </View>
  );
}

function AllEvents({ onCreate }: { onCreate: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'common']);
  const language = useLanguage();
  const [filters, setFilters] = useState<FeedFilterState>(DEFAULT_FEED_FILTERS);
  // Never block the feed on the permission prompt: load right away, refine with distances later.
  const { location } = useDeviceLocation({ request: true });
  const point = location && isInServiceArea(location.lat, location.lng) ? location : null;

  const params: EventsFeedParams = {
    dateRange: filters.dateRange,
    sportIds: filters.sportIds.length > 0 ? [...filters.sportIds].sort() : undefined,
    districtKey: filters.districtKey ?? undefined,
    onlyWithSpots: filters.onlyWithSpots || undefined,
    ...(point
      ? { lat: roundCoord(point.lat), lng: roundCoord(point.lng), radiusKm: FEED_RADIUS_KM }
      : null),
  };
  const feed = useEventsFeedInfinite(params);
  const sections = groupByDay(feed.rows, language);
  const filtered = hasActiveFilters(filters);

  const filtersHeader = <FeedFilters value={filters} onChange={setFilters} />;

  let empty: ReactElement | null = null;
  if (feed.isPending) empty = <Skeletons />;
  else if (feed.isError)
    empty = <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />;
  else if (feed.rows.length === 0) {
    empty = filtered ? (
      <EmptyState
        icon="filter"
        title={t('events:feed.emptyFilteredTitle')}
        message={t('events:feed.emptyFilteredMessage')}
        action={
          <View style={styles.emptyActions}>
            <Button
              title={t('events:feed.resetFilters')}
              variant="secondary"
              onPress={() => setFilters(DEFAULT_FEED_FILTERS)}
            />
            <Button title={t('events:feed.createCta')} variant="ghost" onPress={onCreate} />
          </View>
        }
      />
    ) : (
      <EmptyState
        icon="users"
        title={t('events:feed.emptyTitle')}
        message={t('events:feed.emptyMessage')}
        action={{ label: t('events:feed.createCta'), onPress: onCreate }}
      />
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={filtersHeader}
      ListEmptyComponent={empty}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text variant="heading" accessibilityRole="header">
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.item}>
          {/* Sections are days ("Завтра"): the card shows just the time. */}
          <EventCard event={item} timeOnly onPress={() => openEvent(item.id)} />
        </View>
      )}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <View style={styles.footer}>
            <EventCardSkeleton />
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => void feed.refetch()}
          tintColor={theme.colors.textMuted}
        />
      }
      contentContainerStyle={styles.listContent}
      style={feed.isPlaceholderData ? styles.stale : null}
    />
  );
}

function MyEvents({ onCreate }: { onCreate: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'common']);
  const { session, isLoading: authLoading } = useAuth();
  const requireAuth = useRequireAuth();
  const upcoming = useMyEvents('upcoming');
  const past = useMyEvents('past');

  if (!session) {
    if (authLoading) return <Skeletons />;
    return (
      <EmptyState
        icon="calendar"
        title={t('common:states.signInRequired')}
        message={t('events:mine.signIn')}
        action={{ label: t('common:actions.signIn'), onPress: () => requireAuth('/events') }}
      />
    );
  }
  if (upcoming.isPending || past.isPending) return <Skeletons />;
  if (upcoming.isError) {
    return <ErrorState error={upcoming.error} onRetry={() => void upcoming.refetch()} />;
  }

  const sections: Section[] = [];
  if ((upcoming.data ?? []).length > 0) {
    sections.push({ key: 'upcoming', title: t('events:mine.upcoming'), data: upcoming.data ?? [] });
  }
  if ((past.data ?? []).length > 0) {
    sections.push({ key: 'past', title: t('events:mine.past'), data: past.data ?? [] });
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text variant="heading" accessibilityRole="header">
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item, section }) => (
        <View style={styles.item}>
          <EventCard
            event={item}
            compact={section.key === 'past'}
            onPress={() => openEvent(item.id)}
          />
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="calendar"
          title={t('events:mine.emptyTitle')}
          message={t('events:mine.emptyMessage')}
          action={{ label: t('events:feed.createCta'), onPress: onCreate }}
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={upcoming.isRefetching || past.isRefetching}
          onRefresh={() => {
            void upcoming.refetch();
            void past.refetch();
          }}
          tintColor={theme.colors.textMuted}
        />
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

export default function EventsTabScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'common']);
  const requireAuth = useRequireAuth();
  const [segment, setSegment] = useState<Segment>('all');

  const create = () => {
    if (requireAuth('/event/create')) router.push('/event/create');
  };

  return (
    <Screen edges={['top', 'left', 'right']} padded={false}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {t('common:screens.events')}
          </Text>
          <NotificationsBell />
        </View>
        <View style={styles.segment}>
          <Segmented
            semantics="tabs"
            options={[
              { value: 'all', label: t('events:segments.all') },
              { value: 'mine', label: t('events:segments.mine') },
            ]}
            value={segment}
            onChange={setSegment}
            accessibilityLabel={t('events:segments.a11y')}
          />
        </View>
        {segment === 'all' ? <AllEvents onCreate={create} /> : <MyEvents onCreate={create} />}
      </View>
      <View style={styles.fab} pointerEvents="box-none">
        <View style={styles.fabColumn} pointerEvents="box-none">
          <Button
            title={t('events:feed.create')}
            icon="plus"
            size="lg"
            onPress={create}
            style={styles.fabButton}
            accessibilityHint={t('events:feed.createHint')}
          />
        </View>
      </View>
    </Screen>
  );
}
