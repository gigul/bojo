// Form fields shared by "add venue" and "suggest edit": name, kind (add only), sports, surface,
// lit / free / indoor (tri-state: yes / no / don't know) and raw opening hours.
import {
  SPORTS,
  TEXT_LIMITS,
  VENUE_KINDS,
  VENUE_SURFACES,
  type SportId,
  type VenueKind,
  type VenueSurface,
} from '@bojo/shared';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Chip, Segmented, Text, TextField } from '@/components/ui';
import i18n from '@/i18n';
import { SportIcon } from '@/icons';
import type { AnyT } from '@/lib/format';
import { useThemedStyles, type Theme } from '@/theme';

import { surfaceLabel } from '../model';

export interface VenueFormValues {
  name: string;
  kind: VenueKind;
  sportIds: SportId[];
  surface: VenueSurface | null;
  isLit: boolean | null;
  isFree: boolean | null;
  isIndoor: boolean | null;
  openingHours: string;
}

export interface VenueFormErrors {
  name?: string | null;
  sports?: string | null;
  hours?: string | null;
}

/** Kinds a user may pick (running routes are a stub, §5.1 add_venue). */
export const USER_VENUE_KINDS: readonly VenueKind[] = VENUE_KINDS.filter(
  (k) => k !== 'running_route',
);

export const OPENING_HOURS_MAX = 255;

/** Client-side checks mirroring add_venue / clean_venue_proposal (`t` = memo key, see AnyT). */
export function validateVenueForm(v: VenueFormValues, _t: AnyT): VenueFormErrors {
  const name = v.name.trim();
  return {
    name:
      name.length < 1 || name.length > TEXT_LIMITS.venueName
        ? i18n.t('venues:form.nameError')
        : null,
    sports: v.sportIds.length === 0 ? i18n.t('venues:form.sportsError') : null,
    hours:
      v.openingHours.trim().length > OPENING_HOURS_MAX ? i18n.t('venues:form.hoursError') : null,
  };
}

export function hasErrors(e: VenueFormErrors): boolean {
  return Boolean(e.name || e.sports || e.hours);
}

type Tri = 'yes' | 'no' | 'unknown';
const toTri = (v: boolean | null): Tri => (v === null ? 'unknown' : v ? 'yes' : 'no');
const fromTri = (v: Tri): boolean | null => (v === 'unknown' ? null : v === 'yes');

const createStyles = (t: Theme) =>
  StyleSheet.create({
    form: { gap: t.spacing.xl },
    field: { gap: t.spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  });

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const labelId = useId();
  return (
    <View style={styles.field} role="group" aria-labelledby={labelId}>
      <Text variant="label" color="textMuted" nativeID={labelId}>
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" color="danger" role="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function VenueFormFields({
  values,
  onChange,
  errors,
  showKind,
}: {
  values: VenueFormValues;
  onChange: (patch: Partial<VenueFormValues>) => void;
  errors: VenueFormErrors;
  showKind: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['venues', 'vocab']);

  const triOptions = (yes: string, no: string) => [
    { value: 'yes' as const, label: yes },
    { value: 'no' as const, label: no },
    { value: 'unknown' as const, label: t('venues:form.unknown') },
  ];

  const toggleSport = (id: SportId) =>
    onChange({
      sportIds: values.sportIds.includes(id)
        ? values.sportIds.filter((s) => s !== id)
        : [...values.sportIds, id],
    });

  return (
    <View style={styles.form}>
      <TextField
        label={t('venues:form.name')}
        value={values.name}
        onChangeText={(name) => onChange({ name })}
        placeholder={t('venues:form.namePlaceholder')}
        maxLength={TEXT_LIMITS.venueName}
        error={errors.name}
        autoCapitalize="sentences"
        returnKeyType="done"
      />

      {showKind ? (
        <Field label={t('venues:form.kind')}>
          <View style={styles.chips} role="radiogroup" accessibilityLabel={t('venues:form.kind')}>
            {USER_VENUE_KINDS.map((kind) => (
              <Chip
                key={kind}
                label={t(`vocab:venueKinds.${kind}`)}
                selected={values.kind === kind}
                selection="radio"
                onPress={() => onChange({ kind })}
              />
            ))}
          </View>
        </Field>
      ) : null}

      <Field label={t('venues:form.sports')} error={errors.sports}>
        <View style={styles.chips}>
          {SPORTS.map((sport) => (
            <Chip
              key={sport.id}
              label={t(`vocab:sports.${sport.id}`)}
              selected={values.sportIds.includes(sport.id)}
              onPress={() => toggleSport(sport.id)}
              icon={({ color, size }) => (
                <SportIcon sportId={sport.id} size={size + 2} color={color} />
              )}
            />
          ))}
        </View>
      </Field>

      <Field label={t('venues:form.surface')}>
        <View style={styles.chips} role="radiogroup" accessibilityLabel={t('venues:form.surface')}>
          {VENUE_SURFACES.map((surface) => (
            <Chip
              key={surface}
              label={surfaceLabel(surface, t)}
              selected={values.surface === surface}
              selection="radio"
              onPress={() => onChange({ surface: values.surface === surface ? null : surface })}
            />
          ))}
          <Chip
            label={t('venues:form.unknown')}
            selected={values.surface === null}
            selection="radio"
            onPress={() => onChange({ surface: null })}
          />
        </View>
      </Field>

      <Field label={t('venues:form.lit')}>
        <Segmented<Tri>
          options={triOptions(t('venues:form.litYes'), t('venues:form.litNo'))}
          value={toTri(values.isLit)}
          onChange={(v) => onChange({ isLit: fromTri(v) })}
          accessibilityLabel={t('venues:form.lit')}
        />
      </Field>

      <Field label={t('venues:form.free')}>
        <Segmented<Tri>
          options={triOptions(t('venues:form.freeYes'), t('venues:form.freeNo'))}
          value={toTri(values.isFree)}
          onChange={(v) => onChange({ isFree: fromTri(v) })}
          accessibilityLabel={t('venues:form.free')}
        />
      </Field>

      <Field label={t('venues:form.indoor')}>
        <Segmented<Tri>
          options={triOptions(t('venues:form.indoorYes'), t('venues:form.indoorNo'))}
          value={toTri(values.isIndoor)}
          onChange={(v) => onChange({ isIndoor: fromTri(v) })}
          accessibilityLabel={t('venues:form.indoor')}
        />
      </Field>

      <TextField
        label={t('venues:form.hours')}
        value={values.openingHours}
        onChangeText={(openingHours) => onChange({ openingHours })}
        hint={t('venues:form.hoursHint')}
        error={errors.hours}
        maxLength={OPENING_HOURS_MAX}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
