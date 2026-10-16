// Add venue (b2, auth): step 1 — place the point with the map crosshair (existing venues are shown to
// avoid duplicates); step 2 — name, kind, sports, surface, lit / free / indoor, hours → add_venue.
// Errors: outside_service_area, duplicate_venue (offer to open the existing one), rate_limited.
import { isInServiceArea, WARSAW_CENTER } from '@bojo/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Text, useToast } from '@/components/ui';
import {
  ConfirmSheet,
  hasErrors,
  SignInGate,
  toVenueMapItem,
  useAddVenue,
  useVenuesInBbox,
  validateVenueForm,
  VenueFormFields,
  VenueMap,
  type LatLng,
  type MapViewport,
  type VenueFormErrors,
  type VenueFormValues,
} from '@/features/venues';
import { Icon } from '@/icons';
import { useAuth } from '@/lib/auth';
import { getErrorDetails, getRpcErrorCode, useErrorText } from '@/lib/errors';
import { floatingShadow, useThemedStyles, type Theme } from '@/theme';

/** Close enough to place a pitch precisely. */
const PICK_ZOOM = 17;
/** Below this zoom the nearby-venue query would be large and pins unreadable. */
const NEARBY_MIN_ZOOM = 14;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: t.colors.background },
    hintWrap: {
      position: 'absolute',
      top: t.spacing.md,
      left: t.spacing.lg,
      right: t.spacing.lg,
      alignItems: 'center',
    },
    hint: {
      maxWidth: t.layout.maxContentWidth - 2 * t.layout.screenGutter,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surface,
      borderWidth: t.scheme === 'dark' ? t.layout.hairline : 0,
      borderColor: t.colors.border,
      gap: 2,
      ...floatingShadow(t.scheme),
    },
    scroll: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xxl,
      gap: t.spacing.xl,
    },
    location: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    locationText: { flex: 1, gap: 2 },
    error: { marginTop: t.spacing.sm },
  });

function parseCoord(value: string | string[] | undefined, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export default function VenueNewScreen() {
  const { t } = useTranslation(['venues', 'common']);
  const { session, isLoading } = useAuth();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const header = <Stack.Screen options={{ title: t('common:screens.venueNew') }} />;

  if (isLoading) return header;
  if (!session) {
    return (
      <>
        {header}
        <SignInGate title={t('new.signInTitle')} message={t('new.signInMessage')} />
      </>
    );
  }
  const start: LatLng = {
    lat: parseCoord(params.lat, WARSAW_CENTER.lat),
    lng: parseCoord(params.lng, WARSAW_CENTER.lng),
  };
  return (
    <>
      {header}
      <AddVenueFlow start={start} />
    </>
  );
}

const EMPTY_FORM: VenueFormValues = {
  name: '',
  kind: 'pitch',
  sportIds: [],
  surface: null,
  isLit: null,
  isFree: null,
  isIndoor: null,
  openingHours: '',
};

function AddVenueFlow({ start }: { start: LatLng }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['venues', 'map', 'common']);
  const toast = useToast();
  const errorText = useErrorText();
  const addVenue = useAddVenue();

  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [point, setPoint] = useState<LatLng>(start);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [values, setValues] = useState<VenueFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<VenueFormErrors>({});
  const [outside, setOutside] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const nearby = useVenuesInBbox(
    viewport && viewport.zoom >= NEARBY_MIN_ZOOM ? viewport : null,
    null,
  );
  const nearbyItems = (nearby.data ?? []).map(toVenueMapItem);

  const pick = (p: LatLng) => {
    setPoint(p);
    if (!isInServiceArea(p.lat, p.lng)) {
      setOutside(true);
      toast.show(t('venues:new.outside'), 'warning');
      return;
    }
    setOutside(false);
    setStep('form');
  };

  const submit = async () => {
    const nextErrors = validateVenueForm(values, t);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    try {
      const id = await addVenue.mutateAsync({
        name: values.name,
        kind: values.kind,
        lat: point.lat,
        lng: point.lng,
        sportIds: values.sportIds,
        surface: values.surface,
        isLit: values.isLit,
        isFree: values.isFree,
        isIndoor: values.isIndoor,
        openingHours: values.openingHours,
      });
      toast.show(t('venues:new.added'), 'success');
      router.replace({ pathname: '/venue/[id]', params: { id } });
    } catch (e) {
      const code = getRpcErrorCode(e);
      if (code === 'duplicate_venue') {
        setDuplicateId(getErrorDetails(e) ?? '');
      } else if (code === 'outside_service_area') {
        setOutside(true);
        toast.show(t('venues:new.outside'), 'warning');
      } else {
        toast.show(errorText(e), 'danger');
      }
    }
  };

  if (step === 'pick') {
    return (
      <View style={styles.flex}>
        <VenueMap
          venues={nearbyItems}
          initialCenter={point}
          initialZoom={PICK_ZOOM}
          pickMode
          onPickLocation={pick}
          onViewportChange={setViewport}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.hintWrap} pointerEvents="box-none">
          <View style={styles.hint} accessibilityRole="header">
            <Text variant="bodyStrong">{t('venues:new.pickTitle')}</Text>
            <Text variant="label" color={outside ? 'danger' : 'textMuted'}>
              {outside ? t('venues:new.outside') : t('venues:new.pickHint')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // iOS: the keyboard never covers the focused field or the submit button.
        automaticallyAdjustKeyboardInsets
      >
        <Text color="textMuted">{t('venues:new.intro')}</Text>
        <Card>
          <View style={styles.location}>
            <Icon name="map-pin" size={22} color="primaryText" />
            <View style={styles.locationText}>
              <Text variant="bodyStrong">{t('venues:new.location')}</Text>
              <Text variant="label" color="textMuted">
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </Text>
            </View>
            <Button
              title={t('venues:new.changeLocation')}
              onPress={() => setStep('pick')}
              variant="secondary"
            />
          </View>
          {outside ? (
            <Text variant="caption" color="danger" style={styles.error} role="alert">
              {t('venues:new.outside')}
            </Text>
          ) : null}
        </Card>

        <VenueFormFields
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          errors={errors}
          showKind
        />

        <Button
          title={t('venues:new.submit')}
          onPress={() => void submit()}
          loading={addVenue.isPending}
          size="lg"
          fullWidth
        />
      </ScrollView>

      <ConfirmSheet
        visible={duplicateId !== null}
        title={t('venues:new.duplicateTitle')}
        message={t('venues:new.duplicateMessage')}
        confirmLabel={t('venues:new.openExisting')}
        onClose={() => setDuplicateId(null)}
        onConfirm={() => {
          const id = duplicateId;
          setDuplicateId(null);
          if (id) router.replace({ pathname: '/venue/[id]', params: { id } });
        }}
      />
    </View>
  );
}
