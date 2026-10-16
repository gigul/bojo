// Dev-only design-system showcase (b1). Reachable at /dev/ui in __DEV__ builds; redirects home otherwise.
import { SPORT_IDS, type EventCardRow } from '@bojo/shared';
import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ListItem,
  OtpInput,
  Screen,
  Segmented,
  Sheet,
  Skeleton,
  SpotsBadge,
  Stepper,
  Text,
  TextField,
  useToast,
  type BadgeTone,
} from '@/components/ui';
import { EventCard } from '@/features/events';
import { setLanguage, useLanguage, type Language } from '@/i18n';
import { Icon, SportIcon, TAB_ICONS, TabIcon, type IconName, type TabIconName } from '@/icons';
import { warsawDateTimeISO } from '@/lib/datetime';
import {
  contrastRatio,
  useTheme,
  useThemedStyles,
  useThemeMode,
  type Theme,
  type ThemeColorName,
  type ThemeMode,
  type TypographyVariant,
} from '@/theme';

export default function DevUiRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevUiScreen />;
}

const TYPE_VARIANTS: TypographyVariant[] = [
  'display',
  'title',
  'heading',
  'number',
  'body',
  'bodyStrong',
  'label',
  'caption',
];
const BADGE_TONES: BadgeTone[] = ['neutral', 'primary', 'success', 'warning', 'danger'];
const SHOWCASE_SPORTS = [...SPORT_IDS, 'multi', 'unknown_sport'] as const;
const ICON_SIZES = [16, 20, 24, 32, 48];
const UI_ICONS: IconName[] = [
  'search',
  'sliders',
  'filter',
  'map-pin',
  'navigation',
  'clock',
  'calendar',
  'bell',
  'message-circle',
  'send',
  'share-2',
  'flag',
  'star',
  'heart',
  'plus',
  'x',
  'chevron-left',
  'chevron-right',
  'settings',
  'log-out',
];
const SAMPLE_PEOPLE = ['Anna K', 'Piotr N', 'Олег С', 'Maria W', 'Jan Z', 'Ola B'].map((name) => ({
  name,
}));

const createStyles = (t: Theme) =>
  StyleSheet.create({
    section: { gap: t.spacing.md, paddingVertical: t.spacing.lg },
    sectionTitle: { marginBottom: t.spacing.xs },
    divider: { height: t.layout.hairline, backgroundColor: t.colors.border },
    intro: { marginTop: t.spacing.xs, marginBottom: t.spacing.lg },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.spacing.sm },
    swatchRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 44 },
    swatch: {
      width: 40,
      height: 40,
      borderRadius: t.radius.sm,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
    },
    swatchText: { flex: 1 },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md },
    iconCell: { width: 92, alignItems: 'center', gap: t.spacing.xs, paddingVertical: t.spacing.sm },
    sportRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 56 },
    sportName: { width: 120 },
    card: { gap: t.spacing.sm },
    listCard: { paddingVertical: 0 },
    skeletonRow: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' },
    skeletonText: { flex: 1, gap: t.spacing.sm },
  });

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <View style={styles.section}>
        <Text variant="title" accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
        {children}
      </View>
      <View style={styles.divider} />
    </>
  );
}

/**
 * Which backgrounds each colour is meant to sit on. Text colours need ≥ 4.5:1 (AA); UI-only
 * colours (lime fill, map pins) need ≥ 3:1; pure surfaces/decor are not rated.
 */
const CONTRAST_PAIRS: Partial<Record<ThemeColorName, { on: ThemeColorName[]; min: number }>> = {
  text: { on: ['background', 'surface', 'surfaceAlt'], min: 4.5 },
  textMuted: { on: ['background', 'surface', 'surfaceAlt'], min: 4.5 },
  primaryText: { on: ['background', 'surface', 'surfaceAlt'], min: 4.5 },
  success: { on: ['background', 'surface'], min: 4.5 },
  warning: { on: ['background', 'surface'], min: 4.5 },
  danger: { on: ['background', 'surface'], min: 4.5 },
  textInverse: { on: ['text', 'success', 'warning', 'danger'], min: 4.5 },
  onPrimary: { on: ['primary', 'primaryPressed'], min: 4.5 },
  mapMarker: { on: ['background'], min: 3 },
  mapMarkerSelected: { on: ['mapMarker'], min: 3 },
};

function verdict(ratio: number, min: number): string {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return min <= 3 ? 'AA UI' : 'AA large only';
  return 'FAIL';
}

function ColorRow({ name }: { name: ThemeColorName }) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const value = theme.colors[name];
  const pairs = CONTRAST_PAIRS[name];
  const readout = pairs
    ? pairs.on
        .map((bg) => {
          const ratio = contrastRatio(value, theme.colors[bg]);
          return ratio === null
            ? `on ${bg} —`
            : `on ${bg} ${ratio.toFixed(2)}:1 ${verdict(ratio, pairs.min)}`;
        })
        .join(' · ')
    : 'surface / decoration — not rated';
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatch, { backgroundColor: value }]} />
      <View style={styles.swatchText}>
        <Text variant="bodyStrong">
          {name} <Text color="textMuted">{value}</Text>
        </Text>
        <Text variant="caption" color="textMuted">
          {readout}
        </Text>
      </View>
    </View>
  );
}

function sampleEvent(): EventCardRow {
  const startsAt = warsawDateTimeISO(0, 18, 0);
  return {
    id: 'dev-sample-event',
    series_id: null,
    sport_id: 'football',
    title: null,
    starts_at: startsAt,
    ends_at: warsawDateTimeISO(0, 19, 30),
    spots_total: 10,
    spots_taken: 7,
    spots_reserved: 0,
    spots_left: 3,
    level: null,
    status: 'scheduled',
    visibility: 'public',
    venue_id: 'dev-sample-venue',
    venue_name: 'Pole Mokotowskie',
    venue_kind: 'pitch',
    venue_lat: 52.2128,
    venue_lng: 21.0005,
    district_key: 'mokotow',
    distance_km: 1.2,
    organizer_id: null,
    organizer_name: null,
    organizer_avatar_path: null,
    organizer_reliability: null,
    organizer_is_verified: null,
    my_status: null,
    is_organizer: false,
    participants_preview: null,
  };
}

function DevUiScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('common');
  const { t: tv } = useTranslation('vocab');
  const toast = useToast();
  const { mode, setMode } = useThemeMode();
  const language = useLanguage();

  const [selectedSports, setSelectedSports] = useState<string[]>(['football']);
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('12');
  const [players, setPlayers] = useState(10);
  const [segment, setSegment] = useState<'today' | 'tomorrow' | 'weekend'>('today');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const event = sampleEvent();

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: t('theme.system') },
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
  ];
  const languageOptions: { value: Language; label: string }[] = [
    { value: 'ru', label: t('language.ru') },
    { value: 'pl', label: t('language.pl') },
    { value: 'en', label: t('language.en') },
  ];
  const toggleSport = (id: string) =>
    setSelectedSports((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  const sportLabel = (id: string) =>
    (SPORT_IDS as readonly string[]).includes(id) || id === 'multi'
      ? tv(`sports.${id as (typeof SPORT_IDS)[number] | 'multi'}`)
      : id;

  return (
    <Screen scroll>
      <Text variant="display" accessibilityRole="header">
        {t('dev.uiKitTitle')}
      </Text>
      <Text color="textMuted" style={styles.intro}>
        {t('dev.sampleText')}
      </Text>
      <View style={styles.divider} />

      <Section title={t('dev.sectionTheme')}>
        <Segmented
          options={themeOptions}
          value={mode}
          onChange={setMode}
          accessibilityLabel={t('theme.label')}
        />
        <Segmented
          options={languageOptions}
          value={language}
          onChange={(lng) => void setLanguage(lng)}
          accessibilityLabel={t('language.label')}
        />
        <Text variant="caption" color="textMuted">
          scheme: {theme.scheme} · Manrope: {theme.fontsLoaded ? 'loaded' : 'system fallback'}
        </Text>
      </Section>

      <Section title={t('dev.sectionType')}>
        {TYPE_VARIANTS.map((variant) => (
          <View key={variant}>
            <Text variant="caption" color="textMuted">
              {variant} · {theme.typography[variant].fontSize}/
              {theme.typography[variant].lineHeight}
            </Text>
            <Text variant={variant}>
              {variant === 'number' ? '18:00 · 3/10' : t('dev.sampleText')}
            </Text>
          </View>
        ))}
      </Section>

      <Section title={t('dev.sectionColors')}>
        {(Object.keys(theme.colors) as ThemeColorName[]).map((name) => (
          <ColorRow key={name} name={name} />
        ))}
      </Section>

      <Section title={t('dev.sectionButtons')}>
        <View style={styles.row}>
          <Button
            title={t('actions.signIn')}
            onPress={() => toast.show(t('dev.toastSuccess'), 'success')}
          />
          <Button
            title={t('actions.edit')}
            variant="secondary"
            icon="edit-2"
            onPress={() => undefined}
          />
          <Button title={t('actions.cancel')} variant="ghost" onPress={() => undefined} />
          <Button
            title={t('actions.delete')}
            variant="danger"
            icon="trash-2"
            onPress={() => undefined}
          />
        </View>
        <Button
          title={t('actions.continue')}
          size="lg"
          fullWidth
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        />
        <View style={styles.row}>
          <Button title={t('actions.save')} disabled onPress={() => undefined} />
          <Button
            title={t('actions.next')}
            icon="arrow-right"
            iconPosition="right"
            variant="secondary"
            onPress={() => undefined}
          />
        </View>
        <View style={styles.row}>
          <IconButton
            icon="share-2"
            accessibilityLabel={t('actions.share')}
            onPress={() => undefined}
          />
          <IconButton
            icon="navigation"
            variant="surface"
            accessibilityLabel={t('actions.search')}
            onPress={() => undefined}
          />
          <IconButton
            icon="plus"
            variant="primary"
            accessibilityLabel={t('actions.next')}
            onPress={() => undefined}
          />
          <IconButton
            icon="sliders"
            disabled
            accessibilityLabel={t('actions.filters')}
            onPress={() => undefined}
          />
        </View>
      </Section>

      <Section title={t('dev.sectionChips')}>
        <View style={styles.row}>
          {SPORT_IDS.slice(0, 5).map((id) => {
            const selected = selectedSports.includes(id);
            return (
              <Chip
                key={id}
                label={sportLabel(id)}
                selected={selected}
                onPress={() => toggleSport(id)}
                icon={({ color, size }) => <SportIcon sportId={id} size={size + 2} color={color} />}
              />
            );
          })}
        </View>
        <View style={styles.row}>
          <Chip label={t('actions.filters')} icon="sliders" onPress={() => undefined} />
          <Chip label={tv('surfaces.artificial_turf')} />
          <Chip label={tv('levels.any')} selected onPress={() => undefined} />
        </View>
        <View style={styles.row}>
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} label={tone} tone={tone} />
          ))}
          <Badge label={tv('levels.3')} icon="bar-chart-2" />
        </View>
        <View style={styles.row}>
          <SpotsBadge spotsLeft={3} spotsTotal={10} />
          <SpotsBadge spotsLeft={1} spotsTotal={4} />
          <SpotsBadge spotsLeft={0} spotsTotal={12} />
        </View>
        <View style={styles.row}>
          <Avatar name={t('dev.sampleName')} size={56} />
          <Avatar name={t('dev.sampleName')} size={40} />
          <Avatar name="Jan" size={28} />
          <AvatarStack people={SAMPLE_PEOPLE} total={9} />
          <AvatarStack people={SAMPLE_PEOPLE.slice(0, 2)} />
        </View>
      </Section>

      <Section title={t('dev.sectionInputs')}>
        <TextField
          label={t('dev.sampleField')}
          value={name}
          onChangeText={setName}
          placeholder={t('dev.sampleName')}
        />
        <TextField
          label={t('dev.sampleField')}
          value="A"
          onChangeText={() => undefined}
          error={t('dev.sampleFieldError')}
        />
        <OtpInput
          value={otp}
          onChange={setOtp}
          onComplete={() => toast.show(t('dev.toastSuccess'), 'success')}
        />
        <Stepper
          label={t('dev.samplePlayers')}
          value={players}
          min={2}
          max={50}
          onChange={setPlayers}
        />
        <Segmented
          options={[
            { value: 'today', label: t('time.today') },
            { value: 'tomorrow', label: t('time.tomorrow') },
            { value: 'weekend', label: tv('weekdaysShort.6') },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Section>

      <Section title={t('dev.sectionLists')}>
        <EventCard event={event} onPress={() => toast.show(t('dev.toastNeutral'))} />
        <Card style={styles.card}>
          <Text variant="heading">{tv('sports.basketball')}</Text>
          <Text color="textMuted">{t('dev.sampleSubtitle')}</Text>
        </Card>
        <Card padded={false} style={styles.listCard}>
          <ListItem
            title={t('dev.sampleName')}
            subtitle={t('dev.sampleSubtitle')}
            left={<Avatar name={t('dev.sampleName')} />}
            onPress={() => undefined}
          />
          <View style={styles.divider} />
          <ListItem
            title={tv('sports.tennis')}
            subtitle={tv('venueKinds.sports_centre')}
            left={<SportIcon sportId="tennis" size={28} />}
            right={<SpotsBadge spotsLeft={1} />}
          />
        </Card>
      </Section>

      <Section title={t('dev.sectionStates')}>
        <Card>
          <EmptyState
            icon={({ color, size }) => <SportIcon sportId="multi" size={size} color={color} />}
            title={t('states.empty')}
            message={t('states.signInRequiredMessage')}
            action={{ label: t('actions.signIn'), onPress: () => undefined }}
          />
        </Card>
        <Card>
          <ErrorState error={new TypeError('Network request failed')} onRetry={() => undefined} />
        </Card>
        <View style={styles.skeletonRow}>
          <Skeleton width={48} height={48} radius={24} />
          <View style={styles.skeletonText}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      </Section>

      <Section title={t('dev.sectionSportIcons')}>
        {SHOWCASE_SPORTS.map((id) => (
          <View key={id} style={styles.sportRow}>
            <Text variant="label" style={styles.sportName}>
              {sportLabel(id)}
            </Text>
            {ICON_SIZES.map((size) => (
              <SportIcon key={size} sportId={id} size={size} />
            ))}
            <SportIcon sportId={id} size={32} active />
            <SportIcon sportId={id} size={40} color="primaryText" />
          </View>
        ))}
      </Section>

      <Section title={t('dev.sectionIcons')}>
        <View style={styles.iconGrid}>
          {UI_ICONS.map((icon) => (
            <View key={icon} style={styles.iconCell}>
              <Icon name={icon} />
              <Text variant="caption" color="textMuted">
                {icon}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          {(Object.keys(TAB_ICONS) as TabIconName[]).map((tab) => (
            <View key={tab} style={styles.iconCell}>
              <TabIcon name={tab} focused color={theme.colors.textMuted} />
              <TabIcon name={tab} focused={false} color={theme.colors.textMuted} />
              <Text variant="caption" color="textMuted">
                {t(`tabs.${tab}`)}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t('dev.sectionFeedback')}>
        <Button title={t('dev.openSheet')} variant="secondary" onPress={() => setSheetOpen(true)} />
        <View style={styles.row}>
          <Button
            title="neutral"
            variant="secondary"
            onPress={() => toast.show(t('dev.toastNeutral'))}
          />
          <Button
            title="success"
            variant="secondary"
            onPress={() => toast.show(t('dev.toastSuccess'), 'success')}
          />
          <Button
            title="warning"
            variant="secondary"
            onPress={() => toast.show(t('dev.toastWarning'), 'warning')}
          />
          <Button
            title="danger"
            variant="secondary"
            onPress={() => toast.show(t('dev.toastDanger'), 'danger')}
          />
        </View>
      </Section>

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={tv('sports.volleyball')}
      >
        <View style={styles.card}>
          <Text>{t('dev.sampleSheetBody')}</Text>
          <Stepper
            label={t('dev.samplePlayers')}
            value={players}
            min={2}
            max={50}
            onChange={setPlayers}
          />
          <Button
            title={t('actions.done')}
            size="lg"
            fullWidth
            onPress={() => setSheetOpen(false)}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
